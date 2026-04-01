import React, { useCallback, useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { getTokenStore, subscribeTokenStore } from './store';
import { useLayout } from './hooks/useLayout';
import type { ChildrenTokens } from './types';
import {
  registerComponent,
  unregisterComponent,
  updateComponentState,
} from './componentRegistry';

/**
 * Internal wrapper component injected by the Babel plugin when a JSX element
 * has a children-as-function pattern.
 *
 * When the Babel plugin detects:
 * ```tsx
 * <View style={(t) => ({ flex: 1 })}>
 *   {({ layout }) => <Text>{layout.width}</Text>}
 * </View>
 * ```
 *
 * It transforms it to:
 * ```tsx
 * <__LayoutView __type={View} __childFn={({ layout }) => <Text>{layout.width}</Text>} style={__resolveStyle(...)} />
 * ```
 *
 * `__LayoutView` renders the original component (`__type`) with an `onLayout`
 * handler that measures its dimensions, then calls `__childFn` with the full
 * token store augmented with `layout: { width, height }`.
 *
 * ### Performance
 * Layout tracking is delegated to `useLayout`, which:
 * - Updates Reanimated shared values on **every** layout event (zero React
 *   overhead) when `react-native-reanimated` is installed.
 * - Debounces React state updates so a continuously-resizing view only causes
 *   a **single re-render** per resize gesture, not one per frame.
 *
 * - `layout.width` / `layout.height` start at `0` and update after the first
 *   layout pass (causing a re-render with real dimensions).
 * - The user's existing `onLayout` prop (if any) is preserved and called too.
 * - All other props are forwarded to the original component unchanged.
 *
 * **This component is for internal use by the Babel plugin only.**
 * Users should NOT import or use `__LayoutView` directly.
 */

/**
 * Internal implementation — named with an uppercase letter so React's
 * rules-of-hooks linter recognises it as a valid function component.
 * Exported under the `__LayoutView` alias that the Babel plugin uses.
 */
function LayoutViewWrapper({
  __type: Component,
  __childFn,
  onLayout: userOnLayout,
  id,
  children,
  ...props
}: {
  /** The original JSX element type (e.g. View, ScrollView, Animated.View) */
  __type: React.ElementType;
  /** The children function that receives ChildrenTokens (including layout) */
  __childFn?: ((tokens: ChildrenTokens) => React.ReactNode) | React.ReactNode;
  /** User's own onLayout handler (preserved and called after layout update) */
  onLayout?: (event: any) => void;
  /**
   * Optional string identifier that registers this component in the
   * per-component state registry.  Pass the same string to
   * `useLayoutFn(id)` or `useStyleFn(id)` from anywhere in the tree to
   * observe this component's measured `layout` dimensions.
   *
   * ```tsx
   * <View id="heroCard">
   *   {({ layout }) => <View style={{ width: layout.width / 2 }} />}
   * </View>
   *
   * // From a sibling or parent:
   * const { width, height } = useLayoutFn('heroCard');
   * ```
   */
  id?: string;
  /** Any remaining static children (non-function siblings of the child fn) */
  children?: React.ReactNode;
  [key: string]: any;
}): React.JSX.Element {
  // Subscribe to the full store — re-renders on dark mode, orientation,
  // screen resize, AND custom token changes. Safe because StyleProvider
  // uses _StableChildren to prevent cascading.
  useSyncExternalStore(subscribeTokenStore, getTokenStore, getTokenStore);

  // Delegate layout tracking to useLayout.
  // • When react-native-reanimated is installed: shared values update on every
  //   event; React state is debounced → one re-render per resize gesture.
  // • Without reanimated: React state is debounced → same low-re-render benefit.
  const { width, height, onLayout: layoutOnLayout } = useLayout();

  // ── Per-component state registry ───────────────────────────────────────────
  // Register on mount, unregister on unmount.  Safe when `id` is undefined.
  useEffect(() => {
    if (!id) return;
    registerComponent(id);
    return () => {
      unregisterComponent(id);
    };
  }, [id]);

  // Sync live layout dimensions into the registry so external observers
  // (useLayoutFn / useStyleFn) always see the current values.
  useEffect(() => {
    if (!id) return;
    updateComponentState(id, { layout: { width, height } });
  }, [id, width, height]);

  // Compose the layout handler with the user's own onLayout prop (if any).
  const handleLayout = useCallback(
    (event: any) => {
      layoutOnLayout(event);
      userOnLayout?.(event);
    },
    [layoutOnLayout, userOnLayout]
  );

  // Merge current layout into the global token store for this render
  const tokens: ChildrenTokens = {
    ...getTokenStore(),
    layout: { width, height },
  };

  // Resolve the children function with layout-aware tokens
  const fnChildren =
    typeof __childFn === 'function' ? __childFn(tokens) : __childFn;

  // Combine any static sibling children with the function result.
  // In the typical case (no siblings) finalChildren is just fnChildren.
  let finalChildren: React.ReactNode;
  if (children != null && fnChildren != null) {
    finalChildren = [children, fnChildren] as React.ReactNode;
  } else {
    finalChildren = children ?? fnChildren;
  }

  return React.createElement(
    Component,
    // Forward id so the native view / HTML element receives it too
    { ...props, ...(id !== undefined ? { id } : {}), onLayout: handleLayout },
    finalChildren
  );
}

// Export under the double-underscore name the Babel plugin injects.
export { LayoutViewWrapper as __LayoutView };
