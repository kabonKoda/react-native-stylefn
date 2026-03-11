import type { ViewStyle, TextStyle, ImageStyle } from 'react-native';

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
  spacing: Record<string, number>;
  fontSize: Record<string, number>;
  borderRadius: Record<string, number>;
  fontWeight: Record<string, NonNullable<FontWeightValue>>;
  opacity: Record<string, number>;
  screens: Record<string, number>;
  colors: Record<string, string>;
  shadows?: Record<string, object>;
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
  light: Record<string, string>;
  dark: Record<string, string>;
}

/**
 * Breakpoint name.
 */
export type BreakpointName = string;

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
  /** Full resolved theme object */
  theme: {
    spacing: Record<string, number>;
    fontSize: Record<string, number>;
    borderRadius: Record<string, number>;
    fontWeight: Record<string, NonNullable<FontWeightValue>>;
    colors: Record<string, string>;
    shadows: Record<string, object>;
    opacity: Record<string, number>;
  };

  /** Resolved color palette for the current color scheme (from CSS vars + theme) */
  colors: Record<string, string>;

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
export type StyleFunction<S = RNStyle> = (tokens: StyleTokens) => S | false | null | undefined;

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
