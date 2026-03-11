/**
 * Custom JSX dev-runtime types for react-native-stylefn.
 * Mirrors jsx-runtime/index.d.ts — see that file for full documentation.
 */

import * as React from 'react';
export { Fragment } from 'react';

type _StyleFnTokens = import('react-native-stylefn').StyleTokens;

type _WithTokenFunctions<P> = {
  [K in keyof P]: K extends
    | 'key'
    | 'ref'
    | 'children'
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
      ? P[K]
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
