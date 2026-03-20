import type { StyleTokens, TokenResolverParams, ThemeConfig } from '../types';
import { resolveTheme } from '../config/resolver';
import { defaultCSSVariables } from '../config/defaults';
import { getCustomTokens } from '../store';
import {
  getRawVarsForScheme,
  resolveNumericMap,
  resolveColorMap,
  resolveShadowMap,
} from '../config/cssExpressionResolver';
import { createBreakpointQuery } from './breakpoint';
import { deriveOrientation } from './orientation';
import { derivePlatform } from './platform';
import { deriveDevice } from './device';
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

  // Get the inlineRem value from CSS vars (set by withStyleFn in metro.config.js)
  const inlineRem = cssVars.inlineRem ?? 16;

  // Get the raw CSS variables map for the current color scheme (for var() resolution)
  const rawVars = getRawVarsForScheme(cssVars, colorScheme);

  // Resolve theme values — CSS expressions are evaluated here (with rem support)
  const resolvedSpacing = resolveNumericMap(theme.spacing, rawVars, inlineRem);
  const resolvedFontSize = resolveNumericMap(
    theme.fontSize,
    rawVars,
    inlineRem
  );
  const resolvedBorderRadius = resolveNumericMap(
    theme.borderRadius,
    rawVars,
    inlineRem
  );
  const resolvedOpacity = resolveNumericMap(theme.opacity, rawVars, inlineRem);

  // Resolve colors — flatten nested objects and evaluate hsl()/var()
  const resolvedThemeColors = resolveColorMap(theme.colors, rawVars);

  // Default CSS color variables (built-in fallbacks — lowest priority)
  const defaultSchemeColors = dark
    ? defaultCSSVariables.dark
    : defaultCSSVariables.light;

  // User's --color-* CSS variables from global.css (highest priority)
  const cssColorVars = dark ? cssVars.dark : cssVars.light;

  // Merge priority (lowest → highest):
  // 1. Default CSS color variables (built-in fallbacks)
  // 2. Resolved theme colors (from config, including hsl(var(...)) expressions)
  // 3. User's --color-* CSS variables (explicit overrides from global.css)
  const colors: Record<string, string> = {
    ...defaultSchemeColors,
    ...resolvedThemeColors,
    ...cssColorVars,
  };

  // Resolve shadows — supports string values, var() references, and boxShadow alias.
  // Merge both `shadows` and `boxShadow` (Tailwind-compatible alias) so users can
  // use either key in their config. boxShadow takes priority for same-named keys.
  const shadowSource = {
    ...(theme.shadows || {}),
    ...(theme.boxShadow || {}),
  };
  const resolvedShadows = resolveShadowMap(shadowSource, rawVars);

  // Resolve border widths if present
  const resolvedBorderWidth = theme.borderWidth
    ? resolveNumericMap(theme.borderWidth, rawVars, inlineRem)
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
    device: deriveDevice(),
    insets,
    reducedMotion,
    fontScale,
    boldText,
    highContrast,
    vw: (v: number) => (v / 100) * screenWidth,
    vh: (v: number) => (v / 100) * screenHeight,
    calc: (expr: string) =>
      evaluateCalc(
        expr,
        {
          width: screenWidth,
          height: screenHeight,
          scale: screenScale,
          fontScale,
        },
        inlineRem
      ),
    rem: (v: number) => v * inlineRem,
    inlineRem,
    width: screenWidth,
    height: screenHeight,
    custom: getCustomTokens(),
  };
}

export { createBreakpointQuery } from './breakpoint';
export { deriveOrientation } from './orientation';
export { derivePlatform } from './platform';
export { deriveDevice, defaultDevice } from './device';
export { defaultAccessibility } from './accessibility';
export type { AccessibilityTokens } from './accessibility';
