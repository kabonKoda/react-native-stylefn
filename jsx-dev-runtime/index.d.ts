/**
 * Custom JSX dev-runtime types for react-native-stylefn.
 * Mirrors jsx-runtime/index.d.ts — see that file for full documentation.
 */

import * as React from 'react';
export { Fragment } from 'react';

// Import from the package entry point so `declare module 'react-native-stylefn'`
// augmentations (e.g. CustomTokens) are included in the token type used here.
type _StyleFnTokens = import('react-native-stylefn').StyleTokens;

// Combine all React Native style types into a single intersection for
// comprehensive autocomplete (padding from ViewStyle, fontSize from TextStyle, etc.)
type _AllRNStyles = import('react-native').ViewStyle &
  import('react-native').TextStyle &
  import('react-native').ImageStyle;

// Registered style type (e.g. StyleSheet.absoluteFill, StyleSheet.create() results)
type _RegisteredStyle = import('react-native').RegisteredStyle<
  | import('react-native').ViewStyle
  | import('react-native').TextStyle
  | import('react-native').ImageStyle
>;

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

type _ChildrenFnForTokens = (_tokens: _StyleFnTokens) => React.ReactNode;
type _StylePropHasFn<T> = ((_tokens: _StyleFnTokens) => any) extends T
  ? true
  : false;

type _WithTokenFunctions<P> = {
  [K in keyof P]: K extends 'children'
    ? P[K] | _ChildrenFnForTokens
    : K extends
        | 'key'
        | 'ref'
        | 'testID'
        | 'nativeID'
        | 'accessibilityLabel'
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
            | ReadonlyArray<
                | _LooseAllStyles
                | _StyleFnForStyle
                | _RegisteredStyle
                | false
                | null
                | undefined
              >
      : P[K] | ((_tokens: _StyleFnTokens) => NonNullable<P[K]>)
    : P[K];
};

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
  type LibraryManagedAttributes<C, P> = _WithTokenFunctions<
    React.JSX.LibraryManagedAttributes<C, P>
  >;
}

export interface JSXSource {
  fileName?: string | undefined;
  lineNumber?: number | undefined;
  columnNumber?: number | undefined;
}

/**
 * Create a React element.
 *
 * You should not use this function directly. Use JSX and a transpiler instead.
 */
export function jsxDEV(
  type: React.ElementType,
  props: unknown,
  key: React.Key | undefined,
  isStatic: boolean,
  source?: JSXSource,
  self?: unknown
): React.ReactElement;
