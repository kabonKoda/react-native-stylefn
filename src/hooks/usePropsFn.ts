import { useSyncExternalStore } from 'react';
import type { StyleTokens } from '../types';
import { getTokenStore, subscribeTokenStore } from '../store';

/**
 * A prop value that can be a static value or a token function.
 */
export type TokenProp<T> = T | ((tokens: StyleTokens) => T);

/**
 * Input type: each key can be a static value or a token function.
 */
type PropsFnInput<T extends Record<string, unknown>> = {
  [K in keyof T]: TokenProp<T[K]>;
};

/**
 * Output type: all values are resolved (no functions).
 */
type PropsFnOutput<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K];
};

/**
 * Resolve an object of props where any value can be a token function.
 *
 * Re-renders the component when any token value changes (orientation,
 * breakpoint, dark mode, screen size, etc.).
 *
 * @example
 * ```tsx
 * function StrokePreview({ brushState, isEraser }: Props) {
 *   const { width, height, columns } = usePropsFn({
 *     width: ({ orientation }) => orientation.landscape ? 266 : 200,
 *     height: 180,
 *     columns: ({ breakpoint }) => breakpoint.up('lg') ? 3 : 2,
 *   });
 *
 *   return <Canvas width={width} height={height} columns={columns} />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Works great for passing resolved props to third-party components:
 * const { sliderWidth, thumbSize } = usePropsFn({
 *   sliderWidth: ({ screen }) => screen.width - 32,
 *   thumbSize: ({ breakpoint }) => breakpoint.up('md') ? 24 : 16,
 * });
 *
 * <Slider width={sliderWidth} thumbSize={thumbSize} />
 * ```
 */
export function usePropsFn<T extends Record<string, unknown>>(
  props: PropsFnInput<T>
): PropsFnOutput<T> {
  const tokens = useSyncExternalStore(
    subscribeTokenStore,
    getTokenStore,
    getTokenStore
  );

  const resolved = {} as PropsFnOutput<T>;

  for (const key in props) {
    if (Object.prototype.hasOwnProperty.call(props, key)) {
      const val = props[key];
      (resolved as Record<string, unknown>)[key] =
        typeof val === 'function'
          ? (val as (t: StyleTokens) => unknown)(tokens)
          : val;
    }
  }

  return resolved;
}
