import { useSyncExternalStore, useCallback } from 'react';
import type { LayoutInfo } from '../types';
import {
  getComponentState,
  subscribeComponentState,
} from '../componentRegistry';

/**
 * Observe the measured layout dimensions (`width` and `height`) of any
 * component that was given a matching `id` prop and is wrapped by the Babel
 * plugin's `__LayoutView` (i.e. it has function children).
 *
 * The hook re-renders whenever the named component's layout changes.
 *
 * ### Setup
 * Give the component a string `id` prop so it registers itself:
 *
 * ```tsx
 * <View id="card">
 *   {({ layout }) => (
 *     <View style={{ width: layout.width / 2 }} />
 *   )}
 * </View>
 * ```
 *
 * ### Observe from anywhere
 *
 * ```tsx
 * function SiblingComponent() {
 *   const { width, height } = useLayoutFn('card');
 *
 *   return <Text>Card is {width} × {height}</Text>;
 * }
 * ```
 *
 * ### Driving Reanimated animations
 *
 * ```tsx
 * const { width } = useLayoutFn('hero');
 *
 * const animStyle = useAnimatedStyle(() => ({
 *   transform: [{ translateX: withSpring(width / 2) }],
 * }));
 * ```
 *
 * Returns `{ width: 0, height: 0 }` until the component has been measured
 * for the first time.
 *
 * @param id - The same string `id` passed to the observed component.
 */
export function useLayoutFn(id: string): LayoutInfo {
  const subscribe = useCallback(
    (listener: () => void) => subscribeComponentState(id, listener),
    [id]
  );

  const getSnapshot = useCallback(() => getComponentState(id).layout, [id]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
