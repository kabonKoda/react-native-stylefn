import type { StyleTokens, TokenResolverParams, ThemeConfig } from '../types';
import { resolveTheme } from '../config/resolver';
import { defaultCSSVariables } from '../config/defaults';
import {
  getRawVarsForScheme,
  resolveNumericMap,
  resolveColorMap,
  resolveShadowMap,
} from '../config/cssExpressionResolver';
import { createBreakpointQuery } from './breakpoint';
import { deriveOrientation } from './orientation';
import { derivePlatform } from './platform';
import { evaluateCalc } from '../units';

/**
 * Assembles the full StyleTokens object from all device/system state + config.
 *
 * CSS variable expressions (var(), hsl(), calc()) in theme config values
 * are resolved here using the raw CSS variables for the current color scheme.
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

  // Get the raw CSS variables map for the current color scheme (for var() resolution)
  const rawVars = getRawVarsForScheme(cssVars, colorScheme);

  // Merge CSS color variables with defaults (backward compat)
  const lightVars = { ...defaultCSSVariables.light, ...cssVars.light };
  const darkVars = { ...defaultCSSVariables.dark, ...cssVars.dark };

  // Resolve theme values — CSS expressions are evaluated here
  const resolvedSpacing = resolveNumericMap(theme.spacing, rawVars);
  const resolvedFontSize = resolveNumericMap(theme.fontSize, rawVars);
  const resolvedBorderRadius = resolveNumericMap(theme.borderRadius, rawVars);
  const resolvedOpacity = resolveNumericMap(theme.opacity, rawVars);

  // Resolve colors — flatten nested objects and evaluate hsl()/var()
  const resolvedThemeColors = resolveColorMap(theme.colors, rawVars);

  // Merge: theme colors + CSS color variables (CSS vars override for current scheme)
  const colors: Record<string, string> = {
    ...resolvedThemeColors,
    ...(dark ? darkVars : lightVars),
  };

  // Resolve shadows — supports string values, var() references, and boxShadow alias
  const shadowSource = theme.shadows ?? theme.boxShadow ?? {};
  const resolvedShadows = resolveShadowMap(shadowSource, rawVars);

  // Resolve border widths if present
  const resolvedBorderWidth = theme.borderWidth
    ? resolveNumericMap(theme.borderWidth, rawVars)
    : undefined;

  return {
    theme: {
      spacing: resolvedSpacing,
      fontSize: resolvedFontSize,
      borderRadius: resolvedBorderRadius,
      fontWeight: theme.fontWeight,
      colors,
      shadows: resolvedShadows,
      opacity: resolvedOpacity,
      ...(resolvedBorderWidth ? { borderWidth: resolvedBorderWidth } : {}),
    } as StyleTokens['theme'],
    colors: colors as StyleTokens['colors'],
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
    calc: (expr: string) =>
      evaluateCalc(expr, {
        width: screenWidth,
        height: screenHeight,
        scale: screenScale,
        fontScale,
      }),
  };
}

export { createBreakpointQuery } from './breakpoint';
export { deriveOrientation } from './orientation';
export { derivePlatform } from './platform';
export { defaultAccessibility } from './accessibility';
export type { AccessibilityTokens } from './accessibility';
