import type { BreakpointQuery, BreakpointName } from '../types';

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
function deriveCurrentBreakpoint(
  screenWidth: number,
  thresholds: Record<string, number>
): BreakpointName {
  // Sort breakpoints by threshold descending
  const sorted = Object.entries(thresholds).sort(
    ([, a], [, b]) => b - a
  );

  for (const [name, minWidth] of sorted) {
    if (screenWidth >= minWidth) {
      return name;
    }
  }

  // Fallback to smallest breakpoint
  const smallest = sorted[sorted.length - 1];
  return smallest ? smallest[0] : 'sm';
}

/**
 * Creates a BreakpointQuery object with up/down methods.
 *
 * @example
 * ```tsx
 * const bp = createBreakpointQuery(400, { sm: 0, md: 375, lg: 430, xl: 768 });
 * bp.current     // 'md'
 * bp.up('md')    // true  (400 >= 375)
 * bp.up('lg')    // false (400 < 430)
 * bp.down('lg')  // true  (400 < 430)
 * bp.down('md')  // false (400 >= 375)
 * ```
 */
export function createBreakpointQuery(
  screenWidth: number,
  screens?: Record<string, number>
): BreakpointQuery {
  const thresholds = screens ?? DEFAULT_SCREENS;
  const current = deriveCurrentBreakpoint(screenWidth, thresholds);

  return {
    current,
    up: (name: BreakpointName): boolean => {
      const threshold = thresholds[name];
      if (threshold === undefined) {
        console.warn(`[stylefn] Unknown breakpoint "${name}". Available: ${Object.keys(thresholds).join(', ')}`);
        return false;
      }
      return screenWidth >= threshold;
    },
    down: (name: BreakpointName): boolean => {
      const threshold = thresholds[name];
      if (threshold === undefined) {
        console.warn(`[stylefn] Unknown breakpoint "${name}". Available: ${Object.keys(thresholds).join(', ')}`);
        return false;
      }
      return screenWidth < threshold;
    },
  };
}
