// =============================================================================
// react-native-stylefn — Public API
// =============================================================================

// Core provider
export { StyleProvider } from './provider';
export type { StyleProviderProps } from './provider';

// Hooks
export { useTheme } from './hooks/useTheme';
export { useDark } from './hooks/useDark';

// Types — exported for consumers to use in their own code
export type {
  StyleTokens,
  StyleFunction,
  StyleProp,
  StyleFnConfig,
  ThemeConfig,
  CSSVariables,
  Breakpoint,
  Orientation,
  ColorScheme,
  PlatformOS,
  ScreenInfo,
  Insets,
  UseDarkReturn,
  RNStyle,
} from './types';

// Config utilities (for advanced usage)
export { resolveConfig, resolveTheme } from './config/resolver';
export { parseCSSVariables, loadCSSVariables } from './config/cssParser';
export { defaultTheme, defaultConfig, defaultCSSVariables } from './config/defaults';

// Token resolution (for advanced usage / testing)
export { resolveTokens } from './tokens';
export { deriveBreakpoint } from './tokens/breakpoint';
export { deriveOrientation } from './tokens/orientation';

// Store access (for advanced usage)
export { getTokenStore } from './store';

// Patch (for manual control)
export { applyPatch, isPatched } from './patch';

// StyleSheet.create replacement with full style function support
export { create } from './create';

// Style resolver (used by Babel plugin at compile time)
export { __resolveStyle } from './resolve';
