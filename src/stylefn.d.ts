/**
 * Type augmentation for React Native style functions.
 *
 * ## Style Props (automatic via postinstall)
 *
 * The primary mechanism is scripts/setup.js which patches StyleProp<T> and
 * StyleSheet.create directly in React Native's type definitions. This runs
 * automatically as a postinstall hook and makes style functions work on ALL
 * components with full TypeScript support — no manual configuration needed.
 *
 * ## Non-Style Props (automatic via jsxImportSource)
 *
 * The library provides a custom JSX runtime (jsx-runtime/ and jsx-dev-runtime/)
 * that overrides TypeScript's LibraryManagedAttributes. When jsxImportSource
 * is set to "react-native-stylefn" in tsconfig.json, ALL component props
 * automatically accept token functions `(tokens: StyleTokens) => T` in
 * addition to their declared type `T`.
 *
 * This means components can declare plain types:
 *
 * @example
 * ```tsx
 * function Box({ width, color }: { width: number; color: string }) {
 *   return <View style={{ width, backgroundColor: color }} />;
 * }
 *
 * // Consumers can pass token functions — TypeScript is happy!
 * <Box
 *   width={({ orientation }) => orientation.landscape ? 200 : 120}
 *   color={({ dark }) => dark ? '#fff' : '#000'}
 * />
 * ```
 *
 * The Babel plugin automatically wraps these token functions with
 * __resolveProp() at compile time, so props arrive as resolved values
 * at runtime.
 *
 * Setup (added automatically by postinstall):
 * ```json
 * // tsconfig.json
 * {
 *   "compilerOptions": {
 *     "jsx": "react-jsx",
 *     "jsxImportSource": "react-native-stylefn"
 *   }
 * }
 * ```
 */

export {};
