const path = require('path');
const IMPORT_SOURCE = 'react-native-stylefn';
const AUTO_IMPORT = 'react-native-stylefn/auto';
const RESOLVE_FN = '__resolveStyle';
const RESOLVE_PROP_FN = '__resolveProp';
const INJECTED_COMMENT = '__stylefn_injected__';
const VIEWPORT_UNIT_RE = /^-?\d+\.?\d*(vh|vw)$/;
const PACKAGE_ROOT = path.resolve(__dirname, '..');

/**
 * Props that are known callbacks / render functions and should NEVER be wrapped.
 */
const CALLBACK_PROPS = new Set([
  'key',
  'ref',
  'children',
  'testID',
  'nativeID',
  'accessibilityLabel',
  // FlatList / SectionList render props
  'keyExtractor',
  'getItem',
  'getItemCount',
  'getItemLayout',
  'ListHeaderComponent',
  'ListFooterComponent',
  'ListEmptyComponent',
  'ItemSeparatorComponent',
  'SectionSeparatorComponent',
  'CellRendererComponent',
  // Navigation
  'component',
  'getComponent',
]);

/**
 * Prop name prefixes that indicate callbacks or render functions.
 */
const CALLBACK_PREFIXES = ['on', 'render', 'handle'];

/**
 * Returns true if the prop name looks like a callback or render function.
 */
function isCallbackProp(name) {
  if (CALLBACK_PROPS.has(name)) return true;
  return CALLBACK_PREFIXES.some(
    (p) =>
      name.startsWith(p) &&
      name.length > p.length &&
      name[p.length] === name[p.length].toUpperCase()
  );
}

module.exports = function styleFnBabelPlugin({ types: t }) {
  /**
   * Returns true if an ObjectExpression contains any string literal values
   * that look like viewport unit values (e.g. '50vw', '100vh').
   */
  function hasViewportUnits(node) {
    if (!t.isObjectExpression(node)) return false;
    return node.properties.some((prop) => {
      if (!t.isObjectProperty(prop)) return false;
      const val = prop.value;
      return t.isStringLiteral(val) && VIEWPORT_UNIT_RE.test(val.value);
    });
  }

  function ensureImport(programPath, state, fnName) {
    const stateKey = `__stylefn_${fnName}_imported`;
    if (state[stateKey]) return;
    state[stateKey] = true;

    const body = programPath.node.body;

    const exists = body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        node.source.value === IMPORT_SOURCE &&
        node.specifiers.some(
          (s) =>
            t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            s.imported.name === fnName
        )
    );

    if (exists) return;

    // Check if there's already an import from the source — if so, add the specifier
    for (let i = 0; i < body.length; i++) {
      const node = body[i];
      if (t.isImportDeclaration(node) && node.source.value === IMPORT_SOURCE) {
        node.specifiers.push(
          t.importSpecifier(t.identifier(fnName), t.identifier(fnName))
        );
        return;
      }
    }

    const importDecl = t.importDeclaration(
      [t.importSpecifier(t.identifier(fnName), t.identifier(fnName))],
      t.stringLiteral(IMPORT_SOURCE)
    );

    let insertIdx = 0;
    for (let i = 0; i < body.length; i++) {
      if (t.isImportDeclaration(body[i])) {
        insertIdx = i + 1;
      }
    }
    body.splice(insertIdx, 0, importDecl);
  }

  function shouldSkip(filename) {
    if (!filename) return true;
    if (filename.includes('node_modules')) return true;
    if (filename.startsWith(PACKAGE_ROOT + '/src/')) return true;
    if (filename.startsWith(PACKAGE_ROOT + '/lib/')) return true;
    // Skip Expo virtual modules (polyfills, context modules, etc.)
    if (!filename.match(/\.(tsx?|jsx?|mjs)$/)) return true;
    return false;
  }

  return {
    name: 'react-native-stylefn',
    visitor: {
      Program: {
        enter(path, state) {
          const filename = state.filename || '';
          if (shouldSkip(filename)) return;

          const body = path.node.body;

          const hasAutoImport = body.some(
            (node) =>
              t.isImportDeclaration(node) && node.source.value === AUTO_IMPORT
          );
          if (hasAutoImport) return;

          const hasMarker = path.node.leadingComments?.some((c) =>
            c.value.includes(INJECTED_COMMENT)
          );
          if (hasMarker) return;

          // Inject: import 'react-native-stylefn/auto'
          const autoImport = t.importDeclaration(
            [],
            t.stringLiteral(AUTO_IMPORT)
          );
          t.addComment(autoImport, 'leading', ` ${INJECTED_COMMENT} `, true);

          let insertIndex = 0;
          for (let i = 0; i < body.length; i++) {
            const node = body[i];
            if (
              t.isExpressionStatement(node) &&
              t.isStringLiteral(node.expression) &&
              node.expression.value === 'use strict'
            ) {
              insertIndex = i + 1;
            }
          }
          body.splice(insertIndex, 0, autoImport);

          state.__programPath = path;
        },
      },

      JSXAttribute(path, state) {
        const filename = state.filename || '';
        if (shouldSkip(filename)) return;

        const name = path.node.name;
        if (!t.isJSXIdentifier(name)) return;

        const attrName = name.name;
        const value = path.node.value;
        if (!t.isJSXExpressionContainer(value)) return;

        const expr = value.expression;
        if (t.isJSXEmptyExpression(expr)) return;

        const isStyleProp = attrName === 'style' || attrName.endsWith('Style');

        // =====================================================================
        // Style props: wrap with __resolveStyle (existing behavior)
        // =====================================================================
        if (isStyleProp) {
          // Skip plain object literals unless they contain viewport units
          if (t.isObjectExpression(expr) && !hasViewportUnits(expr)) return;

          // Skip numeric literals (registered style IDs)
          if (t.isNumericLiteral(expr)) return;

          // Skip if already wrapped
          if (
            t.isCallExpression(expr) &&
            t.isIdentifier(expr.callee, { name: RESOLVE_FN })
          ) {
            return;
          }

          const programPath =
            state.__programPath || path.findParent((p) => p.isProgram());
          ensureImport(programPath, state, RESOLVE_FN);

          value.expression = t.callExpression(t.identifier(RESOLVE_FN), [expr]);
          return;
        }

        // =====================================================================
        // Non-style props: wrap arrow/function expressions with __resolveProp
        // =====================================================================

        // Skip known callback / render props
        if (isCallbackProp(attrName)) return;

        // Only wrap arrow functions and function expressions — these are the
        // user's token functions like ({ orientation }) => ...
        if (!t.isArrowFunctionExpression(expr) && !t.isFunctionExpression(expr))
          return;

        // Skip if already wrapped
        if (
          t.isCallExpression(expr) &&
          t.isIdentifier(expr.callee, { name: RESOLVE_PROP_FN })
        ) {
          return;
        }

        const programPath =
          state.__programPath || path.findParent((p) => p.isProgram());
        ensureImport(programPath, state, RESOLVE_PROP_FN);

        value.expression = t.callExpression(t.identifier(RESOLVE_PROP_FN), [
          expr,
        ]);
      },
    },
  };
};
