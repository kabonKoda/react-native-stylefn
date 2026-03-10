import { useSyncExternalStore } from 'react';
import type { StyleTokens } from '../types';
import { getTokenStore, subscribeTokenStore } from '../store';

/**
 * Access the full token store inside component logic,
 * event handlers, or animations where a style prop isn't available.
 *
 * Re-renders the component when any token value changes.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { dark, colors, breakpoint } = useStyleFn();
 *
 *   const handlePress = () => {
 *     analytics.track('tap', { theme: dark ? 'dark' : 'light' });
 *   };
 *
 *   return <Pressable onPress={handlePress} />;
 * }
 * ```
 */
export function useStyleFn(): StyleTokens {
  return useSyncExternalStore(
    subscribeTokenStore,
    getTokenStore,
    getTokenStore // server snapshot (same as client for RN)
  );
}
