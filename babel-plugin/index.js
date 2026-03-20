const path = require('path');
const IMPORT_SOURCE = 'react-native-stylefn';
const AUTO_IMPORT = 'react-native-stylefn/auto';
const RESOLVE_FN = '__resolveStyle';
const RESOLVE_PROP_FN = '__resolveProp';
const RESOLVE_CHILDREN_FN = '__resolveChildren';
const LAYOUT_VIEW_FN = '__LayoutView';
const SUBSCRIBE_FN = '__subscribeStyleFn';
const INJECTED_COMMENT = '__stylefn_injected__';
const VIEWPORT_UNIT_RE = /^-?\d+\.?\d*(vh|vw)$/;
const PACKAGE_ROOT = path.resolve(__dirname, '..');

/**
 * Props that are known callbacks / render functions and should NEVER be wrapped.
 */
const CALLBACK_PROPS = new Set([
  'key',
  'ref',
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

/**
 * Converts a JSXIdentifier or JSXMemberExpression (element name in JSX) to
 * a regular Babel expression node that can be used as a prop value.
 *
 * e.g. "View" → Identifier("View")
 *      "Animated.View" → MemberExpression(Identifier("Animated"), Identifier("View"))
 */
function jsxNameToExpression(t, name) {
  if (t.isJSXIdentifier(name)) {
    return t.identifier(name.name);
  }
  if (t.isJSXMemberExpression(name)) {
    const obj = t.isJSXMemberExpression(name.object)
      ? jsxNameToExpression(t, name.object)
      : t.identifier(name.object.name);
    return t.memberExpression(obj, t.identifier(name.property.name));
  }
  // Fallback — should not happen in valid JSX
  return t.identifier(name.name || 'View');
}

module.exports = function styleFnBabelPlugin({ types: t }) {
  /**
   * Injects `const __deps = __subscribeStyleFn();` at the top of the nearest
   * enclosing block-body function so the component automatically re-renders
   * only when the specific tokens it accesses change.
   *
   * Returns the Identifier node for `__deps` so callers can pass it to
   * `__resolveStyle(fn, __deps)`, `__resolveProp(fn, __deps)`, etc.
   *
   * - Only injects once per function per file (tracked via Map on state).
   * - Only targets functions with a BlockStatement body (not concise arrows).
   * - Skips the style-function expression itself and only goes to the
   *   component-level function.
   */
  function injectStoreSubscription(attrPath, state) {
    if (!state.__subscribedFunctionNodes) {
      state.__subscribedFunctionNodes = new Map();
    }

    // Find the nearest enclosing function that has a block body.
    const fnPath = attrPath.findParent(
      (p) => p.isFunction() && t.isBlockStatement(p.node.body)
    );

    if (!fnPath) return null;

    // If already injected for this function, return the existing identifier
    if (state.__subscribedFunctionNodes.has(fnPath.node)) {
      return state.__subscribedFunctionNodes.get(fnPath.node);
    }

    const programPath =
      state.__programPath || attrPath.findParent((p) => p.isProgram());
    ensureImport(programPath, state, SUBSCRIBE_FN);

    // Create: const __deps = __subscribeStyleFn();
    const depsId = t.identifier('__deps');
    const declaration = t.variableDeclaration('const', [
      t.variableDeclarator(
        depsId,
        t.callExpression(t.identifier(SUBSCRIBE_FN), [])
      ),
    ]);

    fnPath.node.body.body.unshift(declaration);
    state.__subscribedFunctionNodes.set(fnPath.node, depsId);
    return depsId;
  }

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

        // Skip internal __LayoutView props — these are injected by the plugin
        // itself and must never be wrapped with __resolveProp / __resolveChildren.
        if (attrName.startsWith('__')) return;

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

          const depsId = injectStoreSubscription(path, state);
          const args = depsId ? [expr, depsId] : [expr];
          value.expression = t.callExpression(t.identifier(RESOLVE_FN), args);
          return;
        }

        // =====================================================================
        // children prop: wrap arrow/function expressions with __resolveChildren
        // =====================================================================
        if (attrName === 'children') {
          if (
            !t.isArrowFunctionExpression(expr) &&
            !t.isFunctionExpression(expr)
          )
            return;

          // Skip if already wrapped
          if (
            t.isCallExpression(expr) &&
            t.isIdentifier(expr.callee, { name: RESOLVE_CHILDREN_FN })
          ) {
            return;
          }

          const programPath =
            state.__programPath || path.findParent((p) => p.isProgram());
          ensureImport(programPath, state, RESOLVE_CHILDREN_FN);

          const depsIdC = injectStoreSubscription(path, state);
          const argsC = depsIdC ? [expr, depsIdC] : [expr];
          value.expression = t.callExpression(
            t.identifier(RESOLVE_CHILDREN_FN),
            argsC
          );
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

        const depsIdP = injectStoreSubscription(path, state);
        const argsP = depsIdP ? [expr, depsIdP] : [expr];
        value.expression = t.callExpression(
          t.identifier(RESOLVE_PROP_FN),
          argsP
        );
      },

      // =======================================================================
      // Inline JSX children — Fragment case only:
      //   <>{fn}</> → <>{__resolveChildren(fn)}</>
      //
      // For JSXElement children (<View>{fn}</View>), the JSXElement exit
      // visitor handles the transformation to __LayoutView instead — giving
      // the children function access to the parent's real layout dimensions.
      //
      // Fragment children cannot be measured (no DOM node), so they still use
      // __resolveChildren with layout: { width: 0, height: 0 }.
      // =======================================================================
      JSXExpressionContainer(path, state) {
        const filename = state.filename || '';
        if (shouldSkip(filename)) return;

        // Only handle Fragment children — JSXElement children are handled by
        // the JSXElement exit visitor (which wraps the parent in __LayoutView).
        const parent = path.parent;
        if (!t.isJSXFragment(parent)) return;

        const expr = path.node.expression;
        if (t.isJSXEmptyExpression(expr)) return;

        // Only wrap arrow functions and function expressions
        if (!t.isArrowFunctionExpression(expr) && !t.isFunctionExpression(expr))
          return;

        // Skip if already wrapped
        if (
          t.isCallExpression(expr) &&
          t.isIdentifier(expr.callee, { name: RESOLVE_CHILDREN_FN })
        ) {
          return;
        }

        const programPath =
          state.__programPath || path.findParent((p) => p.isProgram());
        ensureImport(programPath, state, RESOLVE_CHILDREN_FN);

        path.node.expression = t.callExpression(
          t.identifier(RESOLVE_CHILDREN_FN),
          [expr]
        );
      },

      // =======================================================================
      // JSXElement with function children → transform parent to __LayoutView
      //
      // Detects:
      //   <View style={...}>{(t) => <Child style={{ width: t.layout.width }} />}</View>
      //
      // Transforms to (after all attribute/children visitors have run):
      //   <__LayoutView __type={View} __childFn={(t) => <Child ... />} style={__resolveStyle(...)} />
      //
      // This gives the children function access to the parent component's
      // real measured layout dimensions via t.layout.width / t.layout.height.
      //
      // The exit hook fires AFTER all children/attributes have been processed,
      // so style props are already wrapped with __resolveStyle when we carry
      // them over to __LayoutView.
      // =======================================================================
      JSXElement: {
        exit(path, state) {
          const filename = state.filename || '';
          if (shouldSkip(filename)) return;

          // Find the first direct child that is a raw arrow/function expression.
          // (These were intentionally NOT wrapped by JSXExpressionContainer
          // because their parent is a JSXElement, not a JSXFragment.)
          const children = path.node.children;
          const fnChildIndex = children.findIndex(
            (child) =>
              t.isJSXExpressionContainer(child) &&
              (t.isArrowFunctionExpression(child.expression) ||
                t.isFunctionExpression(child.expression))
          );

          if (fnChildIndex === -1) return;

          const originalFn = children[fnChildIndex].expression;

          const openingElement = path.node.openingElement;
          const elementName = openingElement.name;

          // Don't transform __LayoutView itself (avoids infinite recursion
          // after path.replaceWith triggers re-traversal).
          if (
            t.isJSXIdentifier(elementName) &&
            elementName.name === LAYOUT_VIEW_FN
          )
            return;

          // Convert the JSX element name (JSXIdentifier / JSXMemberExpression)
          // to a regular expression so it can be passed as a prop value.
          const typeExpr = jsxNameToExpression(t, elementName);

          // Collect remaining (non-function) children — they'll be rendered
          // as regular children of __LayoutView alongside the function result.
          const otherChildren = children.filter((_, i) => i !== fnChildIndex);

          // Build the new attribute list:
          //   __type={OriginalComponent}  — the component to render
          //   __childFn={fn}             — the children function
          //   ...existingAttrs           — already-processed original attrs
          const newAttributes = [
            t.jsxAttribute(
              t.jsxIdentifier('__type'),
              t.jsxExpressionContainer(typeExpr)
            ),
            t.jsxAttribute(
              t.jsxIdentifier('__childFn'),
              t.jsxExpressionContainer(originalFn)
            ),
            ...openingElement.attributes,
          ];

          // Build <__LayoutView __type={...} __childFn={...} ...props />
          // Self-closing when there are no other (static) children; otherwise
          // wrap the static siblings as regular children of __LayoutView.
          let newElement;
          if (otherChildren.length === 0) {
            newElement = t.jsxElement(
              t.jsxOpeningElement(
                t.jsxIdentifier(LAYOUT_VIEW_FN),
                newAttributes,
                true // self-closing
              ),
              null,
              [],
              true
            );
          } else {
            newElement = t.jsxElement(
              t.jsxOpeningElement(
                t.jsxIdentifier(LAYOUT_VIEW_FN),
                newAttributes,
                false
              ),
              t.jsxClosingElement(t.jsxIdentifier(LAYOUT_VIEW_FN)),
              otherChildren,
              false
            );
          }

          path.replaceWith(newElement);

          const programPath =
            state.__programPath || path.findParent((p) => p.isProgram());
          ensureImport(programPath, state, LAYOUT_VIEW_FN);
        },
      },
    },
  };
};
