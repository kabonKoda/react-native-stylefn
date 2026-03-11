import type { ViewStyle, TextStyle, ImageStyle } from 'react-native';

// =============================================================================
// Theme Key Registry — known keys for TypeScript autocomplete
//
// Extend via module augmentation to add autocomplete for your custom keys:
//
//   declare module 'react-native-stylefn' {
//     interface ThemeKeyRegistry {
//       spacing: '0' | '1' | '2' | ... | 'myCustomKey';
//       color: 'primary' | ... | 'my-brand';
//     }
//   }
// =============================================================================

/**
 * Registry of known theme keys. Each property is a string union of key names
 * that appear in the default theme or common configs.
 *
 * Users can extend this via module augmentation to get autocomplete for
 * custom keys defined in their rn-stylefn.config.js.
 */
export interface ThemeKeyRegistry {
  spacing: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12';
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  opacity: '0' | '25' | '50' | '75' | '100';
  shadow: 'sm' | 'md' | 'lg';
  color:
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'success'
    | 'warning'
    | 'background'
    | 'surface'
    | 'border'
    | 'text'
    | 'text-muted';
  breakpoint: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Helper type: provides autocomplete for known keys K while allowing any string.
 * The `& {}` trick widens string but preserves IDE autocompletion.
 */
type KnownKeys<K extends string, V> = { [P in K]: V } & Record<string, V>;

/**
 * A string type that shows autocomplete for K but accepts any string.
 */
type StringWithSuggestions<K extends string> = K | (string & {});

/**
 * Theme configuration shape — mirrors Tailwind's design token system.
 */
/**
 * Valid React Native font weight values.
 */
export type FontWeightValue =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | undefined;

export interface ThemeConfig {
  spacing: Record<string, number | string>;
  fontSize: Record<string, number | string>;
  borderRadius: Record<string, number | string>;
  fontWeight: Record<string, NonNullable<FontWeightValue>>;
  opacity: Record<string, number | string>;
  screens: Record<string, number>;
  colors: Record<string, string | Record<string, string>>;
  shadows?: Record<string, string | object>;
  /** Tailwind-compatible alias for shadows */
  boxShadow?: Record<string, string | object>;
  /** Border width tokens (e.g., { hairline: 0.5 }) */
  borderWidth?: Record<string, number | string>;
  extend?: Partial<Omit<ThemeConfig, 'extend'>>;
}

/**
 * User configuration file shape (rn-stylefn.config.js).
 */
export interface StyleFnConfig {
  theme?: Partial<ThemeConfig>;
  darkMode?: 'system' | 'manual';
}

/**
 * Parsed CSS variables from global.css.
 */
export interface CSSVariables {
  /** Color variables (--color-* prefix stripped) for backward compat with t.colors */
  light: Record<string, string>;
  dark: Record<string, string>;
  /** ALL CSS custom properties (-- prefix stripped, full name preserved) for var() resolution */
  rawVars?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}

/**
 * Breakpoint name — shows autocomplete for default breakpoints while accepting any string.
 */
export type BreakpointName = StringWithSuggestions<
  ThemeKeyRegistry['breakpoint']
>;

/**
 * Breakpoint object with up/down query methods.
 *
 * @example
 * ```tsx
 * t.breakpoint.up('md')   // true when screen >= md threshold
 * t.breakpoint.down('lg') // true when screen < lg threshold
 * t.breakpoint.current    // current breakpoint name, e.g. 'md'
 * ```
 */
export interface BreakpointQuery {
  /** The current active breakpoint name */
  current: BreakpointName;
  /** True when screen width >= the given breakpoint threshold */
  up: (name: BreakpointName) => boolean;
  /** True when screen width < the given breakpoint threshold */
  down: (name: BreakpointName) => boolean;
}

/**
 * Device orientation — boolean flags.
 *
 * @example
 * ```tsx
 * t.orientation.landscape // true when width >= height
 * t.orientation.portrait  // true when height > width
 * ```
 */
export interface OrientationTokens {
  landscape: boolean;
  portrait: boolean;
}

/**
 * Color scheme.
 */
export type ColorScheme = 'light' | 'dark';

/**
 * Platform boolean flags.
 *
 * @example
 * ```tsx
 * t.platform.ios     // true on iOS
 * t.platform.android // true on Android
 * t.platform.web     // true on Web
 * ```
 */
export interface PlatformTokens {
  ios: boolean;
  android: boolean;
  web: boolean;
  windows: boolean;
  macos: boolean;
}

/**
 * Screen dimensions info.
 */
export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}

/**
 * Safe area insets.
 */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The full token store shape injected into every style function.
 */
export interface StyleTokens {
  /**
   * Full resolved theme object.
   *
   * Known keys provide autocomplete (e.g. `theme.borderRadius['lg']`).
   * Custom keys from your config are also accessible as `theme.borderRadius['myKey']`.
   *
   * Extend `ThemeKeyRegistry` via module augmentation for custom key autocomplete.
   */
  theme: {
    spacing: KnownKeys<ThemeKeyRegistry['spacing'], number>;
    fontSize: KnownKeys<ThemeKeyRegistry['fontSize'], number>;
    borderRadius: KnownKeys<ThemeKeyRegistry['borderRadius'], number>;
    fontWeight: KnownKeys<
      ThemeKeyRegistry['fontWeight'],
      NonNullable<FontWeightValue>
    >;
    colors: KnownKeys<ThemeKeyRegistry['color'], string>;
    shadows: KnownKeys<ThemeKeyRegistry['shadow'], object>;
    opacity: KnownKeys<ThemeKeyRegistry['opacity'], number>;
  };

  /**
   * Resolved color palette for the current color scheme (from CSS vars + theme).
   * Known color keys provide autocomplete.
   */
  colors: KnownKeys<ThemeKeyRegistry['color'], string>;

  /** Whether dark mode is currently active */
  dark: boolean;

  /** Current color scheme */
  colorScheme: ColorScheme;

  /** Responsive breakpoint queries */
  breakpoint: BreakpointQuery;

  /** Screen dimensions */
  screen: ScreenInfo;

  /** Device orientation (boolean flags) */
  orientation: OrientationTokens;

  /** Current platform (boolean flags) */
  platform: PlatformTokens;

  /** Safe area insets */
  insets: Insets;

  /** Whether the user prefers reduced motion */
  reducedMotion: boolean;

  /** Current font scale multiplier */
  fontScale: number;

  /** Whether bold text is enabled (accessibility) */
  boldText: boolean;

  /** Whether high contrast is enabled (accessibility) */
  highContrast: boolean;

  /**
   * Convert a viewport-width value (0–100) to pixels.
   * @example `t.vw(50)` → half the screen width in pixels
   */
  vw: (value: number) => number;

  /**
   * Convert a viewport-height value (0–100) to pixels.
   * @example `t.vh(50)` → half the screen height in pixels
   */
  vh: (value: number) => number;

  /**
   * Evaluate a CSS-like calc expression with px, vh, vw units.
   * Supports +, -, *, / and parentheses.
   * @example `t.calc('100vw - 32px')` → screen width minus 32 pixels
   */
  calc: (expression: string) => number;
}

/**
 * A style value that can be a plain object or a function receiving tokens.
 */
export type RNStyle = ViewStyle | TextStyle | ImageStyle;

/**
 * Style function that receives tokens and returns a style object.
 */
export type StyleFunction<S = RNStyle> = (
  tokens: StyleTokens
) => S | false | null | undefined;

/**
 * A style prop value — can be a plain style, a style function, or an array of both.
 */
export type StyleProp<S = RNStyle> =
  | S
  | StyleFunction<S>
  | Array<S | StyleFunction<S> | false | null | undefined>
  | false
  | null
  | undefined;

/**
 * A prop value that can be either a static value or a function receiving tokens.
 *
 * Use this to type props in your own components that accept token functions.
 *
 * @example
 * ```tsx
 * interface MyComponentProps {
 *   width: PropFunction<number>;
 *   label: PropFunction<string>;
 *   visible?: PropFunction<boolean>;
 * }
 *
 * // Usage:
 * <MyComponent
 *   width={({ orientation }) => orientation.landscape ? 266 : 200}
 *   label={({ dark }) => dark ? 'Dark Mode' : 'Light Mode'}
 *   visible={({ breakpoint }) => breakpoint.up('md')}
 * />
 * ```
 */
export type PropFunction<T> = T | ((tokens: StyleTokens) => T);

/**
 * Parameters passed into the token resolver.
 */
export interface TokenResolverParams {
  colorScheme: ColorScheme;
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  fontScale: number;
  insets: Insets;
  reducedMotion: boolean;
  boldText: boolean;
  highContrast: boolean;
  config: StyleFnConfig;
  cssVars: CSSVariables;
}

/**
 * Theme hook return type (dark mode control).
 */
export interface UseThemeReturn {
  theme: boolean;
  setTheme: (value: boolean) => void;
  toggleTheme: () => void;
}
