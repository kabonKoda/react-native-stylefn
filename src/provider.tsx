import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useColorScheme, Dimensions, PixelRatio, Platform, AccessibilityInfo, type ScaledSize } from 'react-native';
import type { StyleFnConfig, CSSVariables, ColorScheme, Insets } from './types';
import { setTokenStore, notifyTokenStoreListeners, getManualDark } from './store';
import { resolveTokens } from './tokens';
import { defaultCSSVariables } from './config/defaults';
import { applyPatch } from './patch';

/**
 * Props for StyleProvider.
 */
export interface StyleProviderProps {
  children: ReactNode;
  /** User configuration (from rn-stylefn.config.js or inline) */
  config?: Partial<StyleFnConfig>;
  /** Parsed CSS variables (from global.css) */
  cssVars?: CSSVariables;
  /** Custom safe area insets (if not using react-native-safe-area-context) */
  insets?: Insets;
}

/**
 * Hook to get current screen dimensions with listener.
 */
function useScreenDimensions() {
  const [dims, setDims] = React.useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', (e: { window: ScaledSize; screen: ScaledSize }) => {
      setDims(e.window);
    });
    return () => subscription.remove();
  }, []);

  return dims;
}

/**
 * Hook to get reduced motion preference.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  useEffect(() => {
    // Check initial state
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    }

    // Subscribe to changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced
    );

    return () => subscription.remove();
  }, []);

  return reduced;
}

/**
 * Hook to get bold text preference (iOS).
 */
function useBoldText(): boolean {
  const [bold, setBold] = React.useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isBoldTextEnabled().then(setBold).catch(() => {});
      const subscription = AccessibilityInfo.addEventListener(
        'boldTextChanged',
        setBold
      );
      return () => subscription.remove();
    }
    return undefined;
  }, []);

  return bold;
}

/**
 * Hook to get high contrast preference.
 */
function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = React.useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      // Not all RN versions expose isGrayscaleEnabled
      const ai = AccessibilityInfo as Record<string, unknown>;
      if (typeof ai['isGrayscaleEnabled'] === 'function') {
        (ai['isGrayscaleEnabled'] as () => Promise<boolean>)().then(setHighContrast).catch(() => {});
      }
    }
    return undefined;
  }, []);

  return highContrast;
}

/**
 * StyleProvider — the only component developers need to wrap their app with.
 *
 * - Applies the React.createElement patch once on mount
 * - Subscribes to all device/system state changes
 * - Keeps the singleton token store always in sync
 */
export function StyleProvider({
  children,
  config = {},
  cssVars,
  insets: customInsets,
}: StyleProviderProps): React.JSX.Element {
  const systemColorScheme = useColorScheme();
  const dimensions = useScreenDimensions();
  const reducedMotion = useReducedMotion();
  const boldText = useBoldText();
  const highContrast = useHighContrast();
  const fontScale = PixelRatio.getFontScale();

  const patchApplied = useRef(false);

  // Apply the patch once on mount
  useEffect(() => {
    if (!patchApplied.current) {
      applyPatch();
      patchApplied.current = true;
    }
  }, []);

  // Default insets
  const insets = customInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };

  // Resolve CSS variables
  const resolvedCssVars = cssVars ?? defaultCSSVariables;

  // Determine effective color scheme
  const manualDark = getManualDark();
  const darkMode = config.darkMode ?? 'system';

  let effectiveColorScheme: ColorScheme;
  if (darkMode === 'manual' && manualDark !== null) {
    effectiveColorScheme = manualDark ? 'dark' : 'light';
  } else {
    effectiveColorScheme = systemColorScheme === 'dark' ? 'dark' : 'light';
  }

  // Compute tokens synchronously so children render with up-to-date values
  const tokens = useMemo(() => resolveTokens({
    colorScheme: effectiveColorScheme,
    screenWidth: dimensions.width,
    screenHeight: dimensions.height,
    screenScale: dimensions.scale ?? PixelRatio.get(),
    fontScale,
    insets,
    reducedMotion,
    boldText,
    highContrast,
    config,
    cssVars: resolvedCssVars,
  }), [
    effectiveColorScheme,
    dimensions.width,
    dimensions.height,
    dimensions.scale,
    fontScale,
    insets.top,
    insets.bottom,
    insets.left,
    insets.right,
    reducedMotion,
    boldText,
    highContrast,
    config,
    resolvedCssVars,
  ]);

  // Update store synchronously before children render
  setTokenStore(tokens);

  // Notify listeners after render (for hooks like useTheme)
  useEffect(() => {
    notifyTokenStoreListeners();
  }, [tokens]);

  return <>{children}</>;
}
