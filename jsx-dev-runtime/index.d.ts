/**
 * Custom JSX dev-runtime types for react-native-stylefn.
 * Mirrors jsx-runtime/index.d.ts — see that file for full documentation.
 */

import * as React from 'react';
export { Fragment } from 'react';

// Import from the package entry point so `declare module 'react-native-stylefn'`
// augmentations (e.g. CustomTokens) are included in the token type used here.
type _StyleFnTokens = import('react-native-stylefn').StyleTokens;

// Token type for children functions — includes layout dimensions of the parent
// component in addition to all StyleTokens fields.
type _ChildrenTokens = import('react-native-stylefn').ChildrenTokens;

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
  | `${number}rem`
  | `${number}em`
  | 'full'
  | 'screen'
  | 'auto'
  | 'fit-content';

// All property keys from all three style types (intersection gives us the
// complete set of keys across ViewStyle, TextStyle, and ImageStyle).
type _AllStyleKeys = keyof (import('react-native').ViewStyle &
  import('react-native').TextStyle &
  import('react-native').ImageStyle);

// Helper: extract a property's type from a style interface, or `never` if
// the key doesn't exist in that interface.
type _StylePropOf<S, K> = K extends keyof S ? S[K] : never;

// Loosened style type: for each property key we take the **union** of that
// property's type across ViewStyle, TextStyle, and ImageStyle — NOT the
// intersection. A plain intersection (`ViewStyle & TextStyle & ImageStyle`)
// can narrow colour properties (e.g. `ColorValue` → `string`) when the same
// key appears in multiple interfaces with subtly different types; the union
// approach preserves every constituent (including `OpaqueColorValue` /
// `NativeColorValue`).
//
// In addition, every property also accepts custom dimension strings
// (`_StyleFnDimension`) and `boolean` token values (e.g. `t.boldText`,
// `t.dark`, `t.platform.ios`).
type _LooseAllStyles = {
  [K in _AllStyleKeys]?:
    | _StylePropOf<import('react-native').ViewStyle, K>
    | _StylePropOf<import('react-native').TextStyle, K>
    | _StylePropOf<import('react-native').ImageStyle, K>
    | _StyleFnDimension
    | boolean;
};

// A style function with a properly typed return — provides autocomplete for
// ALL React Native style properties with loosened value types (dimension
// strings, boolean token values, etc.).
type _StyleFnForStyle = (
  _tokens: _StyleFnTokens
) => _LooseAllStyles | false | null | undefined;

// A children function that receives ChildrenTokens (StyleTokens + layout).
type _ChildrenFnForTokens = (_tokens: _ChildrenTokens) => React.ReactNode;

// Strip callable (function) types from a union. Used on style props so that
// any function member already present in StyleProp<T> (e.g. from the
// postinstall patch) is replaced by our single _StyleFnForStyle type.
// This ensures there is always exactly ONE function signature in the union,
// which lets TypeScript infer the `t` parameter type without ambiguity.
type _StripCallable<T> = T extends (...args: any[]) => any ? never : T;

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
      ?
          | _StripCallable<P[K]>
          | _LooseAllStyles
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
