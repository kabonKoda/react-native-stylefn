/**
 * Per-component state registry
 *
 * Maps string `id` values to their live component state so that
 * `useStyleFn(id)`, `useLayoutFn(id)`, and `useInteractiveFn(id)` can
 * observe any component's current active / hovered / layout state from
 * anywhere in the tree.
 *
 * State is published by the internal `__InteractiveView` and `__LayoutView`
 * wrappers (both injected by the Babel plugin).  A component participates in
 * the registry simply by having a string `id` prop:
 *
 * ```tsx
 * // Publishes active / hovered state:
 * <View id="myBtn" style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />
 *
 * // Publishes layout dimensions:
 * <View id="card">
 *   {({ layout }) => <Text>{layout.width}</Text>}
 * </View>
 *
 * // Observe from anywhere:
 * const { active, hovered }         = useInteractiveFn('myBtn');
 * const { width, height }           = useLayoutFn('card');
 * const { active, dark, breakpoint } = useStyleFn('myBtn'); // full token merge
 * ```
 */

import type { LayoutInfo } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Per-component state published to the registry.
 *
 * - `active`  — whether the component is being pressed / touched
 * - `hovered` — whether a pointer is hovering the component
 * - `layout`  — measured width × height (updated via `__LayoutView`)
 */
export interface ComponentState {
  active: boolean;
  hovered: boolean;
  layout: LayoutInfo;
}

/**
 * Interaction-only slice of `ComponentState`.
 * Returned by `useInteractiveFn(id)`.
 */
export interface InteractiveState {
  active: boolean;
  hovered: boolean;
}

// =============================================================================
// Internal state
// =============================================================================

const DEFAULT_STATE: ComponentState = {
  active: false,
  hovered: false,
  layout: { width: 0, height: 0 },
};

/** id → current ComponentState */
const _registry = new Map<string, ComponentState>();

/**
 * id → set of listener callbacks (no-argument, as required by
 * React's `useSyncExternalStore` subscribe API).
 */
const _listeners = new Map<string, Set<() => void>>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Register a component id so it can receive state updates.
 *
 * Safe to call multiple times — subsequent calls for the same id are no-ops.
 * Called automatically by `__InteractiveView` / `__LayoutView` on mount.
 */
export function registerComponent(id: string): void {
  if (!_registry.has(id)) {
    _registry.set(id, {
      active: false,
      hovered: false,
      layout: { width: 0, height: 0 },
    });
  }
  if (!_listeners.has(id)) {
    _listeners.set(id, new Set());
  }
}

/**
 * Remove a component from the registry and clear its listeners.
 *
 * Called automatically by `__InteractiveView` / `__LayoutView` on unmount.
 * After this call, `getComponentState(id)` returns the default zero state.
 */
export function unregisterComponent(id: string): void {
  _registry.delete(id);
  _listeners.delete(id);
}

/**
 * Partially update the state for a registered component and notify all
 * subscribed listeners.
 *
 * Layout patches are deep-merged so callers can write
 * `{ layout: { width: 200 } }` without clobbering the existing `height`.
 *
 * Called by `__InteractiveView` (active / hovered changes) and
 * `__LayoutView` (layout changes).
 */
export function updateComponentState(
  id: string,
  patch: Partial<ComponentState>
): void {
  const current = _registry.get(id) ?? {
    active: false,
    hovered: false,
    layout: { width: 0, height: 0 },
  };

  const next: ComponentState = {
    active: patch.active !== undefined ? patch.active : current.active,
    hovered: patch.hovered !== undefined ? patch.hovered : current.hovered,
    layout:
      patch.layout !== undefined
        ? { ...current.layout, ...patch.layout }
        : current.layout,
  };

  // Skip notify if nothing actually changed (reference equality for layout)
  if (
    next.active === current.active &&
    next.hovered === current.hovered &&
    next.layout.width === current.layout.width &&
    next.layout.height === current.layout.height
  ) {
    return;
  }

  _registry.set(id, next);

  const listeners = _listeners.get(id);
  if (listeners) {
    listeners.forEach((l) => l());
  }
}

/**
 * Get the current state snapshot for a component id.
 *
 * Returns a default zero state when the id is not registered — this matches
 * React's `useSyncExternalStore` requirement for a stable, non-null snapshot.
 *
 * **Note:** The returned object is a new reference on every registration /
 * update cycle. Consumers that need referential stability should use
 * `useSyncExternalStore` with this function as `getSnapshot`.
 */
export function getComponentState(id: string): ComponentState {
  return _registry.get(id) ?? DEFAULT_STATE;
}

/**
 * Subscribe to state changes for a specific component id.
 *
 * Returns an unsubscribe function — pass directly to React's
 * `useSyncExternalStore`:
 *
 * ```ts
 * useSyncExternalStore(
 *   (cb) => subscribeComponentState('myBtn', cb),
 *   ()  => getComponentState('myBtn'),
 * )
 * ```
 */
export function subscribeComponentState(
  id: string,
  listener: () => void
): () => void {
  if (!_listeners.has(id)) {
    _listeners.set(id, new Set());
  }
  const set = _listeners.get(id)!;
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}
