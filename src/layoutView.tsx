import React, { useState } from 'react';
import { useSyncExternalStore } from 'react';
import {
  getTokenStore,
  subscribeCustomTokenStore,
  getCustomTokenSnapshot,
} from './store';
import type { ChildrenTokens, LayoutInfo } from './types';

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
  children,
  ...props
}: {
  /** The original JSX element type (e.g. View, ScrollView, Animated.View) */
  __type: React.ElementType;
  /** The children function that receives ChildrenTokens (including layout) */
  __childFn?: ((tokens: ChildrenTokens) => React.ReactNode) | React.ReactNode;
  /** User's own onLayout handler (preserved and called after layout update) */
  onLayout?: (event: any) => void;
  /** Any remaining static children (non-function siblings of the child fn) */
  children?: React.ReactNode;
  [key: string]: any;
}): React.JSX.Element {
  // Subscribe only to custom token changes so this re-renders when
  // useTokenInjection updates t.custom.*, without cascading on every
  // StyleProvider update (dark mode, orientation, etc.).
  useSyncExternalStore(
    subscribeCustomTokenStore,
    getCustomTokenSnapshot,
    getCustomTokenSnapshot
  );

  const [layout, setLayout] = useState<LayoutInfo>({ width: 0, height: 0 });

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => {
      // Bail out if dimensions haven't changed — prevents unnecessary re-renders
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
    // Preserve the user's own onLayout handler
    userOnLayout?.(event);
  };

  // Merge current layout into the global token store for this render
  const tokens: ChildrenTokens = { ...getTokenStore(), layout };

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
    { ...props, onLayout: handleLayout },
    finalChildren
  );
}

// Export under the double-underscore name the Babel plugin injects.
export { LayoutViewWrapper as __LayoutView };
