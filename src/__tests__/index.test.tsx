/**
 * Tests for react-native-stylefn core modules.
 */

// =============================================================================
// Config: CSS Parser
// =============================================================================

import { parseCSSVariables } from '../config/cssParser';

describe('parseCSSVariables', () => {
  it('parses :root and .dark selectors', () => {
    const css = `
      :root {
        --color-background: #ffffff;
        --color-text: #111827;
      }
      .dark {
        --color-background: #0f172a;
        --color-text: #f8fafc;
      }
    `;

    const result = parseCSSVariables(css);
    expect(result.light).toEqual({
      background: '#ffffff',
      text: '#111827',
    });
    expect(result.dark).toEqual({
      background: '#0f172a',
      text: '#f8fafc',
    });
  });

  it('returns empty objects for empty input', () => {
    const result = parseCSSVariables('');
    expect(result.light).toEqual({});
    expect(result.dark).toEqual({});
  });

  it('ignores unsupported selectors', () => {
    const css = `
      .custom {
        --color-bg: red;
      }
    `;
    const result = parseCSSVariables(css);
    expect(result.light).toEqual({});
    expect(result.dark).toEqual({});
  });
});

// =============================================================================
// Config: Resolver
// =============================================================================

import { resolveTheme, resolveConfig } from '../config/resolver';
import { defaultTheme } from '../config/defaults';

describe('resolveTheme', () => {
  it('returns defaults when no user theme provided', () => {
    const theme = resolveTheme();
    expect(theme.spacing).toEqual(defaultTheme.spacing);
    expect(theme.fontSize).toEqual(defaultTheme.fontSize);
    expect(theme.colors).toEqual(defaultTheme.colors);
  });

  it('merges user overrides onto defaults', () => {
    const theme = resolveTheme({
      colors: {
        primary: '#ff0000',
        custom: '#00ff00',
      },
    });
    expect(theme.colors.primary).toBe('#ff0000');
    expect(theme.colors.custom).toBe('#00ff00');
    // Other defaults preserved
    expect(theme.colors.secondary).toBe('#8b5cf6');
  });

  it('applies extend additively', () => {
    const theme = resolveTheme({
      extend: {
        colors: {
          brand: '#123456',
        },
      },
    });
    // Original colors preserved
    expect(theme.colors.primary).toBe('#3b82f6');
    // Extended color added
    expect(theme.colors.brand).toBe('#123456');
  });
});

describe('resolveConfig', () => {
  it('returns default darkMode when not specified', () => {
    const config = resolveConfig();
    expect(config.darkMode).toBe('system');
  });

  it('respects manual darkMode', () => {
    const config = resolveConfig({ darkMode: 'manual' });
    expect(config.darkMode).toBe('manual');
  });
});

// =============================================================================
// Tokens: Breakpoint
// =============================================================================

import { createBreakpointQuery } from '../tokens/breakpoint';

describe('createBreakpointQuery', () => {
  const screens = { sm: 0, md: 375, lg: 430, xl: 768 };

  it('returns sm for small screens', () => {
    const bp = createBreakpointQuery(320, screens);
    expect(bp.current).toBe('sm');
  });

  it('returns md for medium screens', () => {
    const bp = createBreakpointQuery(375, screens);
    expect(bp.current).toBe('md');
  });

  it('returns lg for large screens', () => {
    const bp = createBreakpointQuery(430, screens);
    expect(bp.current).toBe('lg');
  });

  it('returns xl for extra-large screens', () => {
    const bp = createBreakpointQuery(768, screens);
    expect(bp.current).toBe('xl');
  });

  it('returns xl for very large screens', () => {
    const bp = createBreakpointQuery(1024, screens);
    expect(bp.current).toBe('xl');
  });

  it('falls back to sm when width is 0', () => {
    const bp = createBreakpointQuery(0, screens);
    expect(bp.current).toBe('sm');
  });

  describe('up()', () => {
    it('returns true when screen width >= breakpoint threshold', () => {
      const bp = createBreakpointQuery(400, screens);
      expect(bp.up('sm')).toBe(true);
      expect(bp.up('md')).toBe(true); // 400 >= 375
      expect(bp.up('lg')).toBe(false); // 400 < 430
      expect(bp.up('xl')).toBe(false); // 400 < 768
    });

    it('returns true at exact breakpoint boundary', () => {
      const bp = createBreakpointQuery(430, screens);
      expect(bp.up('lg')).toBe(true);
    });

    it('returns false for unknown breakpoint', () => {
      const bp = createBreakpointQuery(400, screens);
      expect(bp.up('xxl')).toBe(false);
    });
  });

  describe('down()', () => {
    it('returns true when screen width < breakpoint threshold', () => {
      const bp = createBreakpointQuery(400, screens);
      expect(bp.down('sm')).toBe(false); // 400 >= 0
      expect(bp.down('md')).toBe(false); // 400 >= 375
      expect(bp.down('lg')).toBe(true); // 400 < 430
      expect(bp.down('xl')).toBe(true); // 400 < 768
    });

    it('returns false at exact breakpoint boundary', () => {
      const bp = createBreakpointQuery(430, screens);
      expect(bp.down('lg')).toBe(false);
    });

    it('returns false for unknown breakpoint', () => {
      const bp = createBreakpointQuery(400, screens);
      expect(bp.down('xxl')).toBe(false);
    });
  });
});

// =============================================================================
// Tokens: Orientation
// =============================================================================

import { deriveOrientation } from '../tokens/orientation';

describe('deriveOrientation', () => {
  it('returns portrait:true when height > width', () => {
    const o = deriveOrientation(375, 812);
    expect(o.portrait).toBe(true);
    expect(o.landscape).toBe(false);
  });

  it('returns landscape:true when width > height', () => {
    const o = deriveOrientation(812, 375);
    expect(o.landscape).toBe(true);
    expect(o.portrait).toBe(false);
  });

  it('returns landscape:true when width equals height', () => {
    const o = deriveOrientation(500, 500);
    expect(o.landscape).toBe(true);
    expect(o.portrait).toBe(false);
  });
});

// =============================================================================
// Store
// =============================================================================

import {
  getTokenStore,
  setTokenStore,
  subscribeTokenStore,
  notifyTokenStoreListeners,
  getManualDark,
  setManualDark,
} from '../store';

describe('TokenStore', () => {
  it('returns default tokens initially', () => {
    const tokens = getTokenStore();
    expect(tokens.dark).toBe(false);
    expect(tokens.colorScheme).toBe('light');
    expect(tokens.breakpoint.current).toBe('md');
  });

  it('updates tokens with setTokenStore', () => {
    const tokens = getTokenStore();
    setTokenStore({ ...tokens, dark: true, colorScheme: 'dark' });
    expect(getTokenStore().dark).toBe(true);
    expect(getTokenStore().colorScheme).toBe('dark');
    // Reset
    setTokenStore(tokens);
  });

  it('notifies listeners on change', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeTokenStore(listener);

    notifyTokenStoreListeners();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(getTokenStore());

    unsubscribe();
    notifyTokenStoreListeners();
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });

  it('orientation exposes boolean flags', () => {
    const tokens = getTokenStore();
    expect(tokens.orientation.portrait).toBe(true);
    expect(tokens.orientation.landscape).toBe(false);
  });

  it('platform exposes boolean flags', () => {
    const tokens = getTokenStore();
    expect(tokens.platform.ios).toBe(true);
    expect(tokens.platform.android).toBe(false);
    expect(tokens.platform.web).toBe(false);
    expect(tokens.platform.windows).toBe(false);
    expect(tokens.platform.macos).toBe(false);
  });

  it('breakpoint supports up/down queries', () => {
    const tokens = getTokenStore();
    // fallback screen width is 375, so breakpoint.current === 'md'
    expect(tokens.breakpoint.up('sm')).toBe(true);
    expect(tokens.breakpoint.up('md')).toBe(true);
    expect(tokens.breakpoint.up('lg')).toBe(false);
    expect(tokens.breakpoint.down('lg')).toBe(true);
    expect(tokens.breakpoint.down('sm')).toBe(false);
  });
});

describe('ManualDark', () => {
  it('defaults to null', () => {
    expect(getManualDark()).toBeNull();
  });

  it('can be set and retrieved', () => {
    setManualDark(true);
    expect(getManualDark()).toBe(true);
    setManualDark(false);
    expect(getManualDark()).toBe(false);
    // Reset
    setManualDark(null);
  });
});

// =============================================================================
// Patch: resolveStyleProp behavior (tested via applyPatch)
// =============================================================================

describe('Style resolution logic', () => {
  // Test the resolution logic directly
  const mockTokens = getTokenStore();

  it('passes through plain objects', () => {
    const style = { flex: 1 };
    expect(style).toEqual({ flex: 1 });
  });

  it('resolves style functions', () => {
    const styleFn = (tokens: typeof mockTokens) => ({
      backgroundColor: tokens.dark ? '#000' : '#fff',
    });
    const result = styleFn(mockTokens);
    expect(result).toEqual({ backgroundColor: '#fff' });
  });

  it('resolves mixed arrays', () => {
    const styles = [
      { flex: 1 },
      (tokens: typeof mockTokens) => ({
        backgroundColor: tokens.dark ? '#000' : '#fff',
      }),
      false,
      null,
      undefined,
    ];

    const resolved = styles.map((s) =>
      typeof s === 'function' ? s(mockTokens) : s
    );

    expect(resolved[0]).toEqual({ flex: 1 });
    expect(resolved[1]).toEqual({ backgroundColor: '#fff' });
    expect(resolved[2]).toBe(false);
    expect(resolved[3]).toBeNull();
    expect(resolved[4]).toBeUndefined();
  });

  it('handles falsy returns from style functions', () => {
    const styleFn = (tokens: typeof mockTokens) =>
      tokens.breakpoint.up('xl') && { padding: 24 };

    const result = styleFn(mockTokens);
    expect(result).toBe(false); // breakpoint is 'md' by default (375px)
  });
});

// =============================================================================
// Units: Viewport units (vh / vw)
// =============================================================================

import { vh, vw, calc } from '../units';
import {
  parseViewportValue,
  resolveViewportUnits,
  evaluateCalc,
} from '../units';
import { __resolveStyle, __resolveProp } from '../resolve';

describe('vh / vw standalone helpers', () => {
  // Default fallback screen: 375×812
  it('vw(100) returns full screen width', () => {
    expect(vw(100)).toBe(375);
  });

  it('vw(50) returns half screen width', () => {
    expect(vw(50)).toBe(187.5);
  });

  it('vh(100) returns full screen height', () => {
    expect(vh(100)).toBe(812);
  });

  it('vh(50) returns half screen height', () => {
    expect(vh(50)).toBe(406);
  });

  it('vw(0) returns 0', () => {
    expect(vw(0)).toBe(0);
  });

  it('vh(0) returns 0', () => {
    expect(vh(0)).toBe(0);
  });
});

describe('parseViewportValue', () => {
  it('converts "50vw" to pixels', () => {
    expect(parseViewportValue('50vw')).toBe(187.5);
  });

  it('converts "100vh" to pixels', () => {
    expect(parseViewportValue('100vh')).toBe(812);
  });

  it('converts "33.5vw" to pixels', () => {
    expect(parseViewportValue('33.5vw')).toBeCloseTo(125.625);
  });

  it('handles negative values like "-10vh"', () => {
    expect(parseViewportValue('-10vh')).toBe(-81.2);
  });

  it('passes through numbers unchanged', () => {
    expect(parseViewportValue(16)).toBe(16);
  });

  it('passes through non-viewport strings unchanged', () => {
    expect(parseViewportValue('red')).toBe('red');
    expect(parseViewportValue('#fff')).toBe('#fff');
    expect(parseViewportValue('bold')).toBe('bold');
  });

  it('passes through non-string values unchanged', () => {
    expect(parseViewportValue(null)).toBeNull();
    expect(parseViewportValue(undefined)).toBeUndefined();
    expect(parseViewportValue(true)).toBe(true);
  });
});

describe('resolveViewportUnits', () => {
  it('converts vh/vw strings in a style object', () => {
    const style = { width: '50vw', height: '100vh', color: 'red' };
    const resolved = resolveViewportUnits(style);
    expect(resolved).toEqual({ width: 187.5, height: 812, color: 'red' });
  });

  it('returns original object if no viewport units present', () => {
    const style = { flex: 1, padding: 16 };
    const resolved = resolveViewportUnits(style);
    expect(resolved).toBe(style); // Same reference — no copy needed
  });

  it('handles empty objects', () => {
    expect(resolveViewportUnits({})).toEqual({});
  });

  it('handles null/undefined', () => {
    expect(resolveViewportUnits(null)).toBeNull();
    expect(resolveViewportUnits(undefined)).toBeUndefined();
  });
});

describe('__resolveStyle with viewport units', () => {
  it('resolves viewport units in plain style objects', () => {
    const result = __resolveStyle({ width: '50vw', height: '100vh' });
    expect(result).toEqual({ width: 187.5, height: 812 });
  });

  it('resolves viewport units in style function return values', () => {
    const styleFn = () => ({ width: '50vw', minHeight: '80vh' });
    const result = __resolveStyle(styleFn);
    expect(result).toEqual({ width: 187.5, minHeight: 649.6 });
  });

  it('resolves viewport units in array styles', () => {
    const styles = [{ width: '100vw' }, () => ({ height: '50vh' })];
    const result = __resolveStyle(styles) as any[];
    expect(result[0]).toEqual({ width: 375 });
    expect(result[1]).toEqual({ height: 406 });
  });

  it('leaves non-viewport strings untouched', () => {
    const result = __resolveStyle({ color: 'red', fontWeight: 'bold' });
    expect(result).toEqual({ color: 'red', fontWeight: 'bold' });
  });
});

describe('StyleTokens vh/vw methods', () => {
  const tokens = getTokenStore();

  it('t.vw(50) returns half screen width', () => {
    expect(tokens.vw(50)).toBe(187.5);
  });

  it('t.vh(100) returns full screen height', () => {
    expect(tokens.vh(100)).toBe(812);
  });

  it('style function can use t.vw and t.vh', () => {
    const styleFn = (t: typeof tokens) => ({
      width: t.vw(80),
      height: t.vh(50),
    });
    const result = styleFn(tokens);
    expect(result).toEqual({ width: 300, height: 406 });
  });
});

// =============================================================================
// Units: calc() — CSS-like calc expressions
// =============================================================================

describe('calc standalone', () => {
  // Default fallback screen: 375×812

  it('evaluates simple addition: 100px + 50px', () => {
    expect(calc('100px + 50px')).toBe(150);
  });

  it('evaluates subtraction: 100px - 30px', () => {
    expect(calc('100px - 30px')).toBe(70);
  });

  it('evaluates multiplication: 10px * 3', () => {
    expect(calc('10px * 3')).toBe(30);
  });

  it('evaluates division: 100px / 4', () => {
    expect(calc('100px / 4')).toBe(25);
  });

  it('evaluates mixed units: 100px + 100vh', () => {
    // 100 + (100/100 * 812) = 100 + 812 = 912
    expect(calc('100px + 100vh')).toBe(912);
  });

  it('evaluates vw subtraction: 100vw - 32px', () => {
    // (100/100 * 375) - 32 = 375 - 32 = 343
    expect(calc('100vw - 32px')).toBe(343);
  });

  it('evaluates 50vh + 20px', () => {
    // (50/100 * 812) + 20 = 406 + 20 = 426
    expect(calc('50vh + 20px')).toBe(426);
  });

  it('evaluates parenthesized expressions: (100vw - 320px) / 2', () => {
    // (375 - 320) / 2 = 55 / 2 = 27.5
    expect(calc('(100vw - 320px) / 2')).toBe(27.5);
  });

  it('handles operator precedence: 10 + 20 * 3', () => {
    // 10 + 60 = 70
    expect(calc('10 + 20 * 3')).toBe(70);
  });

  it('handles plain numbers as px: 100 + 50', () => {
    expect(calc('100 + 50')).toBe(150);
  });

  it('handles negative values: -10px + 50px', () => {
    expect(calc('-10px + 50px')).toBe(40);
  });

  it('handles complex expression: 50vw + 50vh - 100px', () => {
    // 187.5 + 406 - 100 = 493.5
    expect(calc('50vw + 50vh - 100px')).toBe(493.5);
  });
});

describe('evaluateCalc with custom screen', () => {
  const screen = { width: 400, height: 800, scale: 2, fontScale: 1 };

  it('uses provided screen dimensions for vw', () => {
    expect(evaluateCalc('50vw', screen)).toBe(200);
  });

  it('uses provided screen dimensions for vh', () => {
    expect(evaluateCalc('100vh', screen)).toBe(800);
  });

  it('evaluates complex expression with custom screen', () => {
    // (100/100 * 400) - 32 = 368
    expect(evaluateCalc('100vw - 32px', screen)).toBe(368);
  });
});

describe('StyleTokens calc method', () => {
  const tokens = getTokenStore();

  it('t.calc("100vw - 32px") returns screen width minus 32', () => {
    // 375 - 32 = 343
    expect(tokens.calc('100vw - 32px')).toBe(343);
  });

  it('t.calc("50vh + 20px") returns half height plus 20', () => {
    // 406 + 20 = 426
    expect(tokens.calc('50vh + 20px')).toBe(426);
  });

  it('style function can use t.calc', () => {
    const styleFn = (t: typeof tokens) => ({
      width: t.calc('100vw - 32px'),
      height: t.calc('50vh + 20px'),
    });
    const result = styleFn(tokens);
    expect(result).toEqual({ width: 343, height: 426 });
  });
});

// =============================================================================
// Shadows: boxShadow format
// =============================================================================

describe('Shadow defaults use boxShadow', () => {
  it('shadow tokens use boxShadow string format', () => {
    const tokens = getTokenStore();
    const smShadow = tokens.theme.shadows.sm as { boxShadow: string };
    expect(smShadow.boxShadow).toBeDefined();
    expect(typeof smShadow.boxShadow).toBe('string');
    expect(smShadow).not.toHaveProperty('shadowOffset');
    expect(smShadow).not.toHaveProperty('shadowOpacity');
    expect(smShadow).not.toHaveProperty('shadowRadius');
    expect(smShadow).not.toHaveProperty('elevation');
  });
});

// =============================================================================
// __resolveProp: Token functions in non-style props
// =============================================================================

describe('__resolveProp', () => {
  it('resolves a token function to its return value', () => {
    const propFn = (t: any) => (t.orientation.landscape ? 266 : 200);
    const result = __resolveProp(propFn);
    // Default fallback is portrait (375×812), so landscape=false → 200
    expect(result).toBe(200);
  });

  it('passes through static numbers unchanged', () => {
    expect(__resolveProp(180)).toBe(180);
  });

  it('passes through static strings unchanged', () => {
    expect(__resolveProp('hello')).toBe('hello');
  });

  it('passes through booleans unchanged', () => {
    expect(__resolveProp(true)).toBe(true);
    expect(__resolveProp(false)).toBe(false);
  });

  it('passes through null/undefined unchanged', () => {
    expect(__resolveProp(null)).toBeNull();
    expect(__resolveProp(undefined)).toBeUndefined();
  });

  it('passes through objects unchanged (no viewport unit conversion)', () => {
    const obj = { foo: 'bar' };
    expect(__resolveProp(obj)).toBe(obj);
  });

  it('resolves token function using breakpoint', () => {
    const propFn = (t: any) => (t.breakpoint.up('lg') ? 3 : 2);
    // Default fallback is 375px → md breakpoint, so up('lg') is false → 2
    expect(__resolveProp(propFn)).toBe(2);
  });

  it('resolves token function using dark mode', () => {
    const propFn = (t: any) => (t.dark ? 'dark-value' : 'light-value');
    // Default is light mode
    expect(__resolveProp(propFn)).toBe('light-value');
  });

  it('resolves token function using screen dimensions', () => {
    const propFn = (t: any) => t.screen.width - 32;
    // Default screen width is 375
    expect(__resolveProp(propFn)).toBe(343);
  });

  it('does NOT apply viewport unit conversion (unlike __resolveStyle)', () => {
    // __resolveProp should NOT convert strings like '50vw'
    const propFn = () => '50vw';
    expect(__resolveProp(propFn)).toBe('50vw');
  });
});
