import { getTokenStore } from './store';
import { resolveViewportUnits } from './units';

/**
 * Resolves a style value at render time.
 * - If it's a function, calls it with the current token store.
 * - If it's an array, maps over it resolving any functions.
 * - Otherwise returns it as-is.
 *
 * After resolution, any string values containing viewport units
 * (e.g. '50vw', '100vh') are automatically converted to pixel numbers.
 *
 * Injected automatically by the Babel plugin into JSX style props.
 */
export function __resolveStyle(value: unknown): unknown {
  if (typeof value === 'function') {
    const resolved = value(getTokenStore());
    return resolveViewportUnits(resolved);
  }

  if (Array.isArray(value)) {
    return value.map((s) => {
      const resolved = typeof s === 'function' ? s(getTokenStore()) : s;
      return resolveViewportUnits(resolved);
    });
  }

  return resolveViewportUnits(value);
}

/**
 * Resolves a single prop value at render time.
 * - If it's a function, calls it with the current token store.
 * - Otherwise returns it as-is.
 *
 * Unlike __resolveStyle, this does NOT apply viewport unit conversion,
 * since non-style props can be any type (number, string, boolean, etc.).
 *
 * Injected automatically by the Babel plugin into JSX non-style props
 * that contain arrow/function expressions (excluding event handlers).
 *
 * @example
 * ```tsx
 * // Before (user code):
 * <StrokePreview width={({ orientation }) => orientation.landscape ? 266 : 200} />
 *
 * // After (babel-transformed):
 * <StrokePreview width={__resolveProp(({ orientation }) => orientation.landscape ? 266 : 200)} />
 * ```
 */
export function __resolveProp(value: unknown): unknown {
  if (typeof value === 'function') {
    return value(getTokenStore());
  }
  return value;
}
