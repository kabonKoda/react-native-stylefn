/**
 * Type augmentation for React Native style functions.
 *
 * This is the SOURCE stub. At build time, the generated stylefn.d.ts
 * (produced by withStyleFn in metro.config.js) overwrites the compiled
 * version with project-specific theme key overrides.
 *
 * This stub provides:
 * 1. A generic StyleSheet.create augmentation that accepts style functions
 *    (works even before the generated file exists)
 * 2. Documentation for the type system
 *
 * ## How it works
 *
 * The generated stylefn.d.ts (at the package root) augments
 * ThemeKeyOverrides with your actual theme keys from config + CSS.
 * Users reference it via:
 *   /// <reference types="react-native-stylefn/stylefn" />
 *
 * This uses TypeScript module resolution (not file paths) so it
 * correctly finds the generated file in node_modules.
 */

export {};

// =============================================================================
// Generic StyleSheet.create augmentation
//
// This ensures StyleSheet.create accepts style functions even when
// the generated stylefn.d.ts hasn't been created yet (e.g. first install).
// The generated file will provide a more specific augmentation with
// actual theme keys for better autocomplete.
// =============================================================================

declare module 'react-native' {
  // Strategy 1: Classic StyleSheetStatic (RN < 0.76)
  interface StyleSheetStatic {
    create<
      T extends {
        [key: string]:
          | import('react-native').ViewStyle
          | import('react-native').TextStyle
          | import('react-native').ImageStyle
          | ((
              tokens: import('react-native-stylefn').StyleTokens
            ) =>
              | import('react-native-stylefn').LooseStyle<
                  | import('react-native').ViewStyle
                  | import('react-native').TextStyle
                  | import('react-native').ImageStyle
                >
              | false
              | null
              | undefined);
      }
    >(
      styles: T
    ): T;
  }

  // Strategy 2: Namespace augmentation (RN 0.76+ where StyleSheet is a namespace)
  namespace StyleSheet {
    function create<
      T extends {
        [key: string]:
          | import('react-native').ViewStyle
          | import('react-native').TextStyle
          | import('react-native').ImageStyle
          | ((
              tokens: import('react-native-stylefn').StyleTokens
            ) =>
              | import('react-native-stylefn').LooseStyle<
                  | import('react-native').ViewStyle
                  | import('react-native').TextStyle
                  | import('react-native').ImageStyle
                >
              | false
              | null
              | undefined);
      }
    >(styles: T): T;
  }
}
