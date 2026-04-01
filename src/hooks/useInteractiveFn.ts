import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { InteractiveState } from '../componentRegistry';
import {
  getComponentState,
  subscribeComponentState,
} from '../componentRegistry';

/**
 * Observe the interaction state (`active` and `hovered`) of any component
 * that was given a matching `id` prop and is wrapped by the Babel plugin's
 * `__InteractiveView` (i.e. its style or prop functions reference `t.active`
 * or `t.hovered`).
 *
 * The hook re-renders only when the named component's `active` or `hovered`
 * flag changes — it does **not** re-render on global token changes (dark
 * mode, orientation, etc.).  Use `useStyleFn(id)` when you also need global
 * tokens.
 *
 * ### Setup
 * Give the component a string `id` so it registers itself:
 *
 * ```tsx
 * <View
 *   id="submitBtn"
 *   style={(t) => ({
 *     backgroundColor: t.active ? t.colors.accent : t.colors.surface,
 *     opacity: t.active ? 0.85 : 1,
 *     transform: [{ scale: t.active ? 0.97 : 1 }],
 *   })}
 * />
 * ```
 *
 * ### Observe from anywhere
 *
 * ```tsx
 * function ParentScreen() {
 *   const { active, hovered } = useInteractiveFn('submitBtn');
 *
 *   // Drive a Reanimated animation from another component's press state:
 *   useEffect(() => {
 *     labelScale.value = withSpring(active ? 0.9 : 1);
 *   }, [active]);
 *
 *   return (
 *     <>
 *       <Animated.Text style={[styles.label, animLabelStyle]}>
 *         Submit
 *       </Animated.Text>
 *       <View id="submitBtn" style={(t) => ({ ... })} />
 *     </>
 *   );
 * }
 * ```
 *
 * Returns `{ active: false, hovered: false }` until the component mounts.
 *
 * @param id - The same string `id` passed to the observed component.
 */
export function useInteractiveFn(id: string): InteractiveState {
  // Cache the last snapshot so `useSyncExternalStore` can compare by reference
  // (Object.is).  Without this every getSnapshot call would create a new object,
  // making React think the snapshot always changed → infinite re-render loop.
  const cacheRef = useRef<InteractiveState>({ active: false, hovered: false });

  const subscribe = useCallback(
    (listener: () => void) => subscribeComponentState(id, listener),
    [id]
  );

  const getSnapshot = useCallback(() => {
    const s = getComponentState(id);
    const c = cacheRef.current;
    // Return the same reference when nothing changed — Object.is stability
    if (c.active === s.active && c.hovered === s.hovered) return c;
    const next: InteractiveState = { active: s.active, hovered: s.hovered };
    cacheRef.current = next;
    return next;
  }, [id]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
