/**
 * Verifies that Reanimated animated style handles
 * (objects with `viewDescriptors`) pass through __resolveStyle
 * untouched — preserving identity so Animated.View detects them.
 */
import { __resolveStyle } from '../resolve';
import { resolveViewportUnits } from '../units';

/**
 * Fake handle that mimics what `useAnimatedStyle` returns: a plain object
 * tagged with `viewDescriptors`. We also install a throwing getter on a
 * nested key so the test fails loudly if anything iterates / spreads the
 * handle (which is exactly what Reanimated's mutables.js does in real life).
 */
function makeFakeAnimatedHandle() {
  const handle: any = {};
  Object.defineProperty(handle, 'viewDescriptors', {
    enumerable: true,
    get: () => ({ add: () => {}, remove: () => {}, has: () => false }),
  });
  Object.defineProperty(handle, 'initial', {
    enumerable: true,
    get: () => ({ value: { width: 0 }, updater: () => ({ width: 0 }) }),
  });
  Object.defineProperty(handle, '_value', {
    enumerable: false,
    configurable: false,
    get: () => {
      throw new Error(
        '[Reanimated] Reading from `_value` directly is only possible on the UI runtime. Perhaps you passed an Animated Style to a non-animated component?'
      );
    },
  });
  return handle;
}

describe('Reanimated animated style passthrough', () => {
  it('preserves the original handle identity in __resolveStyle (no array)', () => {
    const handle = makeFakeAnimatedHandle();
    const result = __resolveStyle(handle);
    expect(result).toBe(handle);
  });

  it('preserves handle identity inside an array', () => {
    const handle = makeFakeAnimatedHandle();
    const result = __resolveStyle([{ flex: 1 }, handle]) as unknown[];
    expect(Array.isArray(result)).toBe(true);
    expect(result[1]).toBe(handle);
  });

  it('resolveViewportUnits returns the same handle without spreading it', () => {
    const handle = makeFakeAnimatedHandle();
    const result = resolveViewportUnits(handle);
    expect(result).toBe(handle);
  });

  it('preserves handle identity in arrays that also contain viewport units', () => {
    const handle = makeFakeAnimatedHandle();
    const result = __resolveStyle([{ width: '50vw' }, handle]) as unknown[];
    expect(Array.isArray(result)).toBe(true);
    // First entry was rewritten (viewport units → number)
    expect((result[0] as any).width).not.toBe('50vw');
    // Animated handle identity preserved
    expect(result[1]).toBe(handle);
  });
});
