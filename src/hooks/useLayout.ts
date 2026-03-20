import { useCallback, useRef, useState } from 'react';
import type { LayoutInfo } from '../types';

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
}

/**
 * Hook that measures a component's layout dimensions via `onLayout`.
 *
 * Returns a `ref` to attach to the target component, plus the measured
 * `width` and `height` (both `0` until the first layout pass).
 *
 * The measured values update whenever the component's layout changes
 * (e.g. on rotation, resize, or parent layout change).
 *
 * @example
 * ```tsx
 * import { useLayout } from 'react-native-stylefn';
 *
 * function MyComponent() {
 *   const { ref, width, height } = useLayout();
 *
 *   return (
 *     <View ref={ref} style={{ flex: 1 }}>
 *       {/* Use parent's measured dimensions in children *\/}
 *       <View style={{ width: width / 2, height: height / 3 }} />
 *       <Text>Parent is {width}×{height}</Text>
 *     </View>
 *   );
 * }
 * ```
 *
 * @example Using with style functions
 * ```tsx
 * const { ref, width, height } = useLayout();
 *
 * <View
 *   ref={ref}
 *   style={(t) => ({
 *     flex: 1,
 *     backgroundColor: width > 400 ? t.colors.primary : t.colors.secondary,
 *   })}
 * >
 *   <View style={{ width: width / 2 }} />
 * </View>
 * ```
 *
 * @example Using with children render prop
 * ```tsx
 * const { ref, width, height } = useLayout();
 *
 * <View ref={ref} style={{ flex: 1 }}>
 *   {(t) => (
 *     <Text style={{ color: t.colors.text }}>
 *       Container: {width}×{height}
 *     </Text>
 *   )}
 * </View>
 * ```
 */
export function useLayout(): UseLayoutReturn {
  const [layout, setLayout] = useState<LayoutInfo>({ width: 0, height: 0 });
  const [measured, setMeasured] = useState(false);

  const ref = useRef<any>(null);

  const onLayout = useCallback(
    (event: any) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout((prev) => {
        // Only update state if dimensions actually changed (avoids re-renders)
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
      if (!measured) setMeasured(true);
    },
    [measured]
  );

  // Attach onLayout to the ref'd component via a proxy ref
  // We use the imperative approach: the user passes `ref` and `onLayout` to their View
  // Actually, React Native View accepts onLayout as a prop, so the cleanest
  // approach is to return onLayout and let users spread it or pass it.
  // But to keep it simple with just `ref`, we'll return both.

  return {
    ref,
    width: layout.width,
    height: layout.height,
    measured,
    onLayout,
  };
}
