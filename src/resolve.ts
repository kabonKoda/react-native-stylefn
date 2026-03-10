import { getTokenStore } from './store';

/**
 * Resolves a style value at render time.
 * - If it's a function, calls it with the current token store.
 * - If it's an array, maps over it resolving any functions.
 * - Otherwise returns it as-is.
 *
 * Injected automatically by the Babel plugin into JSX style props.
 */
export function __resolveStyle(value: unknown): unknown {
  if (typeof value === 'function') {
    return value(getTokenStore());
  }

  if (Array.isArray(value)) {
    return value.map((s) =>
      typeof s === 'function' ? s(getTokenStore()) : s
    );
  }

  return value;
}
