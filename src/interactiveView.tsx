import React, {
  useState,
  useCallback,
  useContext,
  createContext,
  useEffect,
} from 'react';
import { useSyncExternalStore } from 'react';
import { getTokenStore, subscribeTokenStore } from './store';
import { resolveViewportUnits } from './units';
import type { StyleTokens } from './types';
import {
  registerComponent,
  unregisterComponent,
  updateComponentState,
} from './componentRegistry';

// =============================================================================
// Optional react-native-gesture-handler integration
//
// If `react-native-gesture-handler` (RNGH) is installed the component prefers
// `GestureDetector` + `Gesture.Tap` / `Gesture.Hover` — this is the most
// reliable cross-platform approach and works on iOS, Android, and Web alike.
//
// `.runOnJS(true)` lets the gesture callbacks run directly on the JS thread
// so we can call `setState` without needing the Reanimated Babel worklet
// compiler to process this file.
//
// If RNGH is not installed (or the component is not inside a
// `GestureHandlerRootView`), the implementation falls back to
// `onTouchStart` / `onTouchEnd` / `onTouchCancel` event props, which work
// on any React Native component.
// =============================================================================

/** Shape of the GestureHandler exports we need */
interface GestureHandlerModule {
  GestureDetector: React.ComponentType<{
    gesture: unknown;
    children: React.ReactNode;
  }>;
  Gesture: {
    Tap(): GestureTapInstance;
    Hover(): GestureHoverInstance;
    Simultaneous(...gestures: unknown[]): unknown;
  };
  /** Context set by GestureHandlerRootView — truthy when inside a root view */
  GestureHandlerRootViewContext: React.Context<boolean | undefined>;
}

interface GestureTapInstance {
  runOnJS(value: true): this;
  onBegin(handler: () => void): this;
  onFinalize(handler: () => void): this;
}

interface GestureHoverInstance {
  runOnJS(value: true): this;
  onBegin(handler: () => void): this;
  onEnd(handler: () => void): this;
}

// ── Module-level optional require ────────────────────────────────────────────

let _rngh: GestureHandlerModule | null = null;

try {
  // react-native-gesture-handler is optional — require is intentional here
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-gesture-handler') as GestureHandlerModule;
  if (mod && mod.GestureDetector && mod.Gesture) {
    _rngh = mod;
  }
} catch {
  // react-native-gesture-handler not installed — use touch-handler fallback
}

/**
 * A dummy context returned when RNGH is unavailable so `useContext` can always
 * be called unconditionally (satisfying React's rules-of-hooks).
 */
const _dummyContext = createContext<boolean | undefined>(undefined);

// =============================================================================
// __InteractiveView
//
// Internal wrapper component injected by the Babel plugin when a JSX element
// has `style` (or other prop) functions that reference `t.active` or `t.hovered`.
//
// ### How it works
//
// When the Babel plugin detects `t.active` or `t.hovered` inside a style
// function, it replaces the element with `__InteractiveView`:
//
// **Input** (developer writes):
// ```tsx
// <View style={(t) => ({
//   backgroundColor: t.active ? t.colors.accent : t.colors.surface,
//   opacity: t.active ? 0.7 : 1,
// })} />
// ```
//
// **Output** (Babel transforms to):
// ```tsx
// <__InteractiveView
//   __type={View}
//   __needsActive
//   __styleFn={(t) => ({
//     backgroundColor: t.active ? t.colors.accent : t.colors.surface,
//     opacity: t.active ? 0.7 : 1,
//   })}
// />
// ```
//
// ### Active state (`t.active`)
// **Primary (RNGH available + inside GestureHandlerRootView):**
//   `Gesture.Tap().runOnJS(true)` — `.onBegin` sets active=true,
//   `.onFinalize` sets active=false. Works on iOS, Android, and Web.
//
// **Fallback (RNGH unavailable or no GestureHandlerRootView ancestor):**
//   `onTouchStart` / `onTouchEnd` / `onTouchCancel` event props injected
//   directly on the wrapped component.
//
// ### Hovered state (`t.hovered`)
// **Primary (RNGH available + inside GestureHandlerRootView):**
//   `Gesture.Hover().runOnJS(true)` — `.onBegin` / `.onEnd`. Works on all
//   platforms that support pointer events (Web, iPad with pointer, etc.).
//
// **Fallback:**
//   `onMouseEnter` / `onMouseLeave` props (web-only, native React events).
//
// ### Composing gestures
// When both `__needsActive` and `__needsHovered` are set the two gestures are
// composed with `Gesture.Simultaneous()` and wrapped in a single
// `<GestureDetector>`.
//
// ### Composing with existing handlers
// User-provided `onTouchStart`, `onTouchEnd`, `onTouchCancel`, `onMouseEnter`,
// and `onMouseLeave` props are preserved and called alongside the injected
// state setters in the fallback path.
//
// **This component is for internal use by the Babel plugin only.**
// =============================================================================

function InteractiveViewWrapper({
  __type: Component,
  __needsActive = false,
  __needsHovered = false,
  __styleFn,
  __propFns,
  onTouchStart: userTouchStart,
  onTouchEnd: userTouchEnd,
  onTouchCancel: userTouchCancel,
  onMouseEnter: userMouseEnter,
  onMouseLeave: userMouseLeave,
  style: staticStyle,
  id,
  children,
  ...props
}: {
  /**
   * The original JSX element type (e.g. View, Text, Animated.View).
   * Passed as a Babel-injected `__type` prop so `__InteractiveView` can
   * render it with the augmented token store.
   */
  __type: React.ElementType;
  /**
   * True when the style/prop functions reference `t.active`.
   * Enables active-state gesture / touch-handler injection.
   */
  __needsActive?: boolean;
  /**
   * True when the style/prop functions reference `t.hovered`.
   * Enables hover-state gesture / mouse-handler injection.
   */
  __needsHovered?: boolean;
  /**
   * The raw `style` function (or array) that references `t.active` / `t.hovered`.
   * Resolved here with the augmented token store so the active/hovered
   * boolean reflects the current interaction state.
   */
  __styleFn?: ((tokens: StyleTokens) => any) | any[] | any;
  /**
   * Non-`style` prop functions that also reference `t.active` / `t.hovered`.
   * Keys are the original prop names; values are the raw token functions.
   */
  __propFns?: Record<string, ((tokens: StyleTokens) => any) | any>;
  /** User's own `onTouchStart` handler (preserved + composed in fallback). */
  onTouchStart?: (event: any) => void;
  /** User's own `onTouchEnd` handler (preserved + composed in fallback). */
  onTouchEnd?: (event: any) => void;
  /** User's own `onTouchCancel` handler (preserved + composed in fallback). */
  onTouchCancel?: (event: any) => void;
  /** User's own `onMouseEnter` handler (preserved + composed in fallback). */
  onMouseEnter?: (event: any) => void;
  /** User's own `onMouseLeave` handler (preserved + composed in fallback). */
  onMouseLeave?: (event: any) => void;
  /** Pre-resolved (non-interactive) `style` value. Merged with `__styleFn`. */
  style?: any;
  /**
   * Optional string identifier that registers this component in the
   * per-component state registry.  Pass the same string to
   * `useInteractiveFn(id)` or `useStyleFn(id)` from anywhere in the tree to
   * observe this component's live `active` and `hovered` state.
   *
   * ```tsx
   * // Register:
   * <View id="submitBtn" style={(t) => ({ opacity: t.active ? 0.7 : 1 })} />
   *
   * // Observe (from a sibling, parent, or completely separate component):
   * const { active } = useInteractiveFn('submitBtn');
   * ```
   */
  id?: string;
  children?: React.ReactNode;
  [key: string]: any;
}): React.JSX.Element {
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);

  // ── Per-component state registry ───────────────────────────────────────────
  // Register on mount, unregister on unmount.  Safe when `id` is undefined.
  useEffect(() => {
    if (!id) return;
    registerComponent(id);
    return () => {
      unregisterComponent(id);
    };
  }, [id]);

  // Sync live active / hovered state into the registry so external observers
  // (useInteractiveFn / useStyleFn) always see the current values.
  useEffect(() => {
    if (!id) return;
    updateComponentState(id, { active, hovered });
  }, [id, active, hovered]);

  // Subscribe to the global token store — re-renders on dark mode,
  // orientation, breakpoint, and custom token changes.
  useSyncExternalStore(subscribeTokenStore, getTokenStore, getTokenStore);

  // ── Check whether we have a GestureHandlerRootView ancestor ────────────────
  // We always call useContext (rules of hooks) but fall back to the dummy
  // context when RNGH is not installed.
  const rootViewCtx = useContext(
    _rngh?.GestureHandlerRootViewContext ?? _dummyContext
  );
  const useGestures = Boolean(_rngh && rootViewCtx);

  // ── Build the augmented local token store ──────────────────────────────────
  const baseStore = getTokenStore();
  const localTokens: StyleTokens = {
    ...baseStore,
    active: __needsActive ? active : baseStore.active,
    hovered: __needsHovered ? hovered : baseStore.hovered,
  };

  // ── Resolve the interactive style ──────────────────────────────────────────
  let resolvedInteractiveStyle: any;
  if (__styleFn !== undefined) {
    if (typeof __styleFn === 'function') {
      resolvedInteractiveStyle = resolveViewportUnits(__styleFn(localTokens));
    } else if (Array.isArray(__styleFn)) {
      resolvedInteractiveStyle = __styleFn.map((item) =>
        typeof item === 'function'
          ? resolveViewportUnits(item(localTokens))
          : resolveViewportUnits(item)
      );
    } else {
      resolvedInteractiveStyle = resolveViewportUnits(__styleFn);
    }
  }

  const finalStyle =
    staticStyle !== undefined && resolvedInteractiveStyle !== undefined
      ? [staticStyle, resolvedInteractiveStyle]
      : staticStyle ?? resolvedInteractiveStyle;

  // ── Resolve interactive non-style prop functions ────────────────────────────
  const resolvedPropFns: Record<string, any> = {};
  if (__propFns) {
    for (const [key, fn] of Object.entries(__propFns)) {
      const resolved = typeof fn === 'function' ? fn(localTokens) : fn;
      resolvedPropFns[key] =
        key === 'style' || key.endsWith('Style')
          ? resolveViewportUnits(resolved)
          : resolved;
    }
  }

  // ── Touch / mouse fallback handlers ───────────────────────────────────────
  //
  // These are declared unconditionally (before any early return) to satisfy
  // React's rules-of-hooks.  When the RNGH path is taken they are simply not
  // attached to any component and are discarded by the GC.

  const handleTouchStart = useCallback(
    (e: any) => {
      if (__needsActive) setActive(true);
      userTouchStart?.(e);
    },
    [__needsActive, userTouchStart]
  );

  const handleTouchEnd = useCallback(
    (e: any) => {
      if (__needsActive) setActive(false);
      userTouchEnd?.(e);
    },
    [__needsActive, userTouchEnd]
  );

  const handleTouchCancel = useCallback(
    (e: any) => {
      if (__needsActive) setActive(false);
      userTouchCancel?.(e);
    },
    [__needsActive, userTouchCancel]
  );

  const handleMouseEnter = useCallback(
    (e: any) => {
      if (__needsHovered) setHovered(true);
      userMouseEnter?.(e);
    },
    [__needsHovered, userMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: any) => {
      if (__needsHovered) setHovered(false);
      userMouseLeave?.(e);
    },
    [__needsHovered, userMouseLeave]
  );

  // ── Branch: RNGH GestureDetector (primary) ─────────────────────────────────
  if (useGestures && _rngh) {
    const { GestureDetector, Gesture } = _rngh;

    // Build individual gestures
    const gestures: unknown[] = [];

    if (__needsActive) {
      const tap = Gesture.Tap()
        .runOnJS(true)
        .onBegin(() => setActive(true))
        .onFinalize(() => setActive(false));
      gestures.push(tap);
    }

    if (__needsHovered) {
      const hover = Gesture.Hover()
        .runOnJS(true)
        .onBegin(() => setHovered(true))
        .onEnd(() => setHovered(false));
      gestures.push(hover);
    }

    // Compose gestures — Simultaneous when there are two, single when one
    const composedGesture =
      gestures.length >= 2 ? Gesture.Simultaneous(...gestures) : gestures[0];

    // Build inner component props (no touch/mouse handlers needed here)
    const innerProps: Record<string, any> = {
      ...props,
      ...resolvedPropFns,
    };
    if (finalStyle !== undefined) innerProps.style = finalStyle;
    // Forward id to the actual component (e.g. for web HTML id / nativeID)
    if (id !== undefined) innerProps.id = id;

    // Preserve any user-provided touch/mouse handlers on the inner component
    if (userTouchStart) innerProps.onTouchStart = userTouchStart;
    if (userTouchEnd) innerProps.onTouchEnd = userTouchEnd;
    if (userTouchCancel) innerProps.onTouchCancel = userTouchCancel;
    if (userMouseEnter) innerProps.onMouseEnter = userMouseEnter;
    if (userMouseLeave) innerProps.onMouseLeave = userMouseLeave;

    return (
      <GestureDetector gesture={composedGesture}>
        {React.createElement(Component, innerProps, children)}
      </GestureDetector>
    );
  }

  // ── Branch: touch/mouse fallback ───────────────────────────────────────────

  const fallbackProps: Record<string, any> = {
    ...props,
    ...resolvedPropFns,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };

  if (__needsHovered || userMouseEnter !== undefined) {
    fallbackProps.onMouseEnter = handleMouseEnter;
  }
  if (__needsHovered || userMouseLeave !== undefined) {
    fallbackProps.onMouseLeave = handleMouseLeave;
  }

  if (finalStyle !== undefined) {
    fallbackProps.style = finalStyle;
  }
  // Forward id to the actual component (e.g. for web HTML id / nativeID)
  if (id !== undefined) fallbackProps.id = id;

  return React.createElement(Component, fallbackProps, children);
}

// Export under the double-underscore name the Babel plugin injects.
export { InteractiveViewWrapper as __InteractiveView };
