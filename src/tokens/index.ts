import type { StyleTokens, TokenResolverParams, ThemeConfig } from '../types';
import { resolveTheme } from '../config/resolver';
import { defaultCSSVariables } from '../config/defaults';
import { getCustomTokens } from '../store';
import {
  getRawVarsForScheme,
  resolveNumericMap,
  resolveColorMap,
  resolveShadowMap,
  autoDetectColorVars,
} from '../config/cssExpressionResolver';
import { createBreakpointQuery } from './breakpoint';
import { deriveOrientation } from './orientation';
import { derivePlatform } from './platform';
import { deriveDevice } from './device';
import { evaluateCalc } from '../units';
import { alpha, createColorsProxy } from './alpha';

// =============================================================================
// CSS variable → theme token auto-extraction
//
// Scans rawVars for well-known CSS variable prefixes and maps them into
// their corresponding theme sections. This works for ANY CSS source that
// follows standard naming conventions (Tailwind v4, shadcn/ui, custom CSS):
//
//   --text-sm: 14           → t.theme.fontSize['sm']
//   --radius-lg: 8          → t.theme.borderRadius['lg']
//   --shadow-md: 0px 4px... → t.theme.shadows['md']
//   --font-weight-bold: 700 → t.theme.fontWeight['bold']
//   --color-red-50: #...    → t.colors['red-50']   (handled separately)
//
// Merged at LOWEST priority — user config (rn-stylefn.config.js) always wins.
// =============================================================================

/** --text-* → fontSize (skip --text-*--line-height variants) */
function extractFontSizeVars(
  rawVars: Record<string, string>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawVars)) {
    if (key.startsWith('text-') && !key.includes('--')) {
      const num = parseFloat(value);
      if (!isNaN(num) && num > 0) result[key.slice(5)] = num;
    }
  }
  return result;
}

/** --radius / --radius-* → borderRadius */
function extractBorderRadiusVars(
  rawVars: Record<string, string>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawVars)) {
    if (key === 'radius' || key.startsWith('radius-')) {
      const num = parseFloat(value);
      if (!isNaN(num))
        result[key === 'radius' ? 'DEFAULT' : key.slice(7)] = num;
    }
  }
  return result;
}

/** --shadow / --shadow-* → shadows (boxShadow string, skip drop-shadow-*) */
function extractShadowVars(
  rawVars: Record<string, string>
): Record<string, { boxShadow: string }> {
  const result: Record<string, { boxShadow: string }> = {};
  for (const [key, value] of Object.entries(rawVars)) {
    if (
      (key === 'shadow' || key.startsWith('shadow-')) &&
      !key.startsWith('drop-shadow-') &&
      value &&
      value !== 'none'
    ) {
      result[key === 'shadow' ? 'DEFAULT' : key.slice(7)] = {
        boxShadow: value,
      };
    }
  }
  return result;
}

/** --font-weight-* → fontWeight */
function extractFontWeightVars(
  rawVars: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawVars)) {
    if (key.startsWith('font-weight-') && value) {
      result[key.slice(12)] = value;
    }
  }
  return result;
}

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

  // User's --color-* CSS variables from global.css
  const cssColorVars = dark ? cssVars.dark : cssVars.light;

  // Auto-detect color-like raw CSS variables (bare HSL values, hex, etc.)
  // This allows shadcn/ui-style variables like `--input: 220 13% 91%` to
  // automatically become available as `t.colors.input` without manual config.
  const autoDetectedColors = autoDetectColorVars(rawVars);

  // Merge priority (lowest → highest):
  // 1. Default CSS color variables (built-in fallbacks)
  // 2. Auto-detected color vars from raw CSS (bare HSL, hex, etc.)
  // 3. Resolved theme colors (from config, including hsl(var(...)) expressions)
  // 4. User's --color-* CSS variables (explicit overrides from global.css)
  const colors: Record<string, string> = {
    ...defaultSchemeColors,
    ...autoDetectedColors,
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

  // -------------------------------------------------------------------------
  // Auto-extract well-known CSS variable prefixes from rawVars.
  // These are merged at LOWEST priority so user config always wins.
  // Works for any CSS source (Tailwind, shadcn/ui, custom CSS, etc.)
  // -------------------------------------------------------------------------
  const cssFontSize = extractFontSizeVars(rawVars);
  const cssBorderRadius = extractBorderRadiusVars(rawVars);
  const cssShadows = extractShadowVars(rawVars);
  const cssFontWeight = extractFontWeightVars(rawVars);

  return {
    theme: {
      // Merge priority (lowest → highest):
      // 1. Auto-extracted CSS vars (--text-*, --radius-*, --shadow-*, --font-weight-*)
      // 2. Resolved config values (from rn-stylefn.config.js + defaults)
      spacing: resolvedSpacing,
      fontSize: { ...cssFontSize, ...resolvedFontSize },
      borderRadius: { ...cssBorderRadius, ...resolvedBorderRadius },
      fontWeight: { ...cssFontWeight, ...theme.fontWeight },
      colors,
      shadows: { ...cssShadows, ...resolvedShadows },
      opacity: resolvedOpacity,
      ...(resolvedBorderWidth ? { borderWidth: resolvedBorderWidth } : {}),
    } as StyleTokens['theme'],
    colors: createColorsProxy(colors) as StyleTokens['colors'],
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
    // Interaction state — always false in the global store.
    // __InteractiveView overrides these per-component when the Babel plugin
    // detects t.pressed / t.hovered in a style or prop function.
    active: false,
    hovered: false,
    alpha,
    custom: getCustomTokens(),
  };
}

export { createBreakpointQuery } from './breakpoint';
export { deriveOrientation } from './orientation';
export { derivePlatform } from './platform';
export { deriveDevice, defaultDevice } from './device';
export { defaultAccessibility } from './accessibility';
export type { AccessibilityTokens } from './accessibility';
