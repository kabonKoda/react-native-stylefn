import { useCallback } from 'react';
import type { UseThemeReturn } from '../types';
import { useStyleFn } from './useStyleFn';
import {
  getManualDark,
  setManualDark,
  setTokenStore,
  getTokenStore,
  notifyTokenStoreListeners,
} from '../store';

/**
 * Manual dark mode control hook.
 *
 * Returns the current theme state and setters to toggle it.
 * Only effective when `darkMode: 'manual'` is set in config.
 *
 * @example
 * ```tsx
 * function SettingsScreen() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <Switch value={theme} onValueChange={toggleTheme} />
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const { dark } = useStyleFn();

  const setTheme = useCallback((value: boolean) => {
    setManualDark(value);
    // Update the store immediately with new dark mode
    const currentStore = getTokenStore();
    setTokenStore({
      ...currentStore,
      dark: value,
      colorScheme: value ? 'dark' : 'light',
    });
    notifyTokenStoreListeners();
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getManualDark();
    const next = current === null ? !dark : !current;
    setTheme(next);
  }, [dark, setTheme]);

  return { theme: dark, setTheme, toggleTheme };
}
