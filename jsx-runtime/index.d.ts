/**
 * Custom JSX runtime types for react-native-stylefn.
 *
 * When `jsxImportSource` is set to `"react-native-stylefn"` in tsconfig.json,
 * TypeScript uses these type definitions for JSX type checking. This allows
 * ALL component props to accept token functions `(tokens) => value` in JSX
 * without requiring `PropFunction<T>` annotations on the component side.
 *
 * At runtime, the Babel plugin wraps these functions with `__resolveProp()`,
 * so they are resolved to plain values before reaching the component.
 *
 * @example
 * ```tsx
 * // Component declares plain types — no PropFunction needed:
 * function Box({ width, color }: { width: number; color: string }) { ... }
 *
 * // Consumers can pass token functions in JSX — TypeScript is happy:
 * <Box
 *   width={({ orientation }) => orientation.landscape ? 200 : 120}
 *   color={({ dark }) => dark ? '#fff' : '#000'}
 * />
 * ```
 */

import * as React from 'react';
export { Fragment } from 'react';

// Use import() type so this works regardless of module resolution quirks.
type _StyleFnTokens = import('react-native-stylefn').StyleTokens;

// ---------------------------------------------------------------------------
// Utility: widen each prop to also accept a token function, UNLESS it's a
// callback, ref, key, children, or style prop (those are already handled or
// should not be wrapped).
// ---------------------------------------------------------------------------

type _WithTokenFunctions<P> = {
  [K in keyof P]: K extends // React internals — never wrap
  | 'key'
    | 'ref'
    | 'children'
    // Accessibility / test identifiers
    | 'testID'
    | 'nativeID'
    | 'accessibilityLabel'
    // FlatList / SectionList render props & callbacks
    | 'keyExtractor'
    | 'getItem'
    | 'getItemCount'
    | 'getItemLayout'
    | 'ListHeaderComponent'
    | 'ListFooterComponent'
    | 'ListEmptyComponent'
    | 'ItemSeparatorComponent'
    | 'SectionSeparatorComponent'
    | 'CellRendererComponent'
    // Navigation
    | 'component'
    | 'getComponent'
    ? P[K]
    : K extends string
    ? K extends `on${string}`
      ? P[K]
      : K extends `render${string}`
      ? P[K]
      : K extends `handle${string}`
      ? P[K]
      : K extends 'style' | `${string}Style` | `${string}style`
      ? P[K]
      : P[K] | ((_tokens: _StyleFnTokens) => NonNullable<P[K]>)
    : P[K];
};

// ---------------------------------------------------------------------------
// JSX namespace — mirrors React's jsx-runtime exactly but overrides
// LibraryManagedAttributes. Uses `interface extends` (not `type =`) to
// preserve structural compatibility with React's types.
// ---------------------------------------------------------------------------

export namespace JSX {
  type ElementType = React.JSX.ElementType;
  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  interface ElementAttributesProperty
    extends React.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute
    extends React.JSX.ElementChildrenAttribute {}
  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T>
    extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}

  /**
   * Override: wrap the resolved props with _WithTokenFunctions so that
   * every non-callback, non-style prop also accepts a token function.
   */
  type LibraryManagedAttributes<C, P> = _WithTokenFunctions<
    React.JSX.LibraryManagedAttributes<C, P>
  >;
}

/**
 * Create a React element.
 *
 * You should not use this function directly. Use JSX and a transpiler instead.
 */
export function jsx(
  type: React.ElementType,
  props: unknown,
  key?: React.Key
): React.ReactElement;

/**
 * Create a React element.
 *
 * You should not use this function directly. Use JSX and a transpiler instead.
 */
export function jsxs(
  type: React.ElementType,
  props: unknown,
  key?: React.Key
): React.ReactElement;
