import type { Orientation } from '../types';

/**
 * Derives orientation from screen dimensions.
 */
export function deriveOrientation(
  width: number,
  height: number
): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}
