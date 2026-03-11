import type { OrientationTokens } from '../types';

/**
 * Derives orientation boolean flags from screen dimensions.
 */
export function deriveOrientation(
  width: number,
  height: number
): OrientationTokens {
  const landscape = width >= height;
  return {
    landscape,
    portrait: !landscape,
  };
}
