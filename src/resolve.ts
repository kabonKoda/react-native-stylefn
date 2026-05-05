import { useEffect, useRef, useState } from 'react';
import { getTokenStore, subscribeTokenStore } from './store';
import { resolveViewportUnits } from './units';
import type { MutableRefObject } from 'react';

// =============================================================================
// Proxy-based dependency tracking
//
// When a style/prop function runs, we wrap the token store in a Proxy that
// records which paths were accessed (e.g. "dark", "colors.text",
// "custom.isOpen"). The component then only re-renders when those specific
// values change — not on every token store update.
// =============================================================================

/**
 * Token dependency ref — holds the set of token paths a component accesses.
 * Shared between `__subscribeStyleFn` (reads deps) and `__resolveStyle` /
 * `__resolveProp` / `__resolveChildren` (writes deps).
 */
export type DepsRef = MutableRefObject<Set<string>>;

/**
 * Creates a Proxy around `target` that records every property path accessed
 * into `accessed`. Recurses into nested objects so `t.colors.text` records
 * the path `"colors.text"`.
 *
 * Functions (like `t.vw`, `t.calc`, `t.rem`) and arrays are returned as-is
 * without further proxying.
 */
function createTrackingProxy(
  target: Record<string, unknown>,
  accessed: Set<string>,
  prefix = ''
): unknown {
  return new Proxy(target, {
    get(obj, prop) {
      // Symbols and internal props pass through
      if (typeof prop === 'symbol') return (obj as any)[prop];

      const key = prefix ? `${prefix}.${String(prop)}` : String(prop);
      const value = (obj as any)[prop];

      // Recurse into plain objects (t.colors, t.custom, t.theme, etc.)
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof value !== 'function'
      ) {
        return createTrackingProxy(
          value as Record<string, unknown>,
          accessed,
          key
        );
      }

      // Record the leaf access
      accessed.add(key);
      return value;
    },
  });
}

/**
 * Reads a nested value from `obj` by dot-separated path.
 * e.g. getNestedValue(store, "colors.text") → store.colors.text
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// =============================================================================
// Resolve functions — called at render time by the Babel-injected code
// =============================================================================

/**
 * Returns true for Reanimated animated style handles. These must pass
 * through `__resolveStyle` untouched so `Animated.*` components keep
 * detecting them via their `viewDescriptors` marker.
 */
function isAnimatedStyleHandle(value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    (value as { viewDescriptors?: unknown }).viewDescriptors !== undefined
  );
}

/**
 * Resolves a style value at render time.
 * - If it's a function, calls it with the current token store.
 * - If it's an array, maps over it resolving any functions.
 * - Otherwise returns it as-is.
 *
 * When `depsRef` is provided (injected by the Babel plugin), the token store
 * is wrapped in a tracking Proxy so the component knows which token paths
 * were accessed and can subscribe selectively.
 *
 * After resolution, any string values containing viewport units
 * (e.g. '50vw', '100vh') are automatically converted to pixel numbers.
 *
 * Reanimated animated style handles (objects with `viewDescriptors`) are
 * passed through unchanged so `Animated.*` detection keeps working.
 */
export function __resolveStyle(value: unknown, depsRef?: DepsRef): unknown {
  // Reanimated animated style handles must reach Animated.View intact —
  // any iteration / spread / re-creation breaks the worklet binding.
  if (isAnimatedStyleHandle(value)) return value;

  if (typeof value === 'function') {
    const store = getTokenStore();
    let resolved: unknown;
    if (depsRef) {
      const tracked = new Set<string>();
      const proxy = createTrackingProxy(
        store as unknown as Record<string, unknown>,
        tracked
      );
      resolved = value(proxy);
      // Merge tracked deps into the component-level set
      tracked.forEach((d) => depsRef.current.add(d));
    } else {
      resolved = value(store);
    }
    return resolveViewportUnits(resolved);
  }

  if (Array.isArray(value)) {
    return value.map((s) => {
      if (isAnimatedStyleHandle(s)) return s;
      if (typeof s === 'function') {
        const store = getTokenStore();
        let resolved: unknown;
        if (depsRef) {
          const tracked = new Set<string>();
          const proxy = createTrackingProxy(
            store as unknown as Record<string, unknown>,
            tracked
          );
          resolved = s(proxy);
          tracked.forEach((d) => depsRef.current.add(d));
        } else {
          resolved = s(store);
        }
        return resolveViewportUnits(resolved);
      }
      return resolveViewportUnits(s);
    });
  }

  return resolveViewportUnits(value);
}

/**
 * Resolves a children value at render time.
 * - If it's a function, calls it with the current token store + layout `{0,0}`.
 * - Otherwise returns it as-is.
 *
 * Used for Fragment children and `children` attribute props where no parent
 * element measurement is available.
 */
export function __resolveChildren(value: unknown, depsRef?: DepsRef): unknown {
  if (typeof value === 'function') {
    const store = getTokenStore();
    const storeWithLayout = { ...store, layout: { width: 0, height: 0 } };
    if (depsRef) {
      const tracked = new Set<string>();
      const proxy = createTrackingProxy(
        storeWithLayout as unknown as Record<string, unknown>,
        tracked
      );
      const result = value(proxy);
      tracked.forEach((d) => depsRef.current.add(d));
      return result;
    }
    return value(storeWithLayout);
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
 */
export function __resolveProp(value: unknown, depsRef?: DepsRef): unknown {
  if (typeof value === 'function') {
    const store = getTokenStore();
    if (depsRef) {
      const tracked = new Set<string>();
      const proxy = createTrackingProxy(
        store as unknown as Record<string, unknown>,
        tracked
      );
      const result = value(proxy);
      tracked.forEach((d) => depsRef.current.add(d));
      return result;
    }
    return value(store);
  }
  return value;
}

// =============================================================================
// Selective subscription hook
// =============================================================================

/**
 * Subscribes the calling component to token store changes, but **only**
 * re-renders when the specific token paths accessed by the component's style
 * functions actually change.
 *
 * Returns a `depsRef` that `__resolveStyle` / `__resolveProp` /
 * `__resolveChildren` populate during each render via a tracking Proxy.
 *
 * **Injected automatically by the Babel plugin** as:
 * ```js
 * const __deps = __subscribeStyleFn();
 * ```
 *
 * The `useEffect` subscribes once on mount. On each store notification it
 * compares only the recorded dependency values — if none changed, the
 * component is NOT re-rendered.
 */
export function __subscribeStyleFn(): DepsRef {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const depsRef = useRef<Set<string>>(new Set());
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const prevRef = useRef<Record<string, unknown>>({});
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [, forceRender] = useState(0);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    // Snapshot current dep values on mount so the first comparison works
    const store = getTokenStore();
    const deps = depsRef.current;
    for (const dep of deps) {
      prevRef.current[dep] = getNestedValue(store, dep);
    }

    const unsub = subscribeTokenStore(() => {
      const currentStore = getTokenStore();
      const currentDeps = depsRef.current;

      // If no deps tracked yet (shouldn't happen, but be safe), skip
      if (currentDeps.size === 0) return;

      // Check if any dependency value changed
      let changed = false;
      for (const dep of currentDeps) {
        const newVal = getNestedValue(currentStore, dep);
        if (!Object.is(newVal, prevRef.current[dep])) {
          changed = true;
          break;
        }
      }

      if (changed) {
        // Snapshot new values
        for (const dep of currentDeps) {
          prevRef.current[dep] = getNestedValue(currentStore, dep);
        }
        forceRender((c) => c + 1);
      }
    });
    return unsub;
  }, []);

  return depsRef;
}
