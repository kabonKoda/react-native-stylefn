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
 * Breakpoint names derived from screen width.
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Device orientation.
 */
export type Orientation = 'portrait' | 'landscape';

/**
 * Color scheme.
 */
export type ColorScheme = 'light' | 'dark';

/**
 * Platform identifier.
 */
export type PlatformOS = 'ios' | 'android' | 'web';

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

  /** Current responsive breakpoint */
  breakpoint: Breakpoint;

  /** Screen dimensions */
  screen: ScreenInfo;

  /** Device orientation */
  orientation: Orientation;

  /** Current platform */
  platform: PlatformOS;

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
