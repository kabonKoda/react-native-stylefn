import { useCallback } from 'react';
import type { UseDarkReturn } from '../types';
import { useTheme } from './useTheme';
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
 * Returns the current dark state and setters to toggle it.
 * Only effective when `darkMode: 'manual'` is set in config.
 *
 * @example
 * ```tsx
 * function SettingsScreen() {
 *   const { dark, toggleDark } = useDark();
 *
 *   return (
 *     <Switch value={dark} onValueChange={toggleDark} />
 *   );
 * }
 * ```
 */
export function useDark(): UseDarkReturn {
  const { dark } = useTheme();

  const setDark = useCallback((value: boolean) => {
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

  const toggleDark = useCallback(() => {
    const current = getManualDark();
    const next = current === null ? !dark : !current;
    setDark(next);
  }, [dark, setDark]);

  return { dark, setDark, toggleDark };
}
