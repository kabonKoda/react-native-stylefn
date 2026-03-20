import { useSyncExternalStore } from 'react';
import { getTokenStore, subscribeTokenStore } from './store';
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
 * Resolves a children value at render time.
 * - If it's a function, calls it with the current token store + layout `{0,0}`.
 * - Otherwise returns it as-is.
 *
 * Used for two cases:
 * 1. **Fragment children**: `<>{fn}</>` — no parent element to measure, so
 *    `layout` is `{ width: 0, height: 0 }`.
 * 2. **`children` attribute prop**: `<Comp children={fn} />` — similarly no
 *    parent measurement available.
 *
 * For **inline children of JSX elements** (`<View>{fn}</View>`), the Babel
 * plugin transforms the parent element into `<__LayoutView>` instead, which
 * provides real measured `layout` dimensions. This function is NOT called in
 * that case.
 *
 * @example
 * ```tsx
 * // `children` attribute prop — still uses __resolveChildren:
 * <Card children={(t) => <Text style={{ color: t.colors.text }}>Hello</Text>} />
 *
 * // Inline Fragment children — uses __resolveChildren (no layout):
 * <>{(t) => <Text>{t.colors.text}</Text>}</>
 *
 * // Inline element children — transformed to __LayoutView (has layout):
 * <Card>{({ layout }) => <Text>Width: {layout.width}</Text>}</Card>
 * ```
 */
export function __resolveChildren(value: unknown): unknown {
  if (typeof value === 'function') {
    // Pass layout: { width: 0, height: 0 } for cases where no parent
    // element measurement is available (Fragment children, children prop).
    return value({ ...getTokenStore(), layout: { width: 0, height: 0 } });
  }
  return value;
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

/**
 * Subscribes the calling component to token store changes so that it
 * re-renders automatically whenever any token updates (e.g. when
 * `useTokenInjection` changes `t.custom.*`).
 *
 * **Injected automatically by the Babel plugin** into the body of every
 * React component that contains style functions or prop functions in its
 * JSX. Users should never need to call this directly — use `useStyleFn()`
 * if you need the token values in component logic.
 *
 * Works by wrapping `useSyncExternalStore` around the singleton token store
 * subscription, which is the same mechanism used by `useStyleFn()` internally.
 */
export function __subscribeStyleFn(): void {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSyncExternalStore(subscribeTokenStore, getTokenStore, getTokenStore);
}
