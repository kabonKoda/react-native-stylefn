import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutInfo } from '../types';

// ─── Optional reanimated integration ─────────────────────────────────────────
// react-native-reanimated is an optional peer dependency.
//
// We probe for it **once at module load time**. The result never changes for
// the lifetime of the app, so the exported `useLayout` always resolves to the
// same underlying function — React's rules-of-hooks are never violated
// (a given component always calls the same hooks in the same order).

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

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * How long (ms) with **no new** `onLayout` events before the scheduler
 * considers layout "settled" and performs one final immediate flush of all
 * pending dimensions.
 */
export const LAYOUT_DEBOUNCE_MS = 100;

/**
 * How often (ms) the global `LayoutFlushScheduler` flushes pending layout
 * updates to React state **during** an active resize gesture.
 *
 * All registered `useLayout` instances are flushed together in a single pass,
 * so N simultaneously-resizing views produce **one** React re-render wave per
 * interval tick instead of N cascading individual `setState` calls.
 *
 * Lower = dimensions update more often during resize (more renders).
 * Higher = fewer renders, but layout dimensions lag more during a gesture.
 *
 * The scheduler always does one extra final flush after `LAYOUT_DEBOUNCE_MS`
 * of silence regardless of this interval, so the committed dimensions are
 * always accurate after a gesture ends.
 */
export const LAYOUT_FLUSH_INTERVAL_MS = 2000;

// ─── LayoutFlushScheduler ─────────────────────────────────────────────────────

/**
 * Global singleton that batches `useLayout` React state flushes across ALL
 * mounted instances.
 *
 * ### The problem with per-instance debounce timers
 * Each `useLayout` previously had its own independent debounce. When a resize
 * gesture pauses, every instance fires its debounce simultaneously → N
 * separate `setState` calls → N cascading re-render waves (observed: 36
 * cascaded fires → 78 renders for 14 instances in a single gesture).
 *
 * ### Solution: one scheduler, batched flushes
 * - **During resize**: ONE `setInterval` at `LAYOUT_FLUSH_INTERVAL_MS` calls
 *   every dirty instance's flush callback in the same tick. React 18+'s
 *   automatic batching collapses those into a **single re-render**.
 * - **After settle**: ONE `setTimeout` fires `LAYOUT_DEBOUNCE_MS` after the
 *   last `onLayout` event, performs a final flush of all instances, then stops
 *   the interval. The settled dimensions are always committed accurately.
 * - **On unmount**: the instance is unregistered. When zero instances remain,
 *   all timers are cleared immediately (no leaks).
 */
class LayoutFlushScheduler {
  private entries = new Map<number, { flush: () => void; dirty: boolean }>();
  private nextId = 0;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private settleHandle: ReturnType<typeof setTimeout> | null = null;

  /**
   * Register a flush callback. Returns a stable numeric ID used for
   * `unregister()` and `markDirty()` calls.
   *
   * Call this once on mount (inside `useEffect`).
   */
  register(flush: () => void): number {
    const id = ++this.nextId;
    this.entries.set(id, { flush, dirty: false });
    return id;
  }

  /**
   * Unregister an instance (call from `useEffect` cleanup on unmount).
   * If no instances remain, all timers are stopped immediately.
   */
  unregister(id: number): void {
    this.entries.delete(id);
    if (this.entries.size === 0) {
      this._stop();
    }
  }

  /**
   * Mark an instance as dirty and ensure the scheduler is running.
   * Called by each instance's `onLayout` handler on every native layout event.
   */
  markDirty(id: number): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.dirty = true;
    }
    this._ensureIntervalRunning();
    this._resetSettleTimer();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _ensureIntervalRunning(): void {
    if (this.intervalHandle !== null) return;
    this.intervalHandle = setInterval(
      () => this._flushDirty(),
      LAYOUT_FLUSH_INTERVAL_MS
    );
  }

  private _resetSettleTimer(): void {
    if (this.settleHandle !== null) {
      clearTimeout(this.settleHandle);
    }
    this.settleHandle = setTimeout(() => {
      this.settleHandle = null;
      // Commit the final settled dimensions to React state
      this._flushDirty();
      // No more events expected — stop the periodic interval
      this._stopInterval();
    }, LAYOUT_DEBOUNCE_MS);
  }

  /**
   * Flush all dirty entries in one pass.
   *
   * React 18+ automatically batches all `setState` calls made within a
   * `setTimeout` / `setInterval` callback, so every instance's `setLayout`
   * call here is collapsed into a **single re-render**.
   */
  private _flushDirty(): void {
    this.entries.forEach((entry) => {
      if (entry.dirty) {
        entry.dirty = false;
        entry.flush();
      }
    });
  }

  private _stopInterval(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private _stop(): void {
    this._stopInterval();
    if (this.settleHandle !== null) {
      clearTimeout(this.settleHandle);
      this.settleHandle = null;
    }
  }
}

/** Module-level singleton — one scheduler shared across every `useLayout` instance. */
const _scheduler = new LayoutFlushScheduler();

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
   * layout event (no batching delay). Use this with `useAnimatedStyle` to
   * drive layout-responsive animations without triggering React re-renders.
   *
   * `null` when `react-native-reanimated` is not installed.
   *
   * @example
   * ```tsx
   * const { ref, onLayout, sharedWidth } = useLayout();
   *
   * const animStyle = useAnimatedStyle(() => ({
   *   opacity: (sharedWidth?.value ?? 0) > 300 ? 1 : 0.5,
   * }));
   * ```
   */
  sharedWidth: SharedValue<number> | null;
  /**
   * Reanimated shared value for **height** — updated *immediately* on every
   * layout event (no batching delay).
   *
   * `null` when `react-native-reanimated` is not installed.
   */
  sharedHeight: SharedValue<number> | null;
}

// ─── Path A — reanimated-backed implementation ────────────────────────────────

/**
 * Layout hook — reanimated path.
 *
 * Shared values update on every `onLayout` event (zero React overhead).
 * React state is flushed via the global `LayoutFlushScheduler`.
 */
function useLayoutWithReanimated(): UseLayoutReturn {
  const r = _reanimated!;

  // Shared values — update synchronously on every layout event; reanimated
  // worklets on the UI thread can read these without touching React state.
  const sharedWidth = r.useSharedValue(0);
  const sharedHeight = r.useSharedValue(0);

  // React state — the "committed" dimensions for React-side consumers.
  // Only updated by the global scheduler (batched with all other instances).
  const [layout, setLayout] = useState<LayoutInfo>({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const ref = useRef<any>(null);
  const measuredRef = useRef(false);
  // Latest pending layout — read by the flush callback; always up-to-date.
  const pendingLayout = useRef<LayoutInfo>({ width: 0, height: 0 });
  // Scheduler registration ID — set after first effect runs.
  const schedulerIdRef = useRef<number | null>(null);

  // Register with the global scheduler on mount; unregister on unmount.
  // The flush closure captures only stable refs and state setters — no deps needed.
  useEffect(() => {
    const id = _scheduler.register(() => {
      const { width: w, height: h } = pendingLayout.current;
      setLayout((prev) => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
      if (!measuredRef.current) {
        measuredRef.current = true;
        setMeasured(true);
      }
    });
    schedulerIdRef.current = id;
    return () => {
      _scheduler.unregister(id);
      schedulerIdRef.current = null;
    };
  }, []);

  const onLayout = useCallback(
    (event: any) => {
      const { width, height } = event.nativeEvent.layout;

      // ── 1. Shared values — immediate update, zero React overhead ─────────
      sharedWidth.value = width;
      sharedHeight.value = height;

      // ── 2. Cache latest dimensions for the flush callback ─────────────────
      pendingLayout.current = { width, height };

      // ── 3. Tell the global scheduler this instance has pending dimensions ─
      const id = schedulerIdRef.current;
      if (id !== null) {
        _scheduler.markDirty(id);
      }
    },
    // sharedWidth / sharedHeight are stable objects (same ref across renders)
    [sharedWidth, sharedHeight]
  );

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

// ─── Path B — scheduler-only implementation (no reanimated) ──────────────────

/**
 * Layout hook — no-reanimated path.
 *
 * React state is flushed via the global `LayoutFlushScheduler`.
 * `sharedWidth` / `sharedHeight` are always `null`.
 */
function useLayoutWithDebounce(): UseLayoutReturn {
  const [layout, setLayout] = useState<LayoutInfo>({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const ref = useRef<any>(null);
  const measuredRef = useRef(false);
  const pendingLayout = useRef<LayoutInfo>({ width: 0, height: 0 });
  const schedulerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const id = _scheduler.register(() => {
      const { width: w, height: h } = pendingLayout.current;
      setLayout((prev) => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
      if (!measuredRef.current) {
        measuredRef.current = true;
        setMeasured(true);
      }
    });
    schedulerIdRef.current = id;
    return () => {
      _scheduler.unregister(id);
      schedulerIdRef.current = null;
    };
  }, []);

  const onLayout = useCallback((event: any) => {
    const { width, height } = event.nativeEvent.layout;

    // Cache latest dimensions for the flush callback
    pendingLayout.current = { width, height };

    // Notify global scheduler
    const id = schedulerIdRef.current;
    if (id !== null) {
      _scheduler.markDirty(id);
    }
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
 * ### Performance — global batched flush scheduler
 *
 * All `useLayout` instances share a single `LayoutFlushScheduler` that
 * eliminates the "debounce cascade" problem:
 *
 * - **During resize**: a `setInterval` at `LAYOUT_FLUSH_INTERVAL_MS` (2 s)
 *   flushes every pending instance **together** in one pass. React 18+'s
 *   automatic batching turns those N `setState` calls into a single re-render.
 * - **After settle**: `LAYOUT_DEBOUNCE_MS` (100 ms) after the last `onLayout`
 *   event, a final flush commits the accurate settled dimensions, then the
 *   interval stops.
 * - **On unmount**: the instance is unregistered; the scheduler stops entirely
 *   when the last instance unmounts.
 *
 * When `react-native-reanimated` is installed, `sharedWidth` / `sharedHeight`
 * (Reanimated `SharedValue`) update on **every** layout event with zero React
 * overhead — ideal for driving `useAnimatedStyle` without waiting for the
 * scheduler.
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
 *     backgroundColor: width > 400 ? t.colors.primary : t.colors.secondary,
 *   })}
 * />
 * ```
 */
export const useLayout: () => UseLayoutReturn = _reanimated
  ? useLayoutWithReanimated
  : useLayoutWithDebounce;
