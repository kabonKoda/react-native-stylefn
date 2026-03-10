/**
 * Type augmentation for React Native style functions.
 *
 * The primary mechanism is scripts/setup.js which patches StyleProp<T> and
 * StyleSheet.create directly in React Native's type definitions. This runs
 * automatically as a postinstall hook and makes style functions work on ALL
 * components with full TypeScript support — no manual configuration needed.
 *
 * This file re-exports utility types for consumers who want to annotate
 * their own style functions or style props.
 *
 * @example
 * ```tsx
 * import type { StyleFunction, StyleTokens } from 'react-native-stylefn';
 *
 * const myStyle: StyleFunction<ViewStyle> = (t) => ({
 *   flex: 1,
 *   backgroundColor: t.colors.background,
 * });
 * ```
 */

export {};
