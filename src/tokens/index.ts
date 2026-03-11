import type {
  StyleTokens,
  TokenResolverParams,
  ThemeConfig,
} from '../types';
import { resolveTheme } from '../config/resolver';
import { defaultCSSVariables } from '../config/defaults';
import { createBreakpointQuery } from './breakpoint';
import { deriveOrientation } from './orientation';
import { derivePlatform } from './platform';
import { evaluateCalc } from '../units';

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

  return {
    theme: {
      spacing: theme.spacing,
      fontSize: theme.fontSize,
      borderRadius: theme.borderRadius,
      fontWeight: theme.fontWeight,
      colors,
      shadows: theme.shadows ?? {},
      opacity: theme.opacity,
    },
    colors,
    dark,
    colorScheme,
    breakpoint: createBreakpointQuery(screenWidth, theme.screens),
    screen: {
      width: screenWidth,
      height: screenHeight,
      scale: screenScale,
      fontScale,
    },
    orientation: deriveOrientation(screenWidth, screenHeight),
    platform: derivePlatform(),
    insets,
    reducedMotion,
    fontScale,
    boldText,
    highContrast,
    vw: (v: number) => (v / 100) * screenWidth,
    vh: (v: number) => (v / 100) * screenHeight,
    calc: (expr: string) => evaluateCalc(expr, { width: screenWidth, height: screenHeight, scale: screenScale, fontScale }),
  };
}

export { createBreakpointQuery } from './breakpoint';
export { deriveOrientation } from './orientation';
export { derivePlatform } from './platform';
export { defaultAccessibility } from './accessibility';
export type { AccessibilityTokens } from './accessibility';
