import { getTokenStore } from './store';
import type { ScreenInfo } from './types';

/** Matches strings like "50vw", "100vh", "33.5vw", "0.625rem", etc. */
const CSS_UNIT_RE = /^(-?\d+\.?\d*)(vh|vw|rem)$/;

/**
 * Converts a viewport-width value (0–100) to pixels based on the current screen width.
 *
 * @example
 * ```tsx
 * import { vw } from 'react-native-stylefn';
 * <View style={{ width: vw(50) }} />
 * ```
 */
export function vw(value: number): number {
  return (value / 100) * getTokenStore().screen.width;
}

/**
 * Converts a viewport-height value (0–100) to pixels based on the current screen height.
 *
 * @example
 * ```tsx
 * import { vh } from 'react-native-stylefn';
 * <View style={{ height: vh(100) }} />
 * ```
 */
export function vh(value: number): number {
  return (value / 100) * getTokenStore().screen.height;
}

/**
 * Converts a rem value to pixels using the configured inlineRem base.
 * Default base is 16 (so 1rem = 16px) unless overridden via
 * withStyleFn({ inlineRem }) in metro.config.js.
 *
 * @example
 * ```tsx
 * import { rem } from 'react-native-stylefn';
 * <View style={{ padding: rem(0.625) }} />  // → 10 (when inlineRem = 16)
 * ```
 */
export function rem(value: number): number {
  return value * getTokenStore().inlineRem;
}

/**
 * Parses a single string value that may contain a viewport unit.
 * Returns the converted pixel number, or the original value if it doesn't match.
 *
 * @example
 * parseViewportValue('50vw')  // → 187.5  (on a 375px-wide screen)
 * parseViewportValue('100vh') // → 812    (on an 812px-tall screen)
 * parseViewportValue(16)      // → 16     (unchanged)
 * parseViewportValue('red')   // → 'red'  (unchanged)
 */
export function parseViewportValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const match = CSS_UNIT_RE.exec(value);
  if (!match) return value;

  const num = parseFloat(match[1]!);
  const unit = match[2];
  const store = getTokenStore();

  if (unit === 'vw') return (num / 100) * store.screen.width;
  if (unit === 'vh') return (num / 100) * store.screen.height;
  if (unit === 'rem') return num * store.inlineRem;

  return value;
}

/**
 * Walks a style object (or nested style) and converts any string values
 * containing viewport units (e.g. '50vw', '100vh') to pixel numbers.
 *
 * This is called automatically by __resolveStyle so users can write:
 * ```tsx
 * <View style={{ width: '50vw', height: '100vh' }} />
 * <View style={(t) => ({ width: '50vw', minHeight: '80vh' })} />
 * ```
 */
export function resolveViewportUnits<T>(style: T): T {
  if (!style || typeof style !== 'object') return style;

  // Don't mutate the original — create a shallow copy
  const resolved = { ...style } as Record<string, unknown>;
  let changed = false;

  for (const key in resolved) {
    if (!Object.prototype.hasOwnProperty.call(resolved, key)) continue;

    const val = resolved[key];

    if (typeof val === 'string') {
      const parsed = parseViewportValue(val);
      if (parsed !== val) {
        resolved[key] = parsed;
        changed = true;
      }
    }
  }

  return (changed ? resolved : style) as T;
}

// =============================================================================
// calc() — CSS-like calc expressions with vh, vw, px units
// =============================================================================

/**
 * Converts a value with a unit to pixels given screen dimensions.
 *
 * @param num - The numeric value
 * @param unit - The CSS unit (px, vh, vw, rem)
 * @param screen - Current screen dimensions
 * @param inlineRem - Base pixel value for rem→px conversion (default 16)
 */
function unitToPixels(num: number, unit: string | undefined, screen: ScreenInfo, inlineRem: number = 16): number {
  switch (unit) {
    case 'vh':
      return (num / 100) * screen.height;
    case 'vw':
      return (num / 100) * screen.width;
    case 'rem':
      return num * inlineRem;
    case 'px':
    default:
      return num;
  }
}

/**
 * Tokenizes a calc expression string into numbers (with units resolved to px)
 * and operator characters.
 */
type Token = { type: 'number'; value: number } | { type: 'op'; value: string };

function tokenize(expr: string, screen: ScreenInfo, inlineRem: number = 16): Token[] {
  const tokens: Token[] = [];
  // Trim whitespace
  let input = expr.trim();
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;

    // Skip whitespace
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Operators: +, -, *, /
    // '-' is tricky: it could be a negative sign or subtraction
    if (ch === '+' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '-') {
      // It's a negative sign if:
      // - it's at the start
      // - the previous token is an operator (not ')')
      const prev = tokens[tokens.length - 1];
      const isNegative = !prev || (prev.type === 'op' && prev.value !== ')');

      if (!isNegative) {
        tokens.push({ type: 'op', value: '-' });
        i++;
        continue;
      }
      // Fall through to parse as a number with negative sign
    }

    // Try to parse a number (with optional unit)
    const numMatch = input.slice(i).match(/^(-?\d+\.?\d*)\s*(px|vh|vw|rem)?/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]!);
      const unit = numMatch[2];
      tokens.push({ type: 'number', value: unitToPixels(num, unit, screen, inlineRem) });
      i += numMatch[0]!.length;
      continue;
    }

    // Skip unknown characters
    i++;
  }

  return tokens;
}

/**
 * Simple recursive descent expression evaluator.
 *
 * Grammar:
 *   expression = term (('+' | '-') term)*
 *   term       = factor (('*' | '/') factor)*
 *   factor     = NUMBER | '(' expression ')' | '-' factor
 */
class ExprParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): number {
    const result = this.expression();
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++]!;
  }

  private expression(): number {
    let left = this.term();

    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value;
      const right = this.term();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  private term(): number {
    let left = this.factor();

    while (this.peek()?.type === 'op' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.consume().value;
      const right = this.factor();
      left = op === '*' ? left * right : left / right;
    }

    return left;
  }

  private factor(): number {
    const tok = this.peek();

    if (!tok) return 0;

    // Unary minus
    if (tok.type === 'op' && tok.value === '-') {
      this.consume();
      return -this.factor();
    }

    // Parenthesized expression
    if (tok.type === 'op' && tok.value === '(') {
      this.consume(); // consume '('
      const result = this.expression();
      if (this.peek()?.type === 'op' && this.peek()!.value === ')') {
        this.consume(); // consume ')'
      }
      return result;
    }

    // Number
    if (tok.type === 'number') {
      this.consume();
      return tok.value;
    }

    return 0;
  }
}

/**
 * Evaluates a CSS-like `calc()` expression with `px`, `vh`, and `vw` units.
 *
 * Supports `+`, `-`, `*`, `/` operators and parentheses.
 * Plain numbers (without a unit) are treated as pixels.
 *
 * Can be used standalone or via `t.calc(...)` inside a style function.
 *
 * @example
 * ```tsx
 * import { calc } from 'react-native-stylefn';
 *
 * // Standalone
 * <View style={{ width: calc('100vw - 32px') }} />
 *
 * // Inside a style function
 * <View style={(t) => ({
 *   width: t.calc('100vw - 32px'),
 *   height: t.calc('50vh + 20px'),
 *   padding: t.calc('(100vw - 320px) / 2'),
 * })} />
 * ```
 */
export function calc(expression: string): number {
  const store = getTokenStore();
  return evaluateCalc(expression, store.screen, store.inlineRem);
}

/**
 * Internal calc evaluator that accepts screen info directly.
 * Used by the token-bound version to capture the correct screen dimensions.
 *
 * @param expression - The calc expression string
 * @param screen - Current screen dimensions
 * @param inlineRem - Base pixel value for rem→px conversion (default 16)
 */
export function evaluateCalc(expression: string, screen: ScreenInfo, inlineRem: number = 16): number {
  const tokens = tokenize(expression, screen, inlineRem);
  const parser = new ExprParser(tokens);
  return parser.parse();
}
