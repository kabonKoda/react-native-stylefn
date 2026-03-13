import type { StyleTokens } from './types';
import { defaultTheme, defaultCSSVariables } from './config/defaults';
import { createBreakpointQuery } from './tokens/breakpoint';
import { defaultDevice } from './tokens/device';
import { evaluateCalc } from './units';

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
  colors: fallbackColors as StyleTokens['colors'],
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
