import type { StyleFnConfig } from '../types';
import { defaultConfig, defaultTheme } from './defaults';

/**
 * Loads the user's rn-stylefn.config.js configuration.
 *
 * In a React Native bundler environment, the config file is resolved
 * at bundle time. If it doesn't exist, defaults are used.
 */
export function loadConfig(userConfig?: Partial<StyleFnConfig>): StyleFnConfig {
  if (!userConfig) {
    return { ...defaultConfig };
  }

  const userTheme = userConfig.theme;
  return {
    darkMode: userConfig.darkMode ?? defaultConfig.darkMode,
    theme: userTheme
      ? {
          ...defaultConfig.theme,
          ...userTheme,
          // Colors always merge with the palette so the Tailwind defaults are
          // never wiped out when the user provides their own color keys.
          colors: userTheme.colors
            ? { ...defaultTheme.colors, ...userTheme.colors }
            : defaultTheme.colors,
        }
      : defaultConfig.theme,
  };
}
