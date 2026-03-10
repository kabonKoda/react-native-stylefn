import { StyleSheet } from 'react-native';
import { create } from './create';

let _patched = false;

/**
 * Patches StyleSheet.create to support style functions.
 *
 * Style resolution for JSX props is handled at compile time
 * by the Babel plugin (wrapping with __resolveStyle).
 */
export function applyPatch(): void {
  if (_patched) {
    return;
  }
  _patched = true;

  // Replace StyleSheet.create with our typed create() helper.
  // This makes StyleSheet.create({ card: (t) => ({...}) }) work transparently.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (StyleSheet as any).create = create;
}

/**
 * Returns true if the patch has been applied.
 */
export function isPatched(): boolean {
  return _patched;
}

// Apply the patch immediately as a module-level side effect.
applyPatch();

/**
 * Reset patch state (for testing only).
 */
export function _resetPatch(): void {
  _patched = false;
}
