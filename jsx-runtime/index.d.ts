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

// Use a relative import so this resolves correctly in both the monorepo (dev)
// and in published packages — no dependency on module path alias resolution.
type _StyleFnTokens = import('../src/types').StyleTokens;

// Combine all React Native style types into a single intersection for
// comprehensive autocomplete (padding from ViewStyle, fontSize from TextStyle, etc.)
type _AllRNStyles = import('react-native').ViewStyle &
  import('react-native').TextStyle &
  import('react-native').ImageStyle;

// Custom dimension strings that the Babel plugin resolves at runtime
// (fractions → %, viewport units → px, rem → px).
type _StyleFnDimension =
  | `${number}/${number}`
  | `${number}vw`
  | `${number}vh`
  | `${number}rem`;

// Loosened style type: all RN style properties are optional and also accept
// custom dimension strings. This gives full autocomplete for style properties
// while allowing stylefn-specific string values.
type _LooseAllStyles = {
  [K in keyof _AllRNStyles]?: _AllRNStyles[K] | _StyleFnDimension;
};

// A style function with a properly typed return — provides autocomplete for
// ALL React Native style properties when used as a fallback (i.e. when the
// postinstall patch of StyleProp<T> hasn't been applied).
type _StyleFnForStyle = (
  _tokens: _StyleFnTokens
) => _LooseAllStyles | false | null | undefined;

// A children function that receives tokens and returns ReactNode.
// Used to widen the `children` prop to accept the render-children pattern.
type _ChildrenFnForTokens = (_tokens: _StyleFnTokens) => React.ReactNode;

// True when T already contains a callable type — meaning the component's style
// prop is already typed as StyleProp<T> (patched) and includes a function type.
// When true, we leave the prop alone to avoid adding a competing function
// signature that would break TypeScript's contextual typing of `t`.
type _StylePropHasFn<T> = ((_tokens: _StyleFnTokens) => any) extends T
  ? true
  : false;

// ---------------------------------------------------------------------------
// Utility: widen each prop to also accept a token function, UNLESS it's a
// callback, ref, key, children, or style prop (those are already handled or
// should not be wrapped).
//
// Style props are widened ONLY when they don't already contain a function type
// (i.e. `style?: ViewStyle` instead of `StyleProp<ViewStyle>`). This avoids
// creating competing contextual function signatures that would break inference.
// ---------------------------------------------------------------------------

type _WithTokenFunctions<P> = {
  [K in keyof P]: K extends 'children'
    ? P[K] | _ChildrenFnForTokens
    : K extends  // React internals — never wrap
        | 'key'
        | 'ref'
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
      ? _StylePropHasFn<P[K]> extends true
        ? P[K]
        :
            | P[K]
            | _StyleFnForStyle
            | ReadonlyArray<_LooseAllStyles | _StyleFnForStyle | false | null | undefined>
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
