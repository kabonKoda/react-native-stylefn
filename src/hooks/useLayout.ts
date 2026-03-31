import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutInfo } from '../types';

// ─── Optional reanimated integration ─────────────────────────────────────────
// react-native-reanimated is an optional peer dependency.
//
// We probe for it **once at module load time**. The result never changes for
// the lifetime of the app, so the exported `useLayout` always resolves to the
// same underlying function — React's rules-of-hooks are never violated
// (a given component always calls the same hooks in the same order).
//
// Path A — reanimated available:
//   • Shared values are updated on **every** layout event (zero-overhead for
//     animations; no React re-render triggered).
//   • React state is only flushed after DEBOUNCE_MS of silence, so a
//     continuously-resizing view produces exactly **one** re-render per
//     resize gesture instead of one per frame.
//
// Path B — reanimated NOT available:
//   • React state is flushed after DEBOUNCE_MS of silence (same benefit,
//     no shared-value overhead).

type SharedValue<T> = { value: T };

interface ReanimatedModule {
  useSharedValue: <T>(init: T) => SharedValue<T>;
}

let _reanimated: ReanimatedModule | null = null;
try {
  _reanimated = require('react-native-reanimated') as ReanimatedModule; // eslint-disable-line @typescript-eslint/no-require-imports
} catch {
  _reanimated = null;
}

/**
 * How long (ms) to wait after the **last** layout event before flushing
 * React state. Keeps re-render counts low during continuous resize gestures.
 * Override with the `debounceMs` option if you need a different value.
 */
export const LAYOUT_DEBOUNCE_MS = 100;

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Return type of `useLayout()`.
 *
 * Uses `any` for the ref and onLayout event types to avoid cross-installation
 * type conflicts in monorepo setups (where the library's react-native types
 * may differ from the consumer's).
 */
export interface UseLayoutReturn extends LayoutInfo {
  /** Ref to attach to the component you want to measure. Pass as `ref={ref}` on a View. */
  ref: React.RefObject<any>;
  /** Whether the component has been measured at least once */
  measured: boolean;
  /** The onLayout handler. Pass as `onLayout={onLayout}` on the same View. */
  onLayout: (event: any) => void;
  /**
   * Reanimated shared value for **width** — updated *immediately* on every
   * layout event (no debounce). Use this with `useAnimatedStyle` to drive
   * layout-responsive animations without triggering React re-renders on
   * every frame.
   *
   * `null` when `react-native-reanimated` is not installed.
   *
   * @example
   * ```tsx
   * const { ref, onLayout, sharedWidth } = useLayout();
   *
   * const animStyle = useAnimatedStyle(() => ({
   *   opacity: sharedWidth?.value ?? 1 > 300 ? 1 : 0.5,
   * }));
   * ```
   */
  sharedWidth: SharedValue<number> | null;
  /**
   * Reanimated shared value for **height** — updated *immediately* on every
   * layout event (no debounce). Use this with `useAnimatedStyle` to drive
   * layout-responsive animations without triggering React re-renders on
   * every frame.
   *
   * `null` when `react-native-reanimated` is not installed.
   */
  sharedHeight: SharedValue<number> | null;
}

// ─── Path A — reanimated-backed implementation ────────────────────────────────

/**
 * Layout hook that uses `useSharedValue` for immediate dimension tracking and
 * debounces React state updates for React-side re-rendering.
 *
 * Only assigned when react-native-reanimated is available.
 */
function useLayoutWithReanimated(): UseLayoutReturn {
  const r = _reanimated!;

  // Shared values — updated synchronously on the JS thread on every layout
  // event. Reanimated's worklet system can read these on the UI thread without
  // ever touching React state.
  const sharedWidth = r.useSharedValue(0);
  const sharedHeight = r.useSharedValue(0);

  // React state — the "committed" dimensions. Only updated after the debounce
  // fires, so a rapid resize sequence causes only one re-render.
  const [layout, setLayout] = useState<LayoutInfo>({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const ref = useRef<any>(null);
  const measuredRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest pending layout — we only ever read this inside the debounce callback
  const pendingLayout = useRef<LayoutInfo>({ width: 0, height: 0 });

  const onLayout = useCallback(
    (event: any) => {
      const { width, height } = event.nativeEvent.layout;

      // ── 1. Shared values update immediately (no React overhead) ──────────
      sharedWidth.value = width;
      sharedHeight.value = height;

      // ── 2. Cache the latest dimensions ───────────────────────────────────
      pendingLayout.current = { width, height };

      // ── 3. Debounce React state flush ─────────────────────────────────────
      // Cancel any in-flight timer so only the final size triggers a render.
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        const { width: w, height: h } = pendingLayout.current;
        setLayout((prev) => {
          if (prev.width === w && prev.height === h) return prev;
          return { width: w, height: h };
        });
        if (!measuredRef.current) {
          measuredRef.current = true;
          setMeasured(true);
        }
      }, LAYOUT_DEBOUNCE_MS);
    },
    // sharedWidth / sharedHeight are stable refs (same object across renders)
    [sharedWidth, sharedHeight]
  );

  // Clean up any pending debounce timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    ref,
    width: layout.width,
    height: layout.height,
    measured,
    onLayout,
    sharedWidth,
    sharedHeight,
  };
}

// ─── Path B — debounce-only implementation (no reanimated) ───────────────────

/**
 * Layout hook that debounces React state updates using only core React
 * primitives. Used when react-native-reanimated is not installed.
 */
function useLayoutWithDebounce(): UseLayoutReturn {
  const [layout, setLayout] = useState<LayoutInfo>({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const ref = useRef<any>(null);
  const measuredRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayout = useRef<LayoutInfo>({ width: 0, height: 0 });

  const onLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;

    // ── 1. Cache the latest dimensions ───────────────────────────────────
    pendingLayout.current = { width, height };

    // ── 2. Debounce React state flush ─────────────────────────────────────
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      const { width: w, height: h } = pendingLayout.current;
      setLayout((prev) => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
      if (!measuredRef.current) {
        measuredRef.current = true;
        setMeasured(true);
      }
    }, LAYOUT_DEBOUNCE_MS);
  }, []);

  // Clean up any pending debounce timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    ref,
    width: layout.width,
    height: layout.height,
    measured,
    onLayout,
    sharedWidth: null,
    sharedHeight: null,
  };
}

// ─── Public export ─────────────────────────────────────────────────────────────

/**
 * Hook that measures a component's layout dimensions via `onLayout`.
 *
 * Returns a `ref` to attach to the target component, plus the measured
 * `width` and `height` (both `0` until the first layout pass).
 *
 * ### Performance
 * Layout events during continuous resize gestures (e.g. split-screen drag,
 * window resize on web) fire rapidly. To avoid a re-render storm, this hook
 * **debounces React state updates** — it only commits new dimensions once
 * layout events stop arriving for `LAYOUT_DEBOUNCE_MS` (100 ms by default).
 *
 * When `react-native-reanimated` is installed, dimensions are **also** stored
 * in Reanimated shared values (`sharedWidth` / `sharedHeight`) that update on
 * every event with zero React overhead — perfect for driving `useAnimatedStyle`
 * without waiting for the debounce.
 *
 * @example Basic usage
 * ```tsx
 * import { useLayout } from 'react-native-stylefn';
 *
 * function MyComponent() {
 *   const { ref, width, height, onLayout } = useLayout();
 *
 *   return (
 *     <View ref={ref} onLayout={onLayout} style={{ flex: 1 }}>
 *       <View style={{ width: width / 2, height: height / 3 }} />
 *       <Text>Parent is {width}×{height}</Text>
 *     </View>
 *   );
 * }
 * ```
 *
 * @example Driving animations (reanimated)
 * ```tsx
 * const { ref, onLayout, sharedWidth } = useLayout();
 *
 * const animStyle = useAnimatedStyle(() => ({
 *   transform: [{ scaleX: (sharedWidth?.value ?? 0) / 300 }],
 * }));
 * ```
 *
 * @example Using with style functions
 * ```tsx
 * const { ref, onLayout, width, height } = useLayout();
 *
 * <View
 *   ref={ref}
 *   onLayout={onLayout}
 *   style={(t) => ({
 *     flex: 1,
 *     backgroundColor: width > 400 ? t.colors.primary : t.colors.secondary,
 *   })}
 * />
 * ```
 */
export const useLayout: () => UseLayoutReturn = _reanimated
  ? useLayoutWithReanimated
  : useLayoutWithDebounce;
