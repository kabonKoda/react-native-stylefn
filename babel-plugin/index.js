const path = require('path');
const IMPORT_SOURCE = 'react-native-stylefn';
const AUTO_IMPORT = 'react-native-stylefn/auto';
const RESOLVE_FN = '__resolveStyle';
const INJECTED_COMMENT = '__stylefn_injected__';
const VIEWPORT_UNIT_RE = /^-?\d+\.?\d*(vh|vw)$/;
const PACKAGE_ROOT = path.resolve(__dirname, '..');

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

  function ensureResolveImport(programPath, state) {
    if (state.__stylefnResolveImported) return;
    state.__stylefnResolveImported = true;

    const body = programPath.node.body;

    const exists = body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        node.source.value === IMPORT_SOURCE &&
        node.specifiers.some(
          (s) =>
            t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            s.imported.name === RESOLVE_FN
        )
    );

    if (exists) return;

    const importDecl = t.importDeclaration(
      [t.importSpecifier(t.identifier(RESOLVE_FN), t.identifier(RESOLVE_FN))],
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
              t.isImportDeclaration(node) &&
              node.source.value === AUTO_IMPORT
          );
          if (hasAutoImport) return;

          const hasMarker = path.node.leadingComments?.some(
            (c) => c.value.includes(INJECTED_COMMENT)
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
        if (attrName !== 'style' && !attrName.endsWith('Style')) return;

        const value = path.node.value;
        if (!t.isJSXExpressionContainer(value)) return;

        const expr = value.expression;
        if (t.isJSXEmptyExpression(expr)) return;

        // Skip plain object literals unless they contain viewport units (e.g. '50vw', '100vh')
        if (t.isObjectExpression(expr) && !hasViewportUnits(expr)) return;

        // Skip numeric literals (registered style IDs)
        if (t.isNumericLiteral(expr)) return;

        // Skip if already wrapped with __resolveStyle
        if (
          t.isCallExpression(expr) &&
          t.isIdentifier(expr.callee, { name: RESOLVE_FN })
        ) {
          return;
        }

        // Wrap with __resolveStyle() to resolve functions at render time
        const programPath = state.__programPath || path.findParent((p) => p.isProgram());
        ensureResolveImport(programPath, state);

        value.expression = t.callExpression(
          t.identifier(RESOLVE_FN),
          [expr]
        );
      },
    },
  };
};
