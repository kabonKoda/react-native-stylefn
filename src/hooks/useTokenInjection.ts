import { useEffect, useRef } from 'react';
import type { CustomTokens } from '../types';
import {
  allocCustomTokenId,
  setCustomTokens,
  removeCustomTokens,
} from '../store';

/**
 * Injects custom tokens into the global style token store so they are
 * accessible as `t.custom.*` inside any style function, prop function,
 * or `useStyleFn()` hook anywhere in the tree.
 *
 * - Values are **merged** — multiple components can each inject different keys.
 * - Re-runs only when the token values shallowly change (no unnecessary
 *   listener notifications).
 * - Cleans up automatically on unmount, removing only the keys this
 *   component contributed.
 *
 * Declare your custom token types once via module augmentation to get
 * full TypeScript autocomplete in style functions:
 *
 * ```ts
 * // stylefn-env.d.ts (or any .d.ts file in your project)
 * declare module 'react-native-stylefn' {
 *   interface CustomTokens {
 *     isSideBarOpened: boolean;
 *     cartCount: number;
 *   }
 * }
 * ```
 *
 * @example
 * ```tsx
 * import { useState } from 'react';
 * import { useTokenInjection } from 'react-native-stylefn';
 *
 * export function Sidebar() {
 *   const [isSideBarOpened, setIsSideBarOpened] = useState(false);
 *
 *   // Injects `isSideBarOpened` into t.custom for the whole tree
 *   useTokenInjection({ isSideBarOpened });
 *
 *   return (
 *     <View style={(t) => ({
 *       width: t.custom.isSideBarOpened ? 260 : 0,
 *       backgroundColor: t.colors.surface,
 *     })}>
 *       {/* ... *\/}
 *     </View>
 *   );
 * }
 * ```
 */
export function useTokenInjection(
  tokens: Partial<CustomTokens> & Record<string, unknown>
): void {
  // Stable numeric ID allocated once on mount — identifies this injector.
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) {
    idRef.current = allocCustomTokenId();
  }
  const id = idRef.current;

  // Keep a ref to the previously injected values so we can do a shallow
  // comparison and skip unnecessary store updates.
  const prevRef = useRef<Record<string, unknown> | null>(null);

  // Run synchronously during render (not in useEffect) so style functions
  // executed in the same render already see the latest custom tokens.
  const hasChanged =
    prevRef.current === null || !_shallowEqual(prevRef.current, tokens);

  if (hasChanged) {
    prevRef.current = { ...tokens };
    setCustomTokens(id, tokens as Record<string, unknown>);
  }

  // Cleanup: remove this injector's slice when the component unmounts.
  useEffect(() => {
    return () => {
      removeCustomTokens(id);
    };
  }, [id]);
}

/**
 * Shallow equality check for plain objects.
 * Returns true if `a` and `b` have the same keys and the same
 * primitive/reference values for each key.
 */
function _shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
