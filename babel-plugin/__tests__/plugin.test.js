/**
 * Tests for babel-plugin-react-native-stylefn.
 *
 * Two test suites:
 *  1. Structural sanity checks (no @babel/core required)
 *  2. Code-transformation tests using @babel/core + @babel/preset-react
 */

const plugin = require('../index');

// =============================================================================
// Suite 1 — Structural sanity checks
// =============================================================================

describe('babel-plugin-react-native-stylefn — structure', () => {
  it('exports a valid babel plugin function', () => {
    expect(typeof plugin).toBe('function');
    const result = plugin({ types: {} });
    expect(result).toHaveProperty('name', 'react-native-stylefn');
    expect(result).toHaveProperty('visitor');
  });

  it('has a Program visitor for auto-injection', () => {
    const result = plugin({ types: {} });
    expect(result.visitor).toHaveProperty('Program');
  });

  it('has a JSXAttribute visitor', () => {
    const result = plugin({ types: {} });
    expect(result.visitor).toHaveProperty('JSXAttribute');
  });

  it('has a JSXElement visitor', () => {
    const result = plugin({ types: {} });
    expect(result.visitor).toHaveProperty('JSXElement');
  });

  it('has a JSXExpressionContainer visitor', () => {
    const result = plugin({ types: {} });
    expect(result.visitor).toHaveProperty('JSXExpressionContainer');
  });
});

// =============================================================================
// Suite 2 — Detection helper unit tests (direct function access)
// =============================================================================

/**
 * We extract the internal detection helpers indirectly by invoking the plugin
 * with real @babel/types so we can test them via transform outputs.
 */

let transformSync;
let babelAvailable = false;

try {
  transformSync = require('@babel/core').transformSync;
  babelAvailable = true;
} catch {
  // @babel/core not available — skip transform tests
}

const describeIfBabel = babelAvailable ? describe : describe.skip;

/**
 * Transforms a JSX snippet using the plugin under test.
 * Uses a fake filename outside node_modules so shouldSkip() passes.
 */
function transform(code, filename = '/project/src/Component.tsx') {
  const result = transformSync(code, {
    filename,
    plugins: [plugin],
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    configFile: false,
    babelrc: false,
  });
  return result ? result.code : '';
}

describeIfBabel('babel-plugin-react-native-stylefn — transforms', () => {
  // ---------------------------------------------------------------------------
  // Non-interactive style functions — existing behavior unchanged
  // ---------------------------------------------------------------------------

  describe('non-interactive style (no t.active / t.hovered)', () => {
    it('wraps a style function with __resolveStyle', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ flex: 1, color: t.colors.primary })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__resolveStyle');
      expect(output).not.toContain('__InteractiveView');
    });

    it('wraps a non-style token prop with __resolveProp', () => {
      const code = `
        function Comp() {
          return <View accessible={(t) => t.dark} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__resolveProp');
      expect(output).not.toContain('__InteractiveView');
    });

    it('leaves plain object styles unwrapped', () => {
      const code = `
        function Comp() {
          return <View style={{ flex: 1 }} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__resolveStyle');
      expect(output).not.toContain('__InteractiveView');
    });
  });

  // ---------------------------------------------------------------------------
  // t.active detection (replaces old t.pressed)
  // ---------------------------------------------------------------------------

  describe('t.active detection', () => {
    it('wraps element with __InteractiveView when style uses t.active', () => {
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).not.toContain('__resolveStyle');
    });

    it('emits __needsActive on the wrapper element', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__needsActive');
    });

    it('does NOT emit the old __needsPressed attribute', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__needsPressed');
    });

    it('passes the raw style function as __styleFn', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__styleFn');
    });

    it('passes the original component as __type', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__type: View');
    });

    it('imports __InteractiveView from react-native-stylefn', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('react-native-stylefn');
    });

    it('does NOT emit __needsHovered for t.active-only styles', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__needsHovered');
    });

    it('detects t.active via destructured parameter', () => {
      const code = `
        function Comp() {
          return <View style={({ active }) => ({ opacity: active ? 0.7 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsActive');
    });

    it('detects t.active in an array style', () => {
      const code = `
        function Comp() {
          return (
            <View style={[(t) => ({ opacity: t.active ? 0.7 : 1 }), styles.base]} />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsActive');
      expect(output).toContain('__styleFn');
    });

    it('passes through non-interactive props unchanged', () => {
      const code = `
        function Comp() {
          return (
            <View
              accessible={true}
              style={(t) => ({ opacity: t.active ? 0.7 : 1 })}
            />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      // accessible={true} is a plain boolean — should be passed through
      expect(output).toContain('accessible: true');
    });

    it('wraps non-interactive token prop functions normally when also has t.active style', () => {
      const code = `
        function Comp() {
          return (
            <View
              style={(t) => ({ opacity: t.active ? 0.7 : 1 })}
              accessible={(t) => t.dark}
            />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      // accessible is not interactive — should be resolved with __resolveProp
      expect(output).toContain('__resolveProp');
    });

    it('works on Text components (not just View)', () => {
      const code = `
        function Comp() {
          return <Text style={(t) => ({ color: t.active ? '#fff' : t.colors.text })} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsActive');
      expect(output).toContain('__type: Text');
    });
  });

  // ---------------------------------------------------------------------------
  // t.hovered detection
  // ---------------------------------------------------------------------------

  describe('t.hovered detection', () => {
    it('wraps element with __InteractiveView when style uses t.hovered', () => {
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ backgroundColor: t.hovered ? 'blue' : 'red' })} />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsHovered');
    });

    it('does NOT emit __needsActive for t.hovered-only styles', () => {
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ backgroundColor: t.hovered ? 'blue' : 'red' })} />
          );
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__needsActive');
    });

    it('does NOT emit the old __needsPressed for t.hovered-only styles', () => {
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ backgroundColor: t.hovered ? 'blue' : 'red' })} />
          );
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__needsPressed');
    });

    it('detects t.hovered via destructured parameter', () => {
      const code = `
        function Comp() {
          return (
            <View style={({ hovered }) => ({ backgroundColor: hovered ? 'blue' : 'red' })} />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsHovered');
    });
  });

  // ---------------------------------------------------------------------------
  // Combined t.active + t.hovered
  // ---------------------------------------------------------------------------

  describe('combined t.active + t.hovered', () => {
    it('emits both __needsActive and __needsHovered', () => {
      const code = `
        function Comp() {
          return (
            <View
              style={(t) => ({
                opacity: t.active ? 0.7 : 1,
                backgroundColor: t.hovered ? 'blue' : 'red',
              })}
            />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsActive');
      expect(output).toContain('__needsHovered');
    });

    it('works when active and hovered are in separate style functions in an array', () => {
      const code = `
        function Comp() {
          return (
            <View
              style={[
                (t) => ({ opacity: t.active ? 0.7 : 1 }),
                (t) => ({ backgroundColor: t.hovered ? 'blue' : 'red' }),
              ]}
            />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__needsActive');
      expect(output).toContain('__needsHovered');
    });
  });

  // ---------------------------------------------------------------------------
  // Non-style interactive props
  // ---------------------------------------------------------------------------

  describe('non-style interactive props', () => {
    it('captures accessibilityState referencing t.active in __propFns', () => {
      const code = `
        function Comp() {
          return (
            <View accessibilityState={(t) => ({ selected: t.active })} />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__propFns');
      expect(output).toContain('__needsActive');
    });

    it('handles both interactive style and interactive non-style prop', () => {
      const code = `
        function Comp() {
          return (
            <View
              style={(t) => ({ opacity: t.active ? 0.7 : 1 })}
              accessibilityState={(t) => ({ selected: t.active })}
            />
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__InteractiveView');
      expect(output).toContain('__styleFn');
      expect(output).toContain('__propFns');
      expect(output).toContain('__needsActive');
    });
  });

  // ---------------------------------------------------------------------------
  // Interaction NOT triggered (false positives avoided)
  // ---------------------------------------------------------------------------

  describe('false-positive prevention', () => {
    it('does not trigger on t.platform.ios (unrelated member chain)', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ opacity: t.platform.ios ? 0.5 : 1 })} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__InteractiveView');
      expect(output).toContain('__resolveStyle');
    });

    it('does not trigger on a plain object style prop', () => {
      const code = `
        function Comp() {
          return <View style={{ opacity: 1 }} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__InteractiveView');
    });

    it('does not trigger on callback props (onPress)', () => {
      const code = `
        function Comp() {
          return <View onPress={() => console.log('pressed')} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__InteractiveView');
    });

    it('does not misdetect nested function that uses a local variable named active', () => {
      // The inner callback inside the style fn uses 'active' — but it's
      // a local variable name in a different scope, NOT t.active.
      const code = `
        function Comp() {
          return (
            <View
              style={(t) => ({
                opacity: ['a'].map((active) => active ? 0.7 : 1)[0],
              })}
            />
          );
        }
      `;
      const output = transform(code);
      // 'active' appears in a nested arrow fn's param, not as t.active.
      // The plugin should NOT detect this as interactive.
      expect(output).not.toContain('__InteractiveView');
      expect(output).toContain('__resolveStyle');
    });

    it('does not trigger for t.dark (non-interaction token)', () => {
      const code = `
        function Comp() {
          return <View style={(t) => ({ backgroundColor: t.dark ? '#000' : '#fff' })} />;
        }
      `;
      const output = transform(code);
      expect(output).not.toContain('__InteractiveView');
      expect(output).toContain('__resolveStyle');
    });
  });

  // ---------------------------------------------------------------------------
  // Elements with function children — __LayoutView takes precedence
  // ---------------------------------------------------------------------------

  describe('function children (should remain __LayoutView, not __InteractiveView)', () => {
    it('uses __LayoutView for function children, not __InteractiveView', () => {
      const code = `
        function Comp() {
          return (
            <View>
              {({ layout }) => <Text>{layout.width}</Text>}
            </View>
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__LayoutView');
      expect(output).not.toContain('__InteractiveView');
    });

    it('falls back to __LayoutView when element has BOTH t.active style and function children', () => {
      // The Babel plugin cannot combine both transforms in one pass.
      // It falls back to the normal __LayoutView path (t.active style gets
      // wrapped with __resolveStyle, where active is always false from
      // the global store).
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })}>
              {({ layout }) => <Text>{layout.width}</Text>}
            </View>
          );
        }
      `;
      const output = transform(code);
      expect(output).toContain('__LayoutView');
      expect(output).not.toContain('__InteractiveView');
    });
  });

  // ---------------------------------------------------------------------------
  // sanitizeJSXChildren — NativeWind / pre-transformed child compatibility
  //
  // Simulates a third-party Babel plugin (e.g. NativeWind) that runs BEFORE
  // react-native-stylefn and transforms some JSX children from JSXElement
  // nodes into raw CallExpression nodes.  Without sanitizeJSXChildren, Babel's
  // own AST validator would throw:
  //   "children[N] of JSXElement … got CallExpression"
  // ---------------------------------------------------------------------------

  describe('sanitizeJSXChildren — pre-transformed child compat', () => {
    /**
     * A minimal "pre-transform" plugin that replaces every direct JSXElement
     * child of a container <View> with a CallExpression node — exactly what
     * NativeWind does when it wraps styled components.
     */
    function makePreTransformPlugin(babelCore) {
      const t = babelCore.types;
      return {
        visitor: {
          JSXElement: {
            exit(path) {
              const opening = path.node.openingElement;
              if (!t.isJSXIdentifier(opening.name)) return;
              // Target the container View only (not nested elements)
              if (opening.name.name !== 'View') return;

              const newChildren = path.node.children.map((child) => {
                if (t.isJSXElement(child)) {
                  // Simulate NativeWind wrapping styled component call:
                  //   <Text>Hi</Text>  →  styledText({...})
                  return t.callExpression(t.identifier('styledText'), [child]);
                }
                return child;
              });
              path.node.children = newChildren;
            },
          },
        },
      };
    }

    /**
     * Transforms code with the pre-transform plugin running FIRST (simulating
     * NativeWind) and then the stylefn plugin.
     */
    function transformWithPrePlugin(code) {
      const babel = require('@babel/core');
      const prePlugin = ({ types }) => makePreTransformPlugin({ types });

      return babel.transformSync(code, {
        filename: '/project/src/Component.tsx',
        plugins: [prePlugin, plugin],
        presets: [['@babel/preset-react', { runtime: 'classic' }]],
        configFile: false,
        babelrc: false,
      });
    }

    it('does not throw when __InteractiveView has pre-transformed CallExpression children', () => {
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })}>
              <Text>Hello</Text>
            </View>
          );
        }
      `;
      expect(() => transformWithPrePlugin(code)).not.toThrow();
    });

    it('still wraps with __InteractiveView when children contain CallExpression nodes', () => {
      const code = `
        function Comp() {
          return (
            <View style={(t) => ({ opacity: t.active ? 0.7 : 1 })}>
              <Text>Hello</Text>
            </View>
          );
        }
      `;
      const result = transformWithPrePlugin(code);
      expect(result).not.toBeNull();
      expect(result.code).toContain('__InteractiveView');
      expect(result.code).toContain('__needsActive');
    });

    it('does not throw when __LayoutView has pre-transformed CallExpression sibling children', () => {
      const code = `
        function Comp() {
          return (
            <View>
              {({ layout }) => <Inner width={layout.width} />}
              <Text>Static sibling</Text>
            </View>
          );
        }
      `;
      expect(() => transformWithPrePlugin(code)).not.toThrow();
    });

    it('still produces __LayoutView when sibling children contain CallExpression nodes', () => {
      const code = `
        function Comp() {
          return (
            <View>
              {({ layout }) => <Inner width={layout.width} />}
              <Text>Static sibling</Text>
            </View>
          );
        }
      `;
      const result = transformWithPrePlugin(code);
      expect(result).not.toBeNull();
      expect(result.code).toContain('__LayoutView');
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-import injection
  // ---------------------------------------------------------------------------

  describe('auto-import injection', () => {
    it('injects react-native-stylefn/auto import', () => {
      const code = `
        function Comp() {
          return <View style={{ flex: 1 }} />;
        }
      `;
      const output = transform(code);
      expect(output).toContain('react-native-stylefn/auto');
    });

    it('does not inject auto import when already present', () => {
      const code = `
        import 'react-native-stylefn/auto';
        function Comp() {
          return <View style={{ flex: 1 }} />;
        }
      `;
      const output = transform(code);
      const count = (output.match(/react-native-stylefn\/auto/g) || []).length;
      expect(count).toBe(1);
    });
  });
});
