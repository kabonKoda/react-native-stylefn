import type { StyleFnConfig } from '../types';
import { defaultConfig } from './defaults';

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

  return {
    darkMode: userConfig.darkMode ?? defaultConfig.darkMode,
    theme: userConfig.theme
      ? { ...defaultConfig.theme, ...userConfig.theme }
      : defaultConfig.theme,
  };
}
