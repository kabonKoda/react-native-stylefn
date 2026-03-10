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
 * 2. User's theme overrides
 * 3. User's theme.extend (additive merge on top)
 */
export function resolveTheme(
  userTheme?: Partial<ThemeConfig>
): ThemeConfig {
  if (!userTheme) {
    return { ...defaultTheme };
  }

  const { extend, ...overrides } = userTheme;

  // Merge user overrides onto defaults
  let merged = deepMerge(
    defaultTheme as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>
  ) as unknown as ThemeConfig;

  // Apply extend (additive on top of the already-merged theme)
  if (extend) {
    merged = deepMerge(
      merged as unknown as Record<string, unknown>,
      extend as unknown as Record<string, unknown>
    ) as unknown as ThemeConfig;
  }

  return merged;
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
