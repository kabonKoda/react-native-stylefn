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
export function resolveTheme(
  userTheme?: Partial<ThemeConfig>
): ThemeConfig {
  if (!userTheme) {
    return { ...defaultTheme };
  }

  const { extend, ...overrides } = userTheme;

  // Step 1: Start with defaults, then REPLACE any sections the user explicitly provided.
  // This is a shallow merge at the section level (like Tailwind's theme override behavior).
  // If the user provides `theme.spacing`, it completely replaces `defaultTheme.spacing`.
  const merged: Record<string, unknown> = { ...defaultTheme as unknown as Record<string, unknown> };

  for (const key in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const val = (overrides as Record<string, unknown>)[key];
      if (val !== undefined) {
        merged[key] = val; // Replace the entire section
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
