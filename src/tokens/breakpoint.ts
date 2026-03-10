import type { Breakpoint } from '../types';

/**
 * Default screen breakpoints (can be overridden via config).
 */
const DEFAULT_SCREENS: Record<string, number> = {
  sm: 0,
  md: 375,
  lg: 430,
  xl: 768,
};

/**
 * Derives the current breakpoint name from screen width and screen config.
 *
 * Breakpoints are evaluated from largest to smallest.
 * The first breakpoint whose threshold is <= the current width wins.
 */
export function deriveBreakpoint(
  screenWidth: number,
  screens?: Record<string, number>
): Breakpoint {
  const thresholds = screens ?? DEFAULT_SCREENS;

  // Sort breakpoints by threshold descending
  const sorted = Object.entries(thresholds).sort(
    ([, a], [, b]) => b - a
  );

  for (const [name, minWidth] of sorted) {
    if (screenWidth >= minWidth) {
      return name as Breakpoint;
    }
  }

  // Fallback to smallest breakpoint
  return 'sm';
}
