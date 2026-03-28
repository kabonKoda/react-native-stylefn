import type { ThemeConfig, StyleFnConfig } from '../types';
import { defaultTheme } from './defaults';

/**
 * Deep merges two plain objects, with source values taking precedence.
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceVal = source[key];
      const targetVal = target[key];

      if (
        sourceVal &&
        typeof sourceVal === 'object' &&
        !Array.isArray(sourceVal) &&
        targetVal &&
        typeof targetVal === 'object' &&
        !Array.isArray(targetVal)
      ) {
        result[key] = deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>
        );
      } else {
        result[key] = sourceVal;
      }
    }
  }

  return result;
}

/**
 * Resolves the full theme by merging:
 * 1. Built-in defaults
 * 2. User's theme overrides (section-level REPLACE — like Tailwind)
 * 3. User's theme.extend (key-level deep merge — additive)
 *
 * Behavior:
 * - `theme.spacing: { 1: 8 }` → **replaces** the entire default spacing
 *   (you lose all default keys and only have `1: 8`)
 * - `theme.extend.spacing: { 16: 64 }` → **adds** `16: 64` to the existing spacing
 *   (all defaults + any top-level overrides are preserved)
 */
export function resolveTheme(userTheme?: Partial<ThemeConfig>): ThemeConfig {
  if (!userTheme) {
    return { ...defaultTheme };
  }

  const { extend, ...overrides } = userTheme;

  // Step 1: Start with defaults, then merge user overrides section by section.
  // Most sections (spacing, fontSize, etc.) are REPLACED entirely when the user provides them.
  // Colors are MERGED with the default palette so the Tailwind palette is always available;
  // the user's colors take precedence for any matching keys.
  const merged: Record<string, unknown> = {
    ...(defaultTheme as unknown as Record<string, unknown>),
  };

  for (const key in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const val = (overrides as Record<string, unknown>)[key];
      if (val !== undefined) {
        if (
          key === 'colors' &&
          typeof val === 'object' &&
          val !== null &&
          !Array.isArray(val)
        ) {
          // Colors always merge with the palette so users keep white, black,
          // slate-50…rose-950 etc. even when they provide custom color keys.
          merged[key] = {
            ...(merged[key] as Record<string, unknown>),
            ...(val as Record<string, unknown>),
          };
        } else {
          merged[key] = val; // Replace the entire section for all other keys
        }
      }
    }
  }

  // Step 2: Apply extend (additive deep merge on top of the already-merged theme).
  // Keys in extend are merged INTO the existing sections, not replacing them.
  if (extend) {
    return deepMerge(
      merged,
      extend as unknown as Record<string, unknown>
    ) as unknown as ThemeConfig;
  }

  return merged as unknown as ThemeConfig;
}

/**
 * Resolves the full config, merging user config with defaults.
 */
export function resolveConfig(userConfig?: Partial<StyleFnConfig>): {
  theme: ThemeConfig;
  darkMode: 'system' | 'manual';
} {
  const darkMode = userConfig?.darkMode ?? 'system';
  const theme = resolveTheme(userConfig?.theme);

  return { theme, darkMode };
}
