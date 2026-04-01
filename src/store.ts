import type { StyleTokens, CustomTokens } from './types';
import { defaultTheme, defaultCSSVariables } from './config/defaults';
import { createBreakpointQuery } from './tokens/breakpoint';
import { defaultDevice } from './tokens/device';
import { evaluateCalc } from './units';
import { alpha, createColorsProxy } from './tokens/alpha';

/**
 * Static fallback tokens — no native API calls at module init time.
 * These are replaced by real values once StyleProvider mounts.
 *
 * Merge priority (lowest → highest):
 * 1. Default CSS color variables (built-in fallbacks)
 * 2. Default theme colors (from defaultTheme)
 */
const fallbackColors: Record<string, string> = {
  ...defaultCSSVariables.light,
  ...(defaultTheme.colors as Record<string, string>),
};

const fallbackScreen = { width: 375, height: 812, scale: 2, fontScale: 1 };

const DEFAULT_INLINE_REM = 16;

const fallbackTokens: StyleTokens = {
  theme: {
    spacing: defaultTheme.spacing,
    fontSize: defaultTheme.fontSize,
    borderRadius: defaultTheme.borderRadius,
    fontWeight: defaultTheme.fontWeight,
    colors: fallbackColors,
    shadows: defaultTheme.shadows ?? {},
    opacity: defaultTheme.opacity,
  } as StyleTokens['theme'],
  colors: createColorsProxy(fallbackColors) as StyleTokens['colors'],
  dark: false,
  colorScheme: 'light',
  breakpoint: createBreakpointQuery(fallbackScreen.width, defaultTheme.screens),
  screen: fallbackScreen,
  orientation: { landscape: false, portrait: true },
  platform: {
    ios: true,
    android: false,
    web: false,
    windows: false,
    macos: false,
  },
  device: defaultDevice,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  reducedMotion: false,
  fontScale: 1,
  boldText: false,
  highContrast: false,
  vw: (v: number) => (v / 100) * fallbackScreen.width,
  vh: (v: number) => (v / 100) * fallbackScreen.height,
  calc: (expr: string) =>
    evaluateCalc(expr, fallbackScreen, DEFAULT_INLINE_REM),
  rem: (v: number) => v * DEFAULT_INLINE_REM,
  inlineRem: DEFAULT_INLINE_REM,
  width: fallbackScreen.width,
  height: fallbackScreen.height,
  active: false,
  hovered: false,
  alpha,
  custom: {} as CustomTokens & Record<string, unknown>,
};

/**
 * Singleton token store — synchronously readable from anywhere.
 */
let _store: StyleTokens = fallbackTokens;

/**
 * Get the current token store.
 */
export const getTokenStore = (): StyleTokens => _store;

/**
 * Update the token store (called by StyleProvider whenever device state changes).
 */
export const setTokenStore = (tokens: StyleTokens): void => {
  _store = tokens;
};

/**
 * Listeners for store changes (used by hooks).
 */
type StoreListener = (tokens: StyleTokens) => void;
const _listeners = new Set<StoreListener>();

export const subscribeTokenStore = (listener: StoreListener): (() => void) => {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
};

export const notifyTokenStoreListeners = (): void => {
  const current = _store;
  _listeners.forEach((listener) => listener(current));
};

/**
 * Manual dark mode override store.
 */
let _manualDark: boolean | null = null;

export const getManualDark = (): boolean | null => _manualDark;
export const setManualDark = (value: boolean | null): void => {
  _manualDark = value;
};

// =============================================================================
// Custom token injection store
//
// Multiple components can inject different custom tokens simultaneously.
// Each injector is tracked by a unique numeric ID so cleanup on unmount
// only removes that component's contribution.
//
// The merged result of all active injections is always reflected as
// `t.custom` in the token store.
// =============================================================================

/** Per-injector custom token slices, keyed by injector ID */
const _customSlices = new Map<number, Record<string, unknown>>();

/** Auto-incrementing ID for each useTokenInjection instance */
let _customIdCounter = 0;

/**
 * Allocate a new unique injector ID.
 * Called once per `useTokenInjection` mount.
 */
export const allocCustomTokenId = (): number => ++_customIdCounter;

/**
 * Return the merged custom tokens from all active injectors.
 * Later-allocated IDs win for duplicate keys (insertion-order wins).
 */
export const getCustomTokens = (): CustomTokens & Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  _customSlices.forEach((slice) => {
    Object.assign(merged, slice);
  });
  return merged as CustomTokens & Record<string, unknown>;
};

/**
 * Update (or add) the custom token slice for a given injector ID,
 * then patch the live store and notify listeners.
 */
export const setCustomTokens = (
  id: number,
  tokens: Record<string, unknown>
): void => {
  _customSlices.set(id, tokens);
  _applyCustomTokensToStore();
};

/**
 * Remove the custom token slice for a given injector ID (called on unmount),
 * then patch the live store and notify listeners.
 */
export const removeCustomTokens = (id: number): void => {
  _customSlices.delete(id);
  _applyCustomTokensToStore();
};

// =============================================================================
// Custom-token-only subscription
//
// Separate from the main token store subscription so that components
// auto-subscribed by the Babel plugin (__subscribeStyleFn) only re-render
// when *custom* tokens change — not on every StyleProvider update (dark mode,
// orientation, breakpoints, etc.).
//
// StyleProvider-driven changes already propagate naturally via React's tree
// re-render; the extra subscription is only needed for useTokenInjection
// updates that happen outside the Provider's render cycle.
// =============================================================================

/** Listeners notified only when custom tokens change */
const _customListeners = new Set<StoreListener>();

export const subscribeCustomTokenStore = (
  listener: StoreListener
): (() => void) => {
  _customListeners.add(listener);
  return () => {
    _customListeners.delete(listener);
  };
};

/** Snapshot selector for custom-only subscription */
export const getCustomTokenSnapshot = (): StyleTokens => _store;

/**
 * Rebuild `_store.custom` from all active slices and notify listeners.
 * Called after every set/remove operation.
 *
 * - Fires the full-store listeners (for useStyleFn hooks)
 * - Also fires the custom-only listeners (for __subscribeStyleFn hooks)
 */
function _applyCustomTokensToStore(): void {
  _store = { ..._store, custom: getCustomTokens() };
  // Notify full-store listeners (useStyleFn(), useTokenInjection internals)
  notifyTokenStoreListeners();
  // Notify custom-only listeners (__subscribeStyleFn — avoids StyleProvider cascade)
  const current = _store;
  _customListeners.forEach((listener) => listener(current));
}
