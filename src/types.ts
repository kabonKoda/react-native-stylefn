import type { ReactNode } from 'react';
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native';

// =============================================================================
// Theme Key Overrides — populated by stylefn.d.ts (auto-generated)
//
// The withStyleFn() metro config wrapper reads your rn-stylefn.config.js and
// global.css, then generates stylefn.d.ts (in node_modules/react-native-stylefn/) which augments this
// interface with the actual keys from your config. This gives you full
// TypeScript autocomplete for all your theme tokens.
//
// If no generated file exists, the defaults in ThemeKeyRegistry are used.
// =============================================================================

/**
 * Override interface — populated by the generated stylefn.d.ts
 * (in node_modules/react-native-stylefn/).
 * When empty (no generated file), ThemeKeyRegistry falls back to defaults.
 */
export interface ThemeKeyOverrides {}

/**
 * Conditional type: if ThemeKeyOverrides has property K, use its type;
 * otherwise fall back to the Default type.
 */
type OverrideOr<
  K extends string,
  Default extends string
> = ThemeKeyOverrides extends Record<K, infer V> ? V & string : Default;

/**
 * Registry of known theme keys for TypeScript autocomplete.
 *
 * When stylefn.d.ts is generated (by withStyleFn in metro.config.js),
 * it augments ThemeKeyOverrides with the actual keys from your config + CSS.
 * Those overrides take precedence over the defaults below.
 */
export interface ThemeKeyRegistry {
  spacing: OverrideOr<
    'spacing',
    '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12'
  >;
  fontSize: OverrideOr<
    'fontSize',
    'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'
  >;
  borderRadius: OverrideOr<
    'borderRadius',
    'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  >;
  fontWeight: OverrideOr<
    'fontWeight',
    'normal' | 'medium' | 'semibold' | 'bold'
  >;
  opacity: OverrideOr<'opacity', '0' | '25' | '50' | '75' | '100'>;
  shadow: OverrideOr<'shadow', 'sm' | 'md' | 'lg'>;
  color: OverrideOr<
    'color',
    | 'primary'
    | 'secondary'
    | 'danger'
    | 'success'
    | 'warning'
    | 'background'
    | 'surface'
    | 'border'
    | 'text'
    | 'text-muted'
  >;
  breakpoint: OverrideOr<'breakpoint', 'sm' | 'md' | 'lg' | 'xl'>;
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
  /** Base pixel value for rem→px conversion (default 16). Set via withStyleFn({ inlineRem }) in metro.config.js. */
  inlineRem?: number;
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
  /**
   * True when the current breakpoint is NOT the given breakpoint.
   * @example `t.breakpoint.not('sm')` — true on md, lg, xl etc.
   */
  not: (name: BreakpointName) => boolean;
  /**
   * True when screen width is >= lower threshold AND < upper threshold.
   * @example `t.breakpoint.between('md', 'xl')` — true for md and lg, false for sm and xl+
   */
  between: (lower: BreakpointName, upper: BreakpointName) => boolean;
  /**
   * Returns the pixel threshold for a named breakpoint.
   * Useful when you need the raw number to compute widths, margins, etc.
   * Returns `undefined` if the breakpoint name is unknown.
   * @example `t.breakpoint.value('md')` → 375
   * @example `t.breakpoint.value('xl')` → 768
   */
  value: (name: BreakpointName) => number | undefined;
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
 * Device information from expo-device.
 *
 * Provides hardware/software info and convenience boolean flags
 * for device form factor. Requires `expo-device` as an optional dependency.
 *
 * @example
 * ```tsx
 * t.device.isTablet    // true on tablet devices
 * t.device.isPhone     // true on phone devices
 * t.device.brand       // "Apple", "Samsung", etc.
 * t.device.modelName   // "iPhone 15 Pro", "Pixel 8", etc.
 * t.device.isDevice    // false in simulator/emulator
 * t.device.osVersion   // "17.4", "14", etc.
 * ```
 */
export interface DeviceTokens {
  /** Whether the app is running on a physical device (false in simulator/emulator) */
  isDevice: boolean;
  /** Device brand (e.g. "Apple", "Samsung", "Google") */
  brand: string | null;
  /** Device manufacturer */
  manufacturer: string | null;
  /** Device model name (e.g. "iPhone 15 Pro", "Pixel 8") */
  modelName: string | null;
  /** Device model identifier (e.g. "iPhone16,1") */
  modelId: string | null;
  /** Approximate year class of the device */
  deviceYearClass: number | null;
  /** Total memory in bytes */
  totalMemory: number | null;
  /** Operating system name (e.g. "iOS", "Android") */
  osName: string | null;
  /** Operating system version (e.g. "17.4", "14") */
  osVersion: string | null;
  /** Operating system build ID */
  osBuildId: string | null;
  /** User-set device name */
  deviceName: string | null;
  /** Device type enum value (0=UNKNOWN, 1=PHONE, 2=TABLET, 3=DESKTOP, 4=TV) */
  deviceType: number | null;
  /** True when running on a phone */
  isPhone: boolean;
  /** True when running on a tablet */
  isTablet: boolean;
  /** True when running on a desktop */
  isDesktop: boolean;
  /** True when running on a TV */
  isTV: boolean;
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

  /** Device info from expo-device (hardware, form factor, OS details) */
  device: DeviceTokens;

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
   * Evaluate a CSS-like calc expression with px, vh, vw, rem units.
   * Supports +, -, *, / and parentheses.
   * @example `t.calc('100vw - 32px')` → screen width minus 32 pixels
   * @example `t.calc('2rem + 4px')` → 36 (when inlineRem = 16)
   */
  calc: (expression: string) => number;

  /**
   * Convert a rem value to pixels using the configured inlineRem base.
   * Default base is 16 (so 1rem = 16px) unless overridden via
   * withStyleFn({ inlineRem }) in metro.config.js.
   * @example `t.rem(1)` → 16 (default), `t.rem(0.625)` → 10
   */
  rem: (value: number) => number;

  /**
   * The base pixel value used for rem→px conversion.
   * Configured via withStyleFn({ inlineRem }) in metro.config.js (default 16).
   */
  inlineRem: number;

  /**
   * Screen width in pixels. Convenience alias for `screen.width`.
   *
   * Useful for destructuring in children functions and style functions:
   * ```tsx
   * <View>{({ width, height }) => <Child style={{ width: width / 2 }} />}</View>
   * ```
   *
   * **Note:** This is the screen width, not the component's own width.
   * For component-level dimensions, use the `useLayout()` hook.
   */
  width: number;

  /**
   * Screen height in pixels. Convenience alias for `screen.height`.
   *
   * **Note:** This is the screen height, not the component's own height.
   * For component-level dimensions, use the `useLayout()` hook.
   */
  height: number;

  /**
   * Custom user-injected tokens — populated via `useTokenInjection()`.
   *
   * Augment the `CustomTokens` interface via module declaration for full
   * TypeScript autocomplete on your custom keys.
   *
   * @example
   * ```tsx
   * // Declare your custom tokens (once, in a .d.ts file):
   * declare module 'react-native-stylefn' {
   *   interface CustomTokens {
   *     isSideBarOpened: boolean;
   *   }
   * }
   *
   * // Inject from any component:
   * useTokenInjection({ isSideBarOpened });
   *
   * // Use in style functions:
   * <View style={(t) => ({ width: t.custom.isSideBarOpened ? 260 : 0 })} />
   * ```
   */
  custom: CustomTokens & Record<string, unknown>;
}

/**
 * A style value that can be a plain object or a function receiving tokens.
 */
export type RNStyle = ViewStyle | TextStyle | ImageStyle;

/**
 * Custom string values supported by react-native-stylefn that are resolved
 * at runtime by the Babel plugin via `resolveViewportUnits()`:
 *
 * - Fractions: `"1/2"` → `"50%"`, `"3/4"` → `"75%"`
 * - Viewport width: `"50vw"` → pixels
 * - Viewport height: `"100vh"` → pixels
 * - Rem units: `"1rem"` → pixels (based on configured inlineRem)
 *
 * These are valid in style function return types because the Babel plugin
 * wraps them with `__resolveStyle()` which converts them before React Native
 * sees them.
 */
export type StyleFnDimension =
  | `${number}/${number}`
  | `${number}vw`
  | `${number}vh`
  | `${number}rem`;

/**
 * Loosens a style type to also accept `StyleFnDimension` custom strings
 * for any property. Used in style function return types.
 *
 * Distributive over unions: `LooseStyle<ViewStyle | TextStyle>` becomes
 * `LooseStyle<ViewStyle> | LooseStyle<TextStyle>`.
 */
export type LooseStyle<S> = S extends any
  ? { [K in keyof S]?: S[K] | StyleFnDimension }
  : never;

/**
 * Style function that receives tokens and returns a style object.
 *
 * The return type accepts custom dimension strings (fractions, viewport units,
 * rem) that are resolved at runtime by the Babel plugin.
 *
 * @example
 * ```tsx
 * <View style={(t) => ({
 *   width: t.orientation.landscape ? '50vw' : '100vw',
 *   height: '3/4',          // → "75%"
 *   padding: '1rem',        // → 16px (default)
 * })} />
 * ```
 */
export type StyleFunction<S = RNStyle> = (
  tokens: StyleTokens
) => LooseStyle<S> | false | null | undefined;

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
 * Extended token type available exclusively in the children-as-function pattern.
 *
 * Includes all `StyleTokens` plus a `layout` field containing the **parent
 * component's measured dimensions** (width and height in pixels), updated
 * automatically via an `onLayout` handler injected by the Babel plugin.
 *
 * `layout.width` and `layout.height` start at `0` until the first layout pass,
 * then reflect the actual rendered dimensions of the containing component.
 *
 * This is different from `t.width` / `t.height` which are the **screen**
 * dimensions. Use `layout` when you need to size children relative to their
 * parent container.
 *
 * @example
 * ```tsx
 * <View style={{ flex: 1 }}>
 *   {({ layout, colors }) => (
 *     <View style={{ width: layout.width / 2, backgroundColor: colors.primary }}>
 *       <Text>Half the container width</Text>
 *     </View>
 *   )}
 * </View>
 * ```
 */
export interface ChildrenTokens extends StyleTokens {
  /**
   * The measured layout dimensions of the parent component that contains
   * this children function. Updated automatically after the first layout pass.
   *
   * - `layout.width` — measured width in pixels (0 before first layout)
   * - `layout.height` — measured height in pixels (0 before first layout)
   *
   * **Note:** This is the parent component's dimensions, NOT the screen
   * dimensions. For screen dimensions, use `t.screen.width` / `t.width`.
   */
  layout: LayoutInfo;
}

/**
 * A children value that can be either static ReactNode content or a function
 * receiving tokens (with layout) and returning ReactNode content. This enables
 * the render-children (children-as-function) pattern with access to design
 * tokens AND the parent component's measured dimensions.
 *
 * Use this to type the `children` prop in components that support the
 * render-children pattern.
 *
 * @example
 * ```tsx
 * import type { ChildrenFunction } from 'react-native-stylefn';
 *
 * interface CardProps {
 *   children: ChildrenFunction;
 * }
 *
 * // Usage:
 * <Card>
 *   {({ layout, colors }) => (
 *     <View style={{ width: layout.width * 0.8 }}>
 *       <Text style={{ color: colors.text }}>
 *         {layout.dark ? 'Dark Mode' : 'Light Mode'}
 *       </Text>
 *     </View>
 *   )}
 * </Card>
 * ```
 */
export type ChildrenFunction<T = ReactNode> =
  | T
  | ((tokens: ChildrenTokens) => T);

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
 * Layout dimensions measured from a component's `onLayout` event.
 *
 * Returned by the `useLayout()` hook.
 *
 * @example
 * ```tsx
 * const { ref, width, height } = useLayout();
 *
 * <View ref={ref} style={{ flex: 1 }}>
 *   <View style={{ width: width / 2 }} />
 * </View>
 * ```
 */
export interface LayoutInfo {
  /** Measured width of the component in pixels (0 before first layout) */
  width: number;
  /** Measured height of the component in pixels (0 before first layout) */
  height: number;
}

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
 * Custom user-defined tokens — injected via `useTokenInjection()`.
 *
 * Augment this interface via module declaration to get TypeScript autocomplete
 * for your custom tokens in style functions.
 *
 * @example
 * ```ts
 * // In your app's type declaration file (e.g. stylefn-env.d.ts):
 * declare module 'react-native-stylefn' {
 *   interface CustomTokens {
 *     isSideBarOpened: boolean;
 *     cartCount: number;
 *   }
 * }
 *
 * // Then inject in any component:
 * const [isSideBarOpened, setIsSideBarOpened] = useState(false);
 * useTokenInjection({ isSideBarOpened });
 *
 * // And use in style functions:
 * <View style={(t) => ({ width: t.custom.isSideBarOpened ? 260 : 0 })} />
 * ```
 */
export interface CustomTokens {}

/**
 * Theme hook return type (dark mode control).
 */
export interface UseThemeReturn {
  theme: boolean;
  setTheme: (value: boolean) => void;
  toggleTheme: () => void;
}
