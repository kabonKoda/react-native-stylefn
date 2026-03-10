import { Platform } from 'react-native';
import type {
  StyleTokens,
  TokenResolverParams,
  ThemeConfig,
  PlatformOS,
} from '../types';
import { resolveTheme } from '../config/resolver';
import { defaultCSSVariables } from '../config/defaults';
import { deriveBreakpoint } from './breakpoint';
import { deriveOrientation } from './orientation';

/**
 * Assembles the full StyleTokens object from all device/system state + config.
 */
export function resolveTokens(params: TokenResolverParams): StyleTokens {
  const {
    colorScheme,
    screenWidth,
    screenHeight,
    screenScale,
    fontScale,
    insets,
    reducedMotion,
    boldText,
    highContrast,
    config,
    cssVars,
  } = params;

  const theme: ThemeConfig = resolveTheme(config.theme);
  const dark = colorScheme === 'dark';

  // Merge CSS variables with defaults
  const lightVars = { ...defaultCSSVariables.light, ...cssVars.light };
  const darkVars = { ...defaultCSSVariables.dark, ...cssVars.dark };

  // Resolve colors for the current color scheme
  const colors: Record<string, string> = {
    ...theme.colors,
    ...(dark ? darkVars : lightVars),
  };

  const platform = (Platform.OS ?? 'ios') as PlatformOS;

  return {
    theme: {
      spacing: theme.spacing,
      fontSize: theme.fontSize,
      borderRadius: theme.borderRadius,
      fontWeight: theme.fontWeight,
      colors: theme.colors,
      shadows: theme.shadows ?? {},
      opacity: theme.opacity,
    },
    colors,
    dark,
    colorScheme,
    breakpoint: deriveBreakpoint(screenWidth, theme.screens),
    screen: {
      width: screenWidth,
      height: screenHeight,
      scale: screenScale,
      fontScale,
    },
    orientation: deriveOrientation(screenWidth, screenHeight),
    platform,
    insets,
    reducedMotion,
    fontScale,
    boldText,
    highContrast,
  };
}

export { deriveBreakpoint } from './breakpoint';
export { deriveOrientation } from './orientation';
export { defaultAccessibility } from './accessibility';
export type { AccessibilityTokens } from './accessibility';
