const path = require('path');
const IMPORT_SOURCE = 'react-native-stylefn';
const AUTO_IMPORT = 'react-native-stylefn/auto';
const RESOLVE_FN = '__resolveStyle';
const RESOLVE_PROP_FN = '__resolveProp';
const RESOLVE_CHILDREN_FN = '__resolveChildren';
const LAYOUT_VIEW_FN = '__LayoutView';
const INTERACTIVE_VIEW_FN = '__InteractiveView';
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
 * Wraps any non-JSX child nodes (e.g. CallExpression nodes produced by a
 * third-party Babel plugin such as NativeWind) in a JSXExpressionContainer
 * so that `t.jsxElement(open, close, children)` receives only valid JSX
 * child node types and Babel's AST validator does not throw.
 *
 * Valid JSX child types:  JSXText | JSXExpressionContainer | JSXSpreadChild
 *                        | JSXElement | JSXFragment
 *
 * @param {import('@babel/types')} bTypes
 * @param {import('@babel/types').JSXElement['children']} children
 * @returns {import('@babel/types').JSXElement['children']}
 */
function sanitizeJSXChildren(bTypes, children) {
  return children.map((child) => {
    if (
      bTypes.isJSXText(child) ||
      bTypes.isJSXExpressionContainer(child) ||
      bTypes.isJSXSpreadChild(child) ||
      bTypes.isJSXElement(child) ||
      bTypes.isJSXFragment(child)
    ) {
      return child;
    }
    // Another plugin (e.g. NativeWind) already transformed this child from a
    // JSXElement into a CallExpression or other non-JSX expression.  Wrap it
    // in a JSXExpressionContainer so the AST stays valid.
    return bTypes.jsxExpressionContainer(child);
  });
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

// =============================================================================
// Interaction detection helpers
//
// These functions statically analyse a style/prop function's AST to detect
// whether it accesses t.pressed or t.hovered (where t is the first parameter).
// This drives the decision to wrap the element with __InteractiveView.
// =============================================================================

/**
 * Walks the body of a single arrow/function expression to detect whether
 * the first parameter (token object) has `.active` or `.hovered` accessed.
 *
 * Handles two common parameter shapes:
 *   (t) => ...           → looks for `t.active` / `t.hovered` in the body
 *   ({ active }) => ...  → checks whether the destructuring pattern includes
 *                          `active` or `hovered`
 *
 * Does NOT descend into nested function bodies (callbacks inside the style fn).
 *
 * @param {import('@babel/types').Function} fnNode  The function AST node.
 * @param {import('@babel/types')}           bTypes  Babel types helper.
 * @returns {{ active: boolean, hovered: boolean }}
 */
function detectInteractionUsage(fnNode, bTypes) {
  const param = fnNode.params && fnNode.params[0];
  if (!param) return { active: false, hovered: false };

  let hasActive = false;
  let hasHovered = false;

  // ── Identifier parameter: (t) => t.active ──────────────────────────────────
  if (bTypes.isIdentifier(param)) {
    const paramName = param.name;

    function traverseBody(node, isNested) {
      if (!node || typeof node !== 'object') return;
      if (typeof node.type !== 'string') return;
      // Don't recurse into nested function bodies — only scan the outermost fn
      if (isNested && bTypes.isFunction(node)) return;

      if (
        bTypes.isMemberExpression(node) &&
        !node.computed &&
        bTypes.isIdentifier(node.object, { name: paramName })
      ) {
        if (bTypes.isIdentifier(node.property, { name: 'active' }))
          hasActive = true;
        if (bTypes.isIdentifier(node.property, { name: 'hovered' }))
          hasHovered = true;
      }

      // Recurse into child nodes
      for (const key of Object.keys(node)) {
        if (
          key === 'type' ||
          key === 'start' ||
          key === 'end' ||
          key === 'loc' ||
          key === 'extra' ||
          key === 'comments' ||
          key === 'leadingComments' ||
          key === 'trailingComments' ||
          key === 'innerComments'
        )
          continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach((c) => traverseBody(c, true));
        } else if (child && typeof child === 'object' && child.type) {
          traverseBody(child, true);
        }
      }
    }

    traverseBody(fnNode.body, false);

    // ── Destructured parameter: ({ active, colors }) => ──────────────────────
  } else if (bTypes.isObjectPattern(param)) {
    for (const prop of param.properties || []) {
      if (bTypes.isObjectProperty(prop) && bTypes.isIdentifier(prop.key)) {
        if (prop.key.name === 'active') hasActive = true;
        if (prop.key.name === 'hovered') hasHovered = true;
      }
    }
  }

  return { active: hasActive, hovered: hasHovered };
}

/**
 * Checks whether an expression (a function or an array of values) accesses
 * `t.active` or `t.hovered`.  Arrays are inspected element-by-element so
 * `style={[(t) => t.active ? {opacity: 0.7} : {opacity: 1}, styles.base]}`
 * is correctly flagged as interactive.
 *
 * @param {import('@babel/types').Expression} expr
 * @param {import('@babel/types')} bTypes
 * @returns {{ active: boolean, hovered: boolean }}
 */
function detectInteractionUsageInExpr(expr, bTypes) {
  if (
    bTypes.isArrowFunctionExpression(expr) ||
    bTypes.isFunctionExpression(expr)
  ) {
    return detectInteractionUsage(expr, bTypes);
  }

  if (bTypes.isArrayExpression(expr)) {
    let active = false;
    let hovered = false;
    for (const elem of expr.elements || []) {
      if (!elem) continue;
      const result = detectInteractionUsageInExpr(elem, bTypes);
      active = active || result.active;
      hovered = hovered || result.hovered;
    }
    return { active, hovered };
  }

  return { active: false, hovered: false };
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

        // Skip internal __LayoutView / __InteractiveView props — these are
        // injected by the plugin itself and must never be re-processed.
        if (attrName.startsWith('__')) return;

        const isStyleProp = attrName === 'style' || attrName.endsWith('Style');

        // =====================================================================
        // INTERACTION DETECTION — t.pressed / t.hovered
        //
        // Before doing any normal processing, check whether this attribute's
        // function body references t.pressed or t.hovered.  If it does:
        //   1. Mark the parent JSXElement for __InteractiveView transformation.
        //   2. Store the raw expression so JSXElement.exit can use it.
        //   3. Return early — the attribute is intentionally left as a raw
        //      (un-resolved) function; JSXElement.exit will remove it from
        //      the element and re-emit it as __styleFn / __propFns.
        // =====================================================================
        const shouldCheckInteraction = isStyleProp || !isCallbackProp(attrName);

        if (
          shouldCheckInteraction &&
          (t.isArrowFunctionExpression(expr) ||
            t.isFunctionExpression(expr) ||
            t.isArrayExpression(expr))
        ) {
          const usage = detectInteractionUsageInExpr(expr, t);

          if (usage.active || usage.hovered) {
            const jsxElementPath = path.findParent((p) => p.isJSXElement());
            if (jsxElementPath) {
              // Bail out if this element also has function-children (those
              // would normally be transformed to __LayoutView).  The two
              // wrapper patterns cannot be combined in a single pass, so we
              // fall back to the non-interactive path for this element.
              const children = jsxElementPath.node.children;
              const hasFnChild = children.some(
                (child) =>
                  t.isJSXExpressionContainer(child) &&
                  (t.isArrowFunctionExpression(child.expression) ||
                    t.isFunctionExpression(child.expression))
              );
              if (hasFnChild) {
                // Fall through to normal processing below
              } else {
                // ── Mark the parent element ───────────────────────────────
                if (!state.__interactiveElements) {
                  state.__interactiveElements = new Map();
                }

                const elementNode = jsxElementPath.node;
                if (!state.__interactiveElements.has(elementNode)) {
                  state.__interactiveElements.set(elementNode, {
                    active: false,
                    hovered: false,
                    // The raw style function (only for attrName === 'style')
                    styleFn: null,
                    // Raw functions for all other interactive props
                    propFns: {},
                    // Names of attributes captured here (to filter out later)
                    capturedAttrNames: new Set(),
                  });
                }

                const info = state.__interactiveElements.get(elementNode);
                info.active = info.active || usage.active;
                info.hovered = info.hovered || usage.hovered;

                if (isStyleProp && attrName === 'style') {
                  info.styleFn = expr;
                } else {
                  // contentContainerStyle, accessibilityState, etc.
                  info.propFns[attrName] = expr;
                }
                info.capturedAttrNames.add(attrName);

                // Leave the attribute as-is in the AST (not removed here).
                // JSXElement.exit will filter it out by capturedAttrNames and
                // move it to __styleFn / __propFns on __InteractiveView.
                return;
              }
            }
          }
        }

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
      // JSXElement exit — two transforms handled here:
      //
      // 1. __InteractiveView transform (NEW)
      //    When the element has style/prop functions that reference t.pressed
      //    or t.hovered (detected above in JSXAttribute), replace it with:
      //      <__InteractiveView __type={Original} __styleFn={fn} __needsPressed />
      //
      // 2. __LayoutView transform (existing)
      //    When the element has function children, replace it with:
      //      <__LayoutView __type={Original} __childFn={fn} ...attrs />
      //
      // __InteractiveView runs first.  If an element needs BOTH (interactive
      // style + function children), the interactive transform is skipped
      // (see the bail-out in JSXAttribute above) and only __LayoutView applies.
      // =======================================================================
      JSXElement: {
        exit(path, state) {
          const filename = state.filename || '';
          if (shouldSkip(filename)) return;

          const openingElement = path.node.openingElement;
          const elementName = openingElement.name;

          // Guard: never re-process already-wrapped elements (avoids infinite
          // re-traversal that path.replaceWith() triggers in an exit hook).
          if (t.isJSXIdentifier(elementName)) {
            if (
              elementName.name === LAYOUT_VIEW_FN ||
              elementName.name === INTERACTIVE_VIEW_FN
            ) {
              return;
            }
          }

          // =================================================================
          // 1. __InteractiveView transform
          // =================================================================
          if (
            state.__interactiveElements &&
            state.__interactiveElements.has(path.node)
          ) {
            const info = state.__interactiveElements.get(path.node);

            // Build the leading __InteractiveView-specific attributes
            const interactiveAttrs = [
              // __type={OriginalComponent}
              t.jsxAttribute(
                t.jsxIdentifier('__type'),
                t.jsxExpressionContainer(jsxNameToExpression(t, elementName))
              ),
            ];

            // __needsActive  (boolean attribute — no value)
            if (info.active) {
              interactiveAttrs.push(
                t.jsxAttribute(t.jsxIdentifier('__needsActive'))
              );
            }

            // __needsHovered
            if (info.hovered) {
              interactiveAttrs.push(
                t.jsxAttribute(t.jsxIdentifier('__needsHovered'))
              );
            }

            // __styleFn={rawStyleFn}  — only for the main `style` attribute
            if (info.styleFn !== null) {
              interactiveAttrs.push(
                t.jsxAttribute(
                  t.jsxIdentifier('__styleFn'),
                  t.jsxExpressionContainer(info.styleFn)
                )
              );
            }

            // __propFns={{ attrName: rawFn, ... }}  — all other interactive props
            if (Object.keys(info.propFns).length > 0) {
              const propFnsObj = t.objectExpression(
                Object.entries(info.propFns).map(([key, fn]) =>
                  t.objectProperty(t.identifier(key), fn)
                )
              );
              interactiveAttrs.push(
                t.jsxAttribute(
                  t.jsxIdentifier('__propFns'),
                  t.jsxExpressionContainer(propFnsObj)
                )
              );
            }

            // Remaining (non-interactive, already-processed) attributes.
            // The captured interactive attributes are excluded here because
            // they were intentionally left as raw expressions in the AST and
            // are now re-emitted via __styleFn / __propFns above.
            const remainingAttrs = openingElement.attributes.filter((attr) => {
              if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name))
                return true;
              return !info.capturedAttrNames.has(attr.name.name);
            });

            const allAttrs = [...interactiveAttrs, ...remainingAttrs];
            const children = path.node.children;

            const newElement =
              children.length === 0
                ? t.jsxElement(
                    t.jsxOpeningElement(
                      t.jsxIdentifier(INTERACTIVE_VIEW_FN),
                      allAttrs,
                      true // self-closing
                    ),
                    null,
                    [],
                    true
                  )
                : t.jsxElement(
                    t.jsxOpeningElement(
                      t.jsxIdentifier(INTERACTIVE_VIEW_FN),
                      allAttrs,
                      false
                    ),
                    t.jsxClosingElement(t.jsxIdentifier(INTERACTIVE_VIEW_FN)),
                    sanitizeJSXChildren(t, children),
                    false
                  );

            path.replaceWith(newElement);

            const programPath =
              state.__programPath || path.findParent((p) => p.isProgram());
            ensureImport(programPath, state, INTERACTIVE_VIEW_FN);
            return; // Done — don't fall through to __LayoutView check
          }

          // =================================================================
          // 2. __LayoutView transform (existing behavior — unchanged)
          // =================================================================

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
              sanitizeJSXChildren(t, otherChildren),
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
