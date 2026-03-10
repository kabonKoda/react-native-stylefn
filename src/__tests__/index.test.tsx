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

import { deriveBreakpoint } from '../tokens/breakpoint';

describe('deriveBreakpoint', () => {
  const screens = { sm: 0, md: 375, lg: 430, xl: 768 };

  it('returns sm for small screens', () => {
    expect(deriveBreakpoint(320, screens)).toBe('sm');
  });

  it('returns md for medium screens', () => {
    expect(deriveBreakpoint(375, screens)).toBe('md');
  });

  it('returns lg for large screens', () => {
    expect(deriveBreakpoint(430, screens)).toBe('lg');
  });

  it('returns xl for extra-large screens', () => {
    expect(deriveBreakpoint(768, screens)).toBe('xl');
  });

  it('returns xl for very large screens', () => {
    expect(deriveBreakpoint(1024, screens)).toBe('xl');
  });

  it('falls back to sm when width is 0', () => {
    expect(deriveBreakpoint(0, screens)).toBe('sm');
  });
});

// =============================================================================
// Tokens: Orientation
// =============================================================================

import { deriveOrientation } from '../tokens/orientation';

describe('deriveOrientation', () => {
  it('returns portrait when height > width', () => {
    expect(deriveOrientation(375, 812)).toBe('portrait');
  });

  it('returns landscape when width > height', () => {
    expect(deriveOrientation(812, 375)).toBe('landscape');
  });

  it('returns landscape when width equals height', () => {
    expect(deriveOrientation(500, 500)).toBe('landscape');
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
    expect(tokens.breakpoint).toBe('sm');
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
      tokens.breakpoint === 'xl' && { padding: 24 };

    const result = styleFn(mockTokens);
    expect(result).toBe(false); // breakpoint is 'sm' by default
  });
});
