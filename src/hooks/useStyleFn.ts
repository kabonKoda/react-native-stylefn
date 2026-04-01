import { useSyncExternalStore, useCallback } from 'react';
import type { StyleTokens, LayoutInfo } from '../types';
import { getTokenStore, subscribeTokenStore } from '../store';
import {
  getComponentState,
  subscribeComponentState,
} from '../componentRegistry';

// Stable no-op helper for the case where `id` is undefined.
// Using a module-level constant avoids re-creating it on every render.
const _noopSubscribe =
  (_listener: () => void): (() => void) =>
  () => {};

/**
 * Access the full token store inside component logic,
 * event handlers, or animations where a style prop isn't available.
 *
 * **Without `id`** — returns the global `StyleTokens`.  Re-renders the
 * component whenever any global token changes (dark mode, orientation,
 * breakpoint, custom tokens, etc.).
 *
 * **With `id`** — returns the same global tokens **merged with the live
 * state of the component registered under that id**.  The returned object
 * includes:
 *   - `active`  — whether that component is currently being pressed
 *   - `hovered` — whether a pointer is currently hovering it
 *   - `layout`  — its most recently measured dimensions (`{ width, height }`)
 *
 * A component participates in the registry simply by having a string `id`
 * prop **and** being wrapped by the Babel plugin (i.e. it references
 * `t.active` / `t.hovered`, or has function children):
 *
 * ```tsx
 * // Register interaction state:
 * <View id="myBtn" style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />
 *
 * // Register layout state:
 * <View id="card">
 *   {({ layout }) => <Text>{layout.width}</Text>}
 * </View>
 *
 * // Observe from anywhere — perfect for driving Reanimated animations:
 * const { active, hovered, layout, dark, breakpoint } = useStyleFn('myBtn');
 *
 * useEffect(() => {
 *   scale.value = withSpring(active ? 0.95 : 1);
 * }, [active]);
 * ```
 *
 * Re-renders when either the global token store **or** the named component's
 * state changes.
 *
 * @overload Without id — returns `StyleTokens`
 * @overload With id — returns `StyleTokens & { layout: LayoutInfo }`
 */
export function useStyleFn(): StyleTokens;
export function useStyleFn(id: string): StyleTokens & { layout: LayoutInfo };
export function useStyleFn(
  id?: string
): StyleTokens | (StyleTokens & { layout: LayoutInfo }) {
  // ── Global token store ─────────────────────────────────────────────────────
  const baseTokens = useSyncExternalStore(
    subscribeTokenStore,
    getTokenStore,
    getTokenStore
  );

  // ── Per-component state (rules-of-hooks: always called) ───────────────────
  //
  // When `id` is undefined we use stable no-op helpers so useSyncExternalStore
  // is still called unconditionally on every render.  When `id` changes, the
  // callbacks change and React re-subscribes automatically.
  const subscribe = useCallback(
    (listener: () => void): (() => void) =>
      id ? subscribeComponentState(id, listener) : _noopSubscribe(listener),
    [id]
  );

  const getSnapshot = useCallback(
    () => (id ? getComponentState(id) : null),
    [id]
  );

  const componentState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  // ── Merge & return ─────────────────────────────────────────────────────────
  if (!id || componentState === null) {
    return baseTokens;
  }

  return {
    ...baseTokens,
    active: componentState.active,
    hovered: componentState.hovered,
    layout: componentState.layout,
  };
}
