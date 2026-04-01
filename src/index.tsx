// =============================================================================
// react-native-stylefn — Public API
// =============================================================================

// Core provider
export { StyleProvider } from './provider';
export type { StyleProviderProps } from './provider';

// Hooks
export { useStyleFn } from './hooks/useStyleFn';
export { useTheme } from './hooks/useTheme';
export { usePropsFn } from './hooks/usePropsFn';
export type { TokenProp } from './hooks/usePropsFn';
export { useTokenInjection } from './hooks/useTokenInjection';
// Per-component state observer hooks
// useStyleFn(id)       — full token store merged with component active/hovered/layout
// useLayoutFn(id)      — layout dimensions only { width, height }
// useInteractiveFn(id) — interaction state only { active, hovered }
export { useLayoutFn } from './hooks/useLayoutFn';
export { useInteractiveFn } from './hooks/useInteractiveFn';

// Per-component state registry types
export type { ComponentState, InteractiveState } from './componentRegistry';
// Registry utilities (for advanced / testing use)
export {
  registerComponent,
  unregisterComponent,
  getComponentState,
  subscribeComponentState,
} from './componentRegistry';

// Types — exported for consumers to use in their own code
export type {
  StyleTokens,
  ChildrenTokens,
  StyleFunction,
  StyleProp,
  StyleFnDimension,
  LooseStyle,
  StyleFnConfig,
  ThemeConfig,
  ThemeKeyRegistry,
  ThemeKeyOverrides,
  CSSVariables,
  BreakpointName,
  BreakpointQuery,
  OrientationTokens,
  ColorScheme,
  PlatformTokens,
  DeviceTokens,
  ScreenInfo,
  Insets,
  UseThemeReturn,
  RNStyle,
  PropFunction,
  ChildrenFunction,
  LayoutInfo,
  CustomTokens,
} from './types';

// Config utilities (for advanced usage)
export { resolveConfig, resolveTheme } from './config/resolver';
export { parseCSSVariables, loadCSSVariables } from './config/cssParser';
export {
  defaultTheme,
  defaultConfig,
  defaultCSSVariables,
} from './config/defaults';

// CSS expression resolution (for advanced usage)
export {
  containsCssExpression,
  resolveColorExpression,
  resolveNumericExpression,
  resolveShadowExpression,
  resolveCssExpression,
  flattenColors,
  resolveNumericMap,
  resolveColorMap,
  resolveShadowMap,
  getRawVarsForScheme,
} from './config/cssExpressionResolver';

// Token resolution (for advanced usage / testing)
export { resolveTokens } from './tokens';
export { createBreakpointQuery } from './tokens/breakpoint';
export { deriveOrientation } from './tokens/orientation';
export { derivePlatform } from './tokens/platform';
export { deriveDevice, defaultDevice } from './tokens/device';

// Store access (for advanced usage)
export { getTokenStore } from './store';

// Patch (for manual control)
export { applyPatch, isPatched } from './patch';

// StyleSheet.create replacement with full style function support
export { create } from './create';

// Unit helpers — pass '50vw' / '100vh' / '0.625rem' / '1/2' strings or use these functions
export { vh, vw, rem, calc, fraction } from './units';

// Style resolver (used by Babel plugin at compile time)
export { __resolveStyle } from './resolve';

// Prop resolver (used by Babel plugin for non-style token props)
export { __resolveProp } from './resolve';

// Children resolver (used by Babel plugin for function children / render children pattern)
export { __resolveChildren } from './resolve';

// Store subscription hook (injected by Babel plugin into components that use style/prop functions
// so they automatically re-render when tokens change, e.g. via useTokenInjection)
export { __subscribeStyleFn } from './resolve';

// Layout-aware wrapper (used by Babel plugin for children-as-function with layout measurement)
export { __LayoutView } from './layoutView';

// Interaction-aware wrapper (used by Babel plugin when style/prop functions reference t.active
// or t.hovered — auto-injects touch/mouse handlers and merges local state into token store)
export { __InteractiveView } from './interactiveView';
