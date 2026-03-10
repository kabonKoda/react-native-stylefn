import { StyleSheet } from 'react-native';
import type { ViewStyle, TextStyle, ImageStyle } from 'react-native';
import type { StyleTokens } from './types';

// Capture the original StyleSheet.create before patch.ts replaces it.
// This module is imported by patch.ts, so it initialises first.
const originalCreate = StyleSheet.create.bind(StyleSheet);

/**
 * A style function for StyleSheet.create.
 */
type StyleFn<S extends ViewStyle | TextStyle | ImageStyle = ViewStyle | TextStyle | ImageStyle> =
  (tokens: StyleTokens) => S | false | null | undefined;

/**
 * Input type for createStyles — each key can be a static style or a style function.
 */
type StyleInput = {
  [key: string]:
    | ViewStyle
    | TextStyle
    | ImageStyle
    | StyleFn<ViewStyle>
    | StyleFn<TextStyle>
    | StyleFn<ImageStyle>;
};

/**
 * Output type preserves the exact function/object type per key.
 */
type StyleOutput<T extends StyleInput> = {
  [K in keyof T]: T[K];
};

/**
 * A typed, StyleSheet.create-compatible helper that supports style functions.
 *
 * Use this instead of StyleSheet.create when you want to mix static styles
 * with dynamic style functions.
 *
 * @example
 * ```tsx
 * const styles = create({
 *   // Dynamic — resolved at render time
 *   container: (t) => ({
 *     flex: 1,
 *     backgroundColor: t.colors.background,
 *     padding: t.theme.spacing[4],
 *   }),
 *   // Static — processed normally by StyleSheet
 *   title: {
 *     fontSize: 24,
 *     fontWeight: '700',
 *   },
 * });
 *
 * <View style={styles.container} />
 * <Text style={styles.title} />
 * ```
 */
export function create<T extends StyleInput>(styles: T): StyleOutput<T> {
  const statics: Record<string, ViewStyle | TextStyle | ImageStyle> = {};
  const dynamics: Record<string, StyleFn> = {};
  let hasDynamics = false;
  let hasStatics = false;

  for (const key in styles) {
    if (Object.prototype.hasOwnProperty.call(styles, key)) {
      const val = styles[key];
      if (typeof val === 'function') {
        dynamics[key] = val as StyleFn;
        hasDynamics = true;
      } else {
        statics[key] = val as ViewStyle | TextStyle | ImageStyle;
        hasStatics = true;
      }
    }
  }

  if (!hasDynamics) {
    return originalCreate(statics as Parameters<typeof StyleSheet.create>[0]) as unknown as StyleOutput<T>;
  }

  if (!hasStatics) {
    return dynamics as unknown as StyleOutput<T>;
  }

  const created = originalCreate(statics as Parameters<typeof StyleSheet.create>[0]);
  return { ...created, ...dynamics } as unknown as StyleOutput<T>;
}
