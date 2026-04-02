/**
 * CSS Expression Resolver
 *
 * Resolves CSS variable references and expressions in theme config values.
 *
 * Supports:
 * - var(--name) / var(--name, fallback)
 * - hsl(h s% l%) / hsl(h, s%, l%) / hsl(h s% l% / alpha)
 * - rgb(r g b) / rgb(r, g, b) / rgb(r g b / alpha)
 * - calc(expression) with +, -, *, / and px units
 * - Nested: hsl(var(--primary)), calc(var(--radius) - 2px)
 */

// =============================================================================
// var() resolution
// =============================================================================

/**
 * Tracks CSS variables + color expressions already warned about so each
 * missing var only emits a single console.warn per session.
 */
const _warnedVars = new Set<string>();
const _warnedExpressions = new Set<string>();

/**
 * Resolve all var(--name) and var(--name, fallback) references in a string.
 * Iterates to support nested var() references (up to 10 levels).
 */
function resolveVarReferences(
  value: string,
  vars: Record<string, string>
): string {
  let result = value;
  let maxIterations = 10;

  while (maxIterations-- > 0 && result.includes('var(')) {
    const newResult = result.replace(
      /var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,\s*([^)]*))?\)/g,
      (_match, name: string, fallback?: string) => {
        const resolved = vars[name];
        if (resolved !== undefined) return resolved;
        if (fallback !== undefined) return fallback.trim();
        if (__DEV__ && !_warnedVars.has(name)) {
          _warnedVars.add(name);
          console.warn(
            `[react-native-stylefn] CSS variable --${name} is not defined and has no fallback. ` +
              'The value will be empty. Define it in your global.css or provide a fallback: var(--' +
              name +
              ', <fallback>)'
          );
        }
        return '';
      }
    );
    if (newResult === result) break;
    result = newResult;
  }

  return result;
}

// =============================================================================
// HSL / RGB → hex conversion
// =============================================================================

/**
 * Clamp a number between min and max.
 */
function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Convert a single channel (0–1) to a two-digit hex string.
 */
function toHex2(n: number): string {
  const hex = clamp(Math.round(n * 255), 0, 255)
    .toString(16)
    .padStart(2, '0');
  return hex;
}

/**
 * Convert HSL values to a hex color string.
 *
 * @param h Hue (0–360)
 * @param s Saturation (0–100)
 * @param l Lightness (0–100)
 * @param a Alpha (0–1), optional
 */
function hslToHex(h: number, s: number, l: number, a?: number): string {
  h = ((h % 360) + 360) % 360; // normalize
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const hex = `#${toHex2(r + m)}${toHex2(g + m)}${toHex2(b + m)}`;

  if (a !== undefined && a < 1) {
    return `${hex}${toHex2(a)}`;
  }

  return hex;
}

/**
 * Parse the inside of an hsl() function call.
 * Handles both comma-separated and space-separated syntaxes, with optional alpha.
 *
 * Examples:
 *   "220, 13%, 91%"
 *   "220 13% 91%"
 *   "220 13% 91% / 0.5"
 *   "220, 13%, 91%, 0.5"
 */
function parseHslArgs(args: string): string | null {
  const trimmed = args.trim();

  let h: number, s: number, l: number;
  let a: number | undefined;

  if (trimmed.includes(',')) {
    // Comma-separated: hsl(220, 13%, 91%) or hsl(220, 13%, 91%, 0.5)
    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 3) return null;
    h = parseFloat(parts[0]!);
    s = parseFloat(parts[1]!.replace('%', ''));
    l = parseFloat(parts[2]!.replace('%', ''));
    if (parts.length >= 4) {
      a = parseFloat(parts[3]!.replace('%', ''));
      if (a > 1) a = a / 100; // handle percentage alpha
    }
  } else {
    // Space-separated: hsl(220 13% 91%) or hsl(220 13% 91% / 0.5)
    const slashIdx = trimmed.indexOf('/');
    let hslPart: string;
    if (slashIdx !== -1) {
      hslPart = trimmed.slice(0, slashIdx).trim();
      const alphaPart = trimmed.slice(slashIdx + 1).trim();
      a = parseFloat(alphaPart.replace('%', ''));
      if (a > 1) a = a / 100;
    } else {
      hslPart = trimmed;
    }

    const parts = hslPart.split(/\s+/);
    if (parts.length < 3) return null;
    h = parseFloat(parts[0]!);
    s = parseFloat(parts[1]!.replace('%', ''));
    l = parseFloat(parts[2]!.replace('%', ''));
  }

  if (isNaN(h) || isNaN(s) || isNaN(l)) return null;

  return hslToHex(h, s, l, a);
}

/**
 * Resolve all hsl() and hsla() function calls in a string to hex colors.
 */
function resolveHslFunctions(value: string): string {
  return value.replace(/hsla?\(([^)]+)\)/gi, (_match, args: string) => {
    const hex = parseHslArgs(args);
    return hex ?? _match; // return original if can't parse
  });
}

/**
 * Parse the inside of an rgb() function call.
 *
 * Examples:
 *   "0, 0, 0"
 *   "0 0 0"
 *   "0 0 0 / 0.05"
 *   "0, 0, 0, 0.05"
 */
function parseRgbArgs(args: string): string | null {
  const trimmed = args.trim();

  let r: number, g: number, b: number;
  let a: number | undefined;

  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 3) return null;
    r = parseFloat(parts[0]!);
    g = parseFloat(parts[1]!);
    b = parseFloat(parts[2]!);
    if (parts.length >= 4) a = parseFloat(parts[3]!);
  } else {
    const slashIdx = trimmed.indexOf('/');
    let rgbPart: string;
    if (slashIdx !== -1) {
      rgbPart = trimmed.slice(0, slashIdx).trim();
      a = parseFloat(trimmed.slice(slashIdx + 1).trim());
    } else {
      rgbPart = trimmed;
    }
    const parts = rgbPart.split(/\s+/);
    if (parts.length < 3) return null;
    r = parseFloat(parts[0]!);
    g = parseFloat(parts[1]!);
    b = parseFloat(parts[2]!);
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  // Normalize as 0-255 range
  const hex = `#${toHex2(r / 255)}${toHex2(g / 255)}${toHex2(b / 255)}`;

  if (a !== undefined && a < 1) {
    return `${hex}${toHex2(a)}`;
  }

  return hex;
}

/**
 * Resolve all rgb() and rgba() function calls in a string to hex colors.
 */
function resolveRgbFunctions(value: string): string {
  return value.replace(/rgba?\(([^)]+)\)/gi, (_match, args: string) => {
    const hex = parseRgbArgs(args);
    return hex ?? _match;
  });
}

// =============================================================================
// calc() evaluation
// =============================================================================

/**
 * Simple arithmetic evaluator for calc() expressions.
 * Supports +, -, *, / operators, parentheses, px and rem units.
 * Plain numbers are treated as unitless.
 *
 * @param expression - The calc expression string
 * @param inlineRem - Base pixel value for rem→px conversion (default 16)
 */
function evaluateSimpleCalc(
  expression: string,
  inlineRem: number = 16
): number {
  // Strip outer calc() if present
  let expr = expression.trim();
  const calcMatch = expr.match(/^calc\((.+)\)$/i);
  if (calcMatch) expr = calcMatch[1]!.trim();

  // Convert rem units to px before tokenizing: e.g. "0.625rem" → "10" (when inlineRem=16)
  expr = expr.replace(/(\d+\.?\d*)rem/g, (_, num) =>
    String(parseFloat(num) * inlineRem)
  );

  // Remove 'px' units
  expr = expr.replace(/(\d+\.?\d*)px/g, '$1');

  // Tokenize
  const tokens = tokenizeCalc(expr);

  // Parse
  const parser = new CalcParser(tokens);
  return parser.parse();
}

type CalcToken =
  | { type: 'number'; value: number }
  | { type: 'op'; value: string };

function tokenizeCalc(expr: string): CalcToken[] {
  const tokens: CalcToken[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i]!;

    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '+' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '-') {
      const prev = tokens[tokens.length - 1];
      const isNegative = !prev || (prev.type === 'op' && prev.value !== ')');
      if (!isNegative) {
        tokens.push({ type: 'op', value: '-' });
        i++;
        continue;
      }
    }

    // Try to parse a number
    const numMatch = expr.slice(i).match(/^(-?\d+\.?\d*)/);
    if (numMatch) {
      tokens.push({ type: 'number', value: parseFloat(numMatch[1]!) });
      i += numMatch[0]!.length;
      continue;
    }

    i++;
  }

  return tokens;
}

class CalcParser {
  private tokens: CalcToken[];
  private pos = 0;

  constructor(tokens: CalcToken[]) {
    this.tokens = tokens;
  }

  parse(): number {
    return this.expression();
  }

  private peek(): CalcToken | undefined {
    return this.tokens[this.pos];
  }

  private consume(): CalcToken {
    return this.tokens[this.pos++]!;
  }

  private expression(): number {
    let left = this.term();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '+' || this.peek()!.value === '-')
    ) {
      const op = this.consume().value;
      const right = this.term();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private term(): number {
    let left = this.factor();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '*' || this.peek()!.value === '/')
    ) {
      const op = this.consume().value;
      const right = this.factor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  private factor(): number {
    const tok = this.peek();
    if (!tok) return 0;

    if (tok.type === 'op' && tok.value === '-') {
      this.consume();
      return -this.factor();
    }

    if (tok.type === 'op' && tok.value === '(') {
      this.consume();
      const result = this.expression();
      if (this.peek()?.type === 'op' && this.peek()!.value === ')') {
        this.consume();
      }
      return result;
    }

    if (tok.type === 'number') {
      this.consume();
      return tok.value;
    }

    return 0;
  }
}

// =============================================================================
// Public API — Context-aware resolvers
// =============================================================================

/**
 * Check if a string contains any CSS expression (var, hsl, calc, etc.)
 */
export function containsCssExpression(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return (
    value.includes('var(') ||
    value.includes('hsl(') ||
    value.includes('hsla(') ||
    value.includes('rgb(') ||
    value.includes('rgba(') ||
    value.includes('calc(')
  );
}

/**
 * Resolve a CSS expression string to a color value (hex string).
 *
 * Steps:
 * 1. Resolve all var() references
 * 2. Evaluate hsl/rgb functions to hex
 * 3. Return the resolved color string
 */
export function resolveColorExpression(
  value: string,
  vars: Record<string, string>
): string {
  if (!value || typeof value !== 'string') return value;

  // Step 1: Resolve var() references
  let resolved = resolveVarReferences(value, vars);

  // Step 2: Clean up empty color function calls that result from unresolved vars
  // e.g. hsl(var(--undefined-var)) → hsl() → 'transparent'
  if (
    /^hsla?\(\s*\)$/.test(resolved.trim()) ||
    /^rgba?\(\s*\)$/.test(resolved.trim())
  ) {
    if (__DEV__ && !_warnedExpressions.has(value)) {
      _warnedExpressions.add(value);
      console.warn(
        `[react-native-stylefn] Color expression "${value}" resolved to empty "${resolved}". ` +
          'Check that all referenced CSS variables are defined in your global.css.'
      );
    }
    return 'transparent';
  }

  // Step 3: Resolve color functions
  if (resolved.includes('hsl') || resolved.includes('HSL')) {
    resolved = resolveHslFunctions(resolved);
  }
  if (resolved.includes('rgb') || resolved.includes('RGB')) {
    resolved = resolveRgbFunctions(resolved);
  }

  return resolved;
}

/**
 * Resolve a CSS expression string to a numeric value.
 *
 * Steps:
 * 1. Resolve all var() references
 * 2. Evaluate calc() if present (with rem support)
 * 3. Parse as number
 *
 * @param value - The expression string or number
 * @param vars - CSS variable map for var() resolution
 * @param inlineRem - Base pixel value for rem→px conversion (default 16)
 */
export function resolveNumericExpression(
  value: string | number,
  vars: Record<string, string>,
  inlineRem: number = 16
): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;

  // Step 1: Resolve var() references
  let resolved = resolveVarReferences(value, vars);

  // Step 2: Evaluate calc()
  if (resolved.includes('calc(')) {
    return evaluateSimpleCalc(resolved, inlineRem);
  }

  // Step 2b: Handle standalone rem values (e.g. "0.625rem" without calc)
  const remMatch = resolved.trim().match(/^(-?\d+\.?\d*)rem$/);
  if (remMatch) {
    return parseFloat(remMatch[1]!) * inlineRem;
  }

  // Step 3: Parse as number
  const num = parseFloat(resolved);
  return isNaN(num) ? 0 : num;
}

/**
 * Resolve a CSS expression string to a shadow value (string).
 * Resolves var() references AND color functions (hsl, rgb) within the shadow
 * string so that React Native's boxShadow parser receives hex colors.
 *
 * @example
 *   "0 1px 3px 0 hsl(0 0% 0% / 0.1)" → "0 1px 3px 0 #0000001a"
 *   "var(--shadow-2)"                  → resolved var → resolved colors
 */
export function resolveShadowExpression(
  value: string,
  vars: Record<string, string>
): string {
  if (!value || typeof value !== 'string') return value;

  // Step 1: Resolve var() references
  let resolved = resolveVarReferences(value, vars);

  // Step 2: Resolve color functions (hsl/rgb) to hex so RN can parse them
  if (resolved.includes('hsl') || resolved.includes('HSL')) {
    resolved = resolveHslFunctions(resolved);
  }
  if (resolved.includes('rgb') || resolved.includes('RGB')) {
    resolved = resolveRgbFunctions(resolved);
  }

  return resolved;
}

/**
 * Resolve a CSS expression to its final value (auto-detect type).
 * Returns string or number depending on context.
 *
 * @param value - The expression string or number
 * @param vars - CSS variable map for var() resolution
 * @param inlineRem - Base pixel value for rem→px conversion (default 16)
 */
export function resolveCssExpression(
  value: string | number,
  vars: Record<string, string>,
  inlineRem: number = 16
): string | number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return value;

  // Step 1: Resolve var() references
  let resolved = resolveVarReferences(value, vars);

  // Step 2: Check for function expressions
  if (resolved.includes('hsl') || resolved.includes('HSL')) {
    resolved = resolveHslFunctions(resolved);
  }
  if (resolved.includes('rgb') || resolved.includes('RGB')) {
    resolved = resolveRgbFunctions(resolved);
  }
  if (resolved.includes('calc(')) {
    return evaluateSimpleCalc(resolved, inlineRem);
  }

  // Step 2b: Handle standalone rem values (e.g. "0.625rem" without calc)
  const remMatch = resolved.trim().match(/^(-?\d+\.?\d*)rem$/);
  if (remMatch) {
    return parseFloat(remMatch[1]!) * inlineRem;
  }

  // Step 3: Try to parse as number if it looks numeric
  const trimmed = resolved.trim();
  const num = parseFloat(trimmed);
  if (!isNaN(num) && String(num) === trimmed) {
    return num;
  }

  return resolved;
}

// =============================================================================
// Theme-level resolution — walks an entire theme config
// =============================================================================

/**
 * Flatten nested color objects (Tailwind convention).
 *
 * Converts:
 *   { primary: { DEFAULT: 'blue', foreground: 'white' } }
 * To:
 *   { primary: 'blue', 'primary-foreground': 'white' }
 */
export function flattenColors(
  colors: Record<string, string | Record<string, string>>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      result[key] = value;
    } else if (value && typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === 'string') {
          if (subKey === 'DEFAULT') {
            result[key] = subValue;
          } else {
            result[`${key}-${subKey}`] = subValue;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Resolve all CSS expressions in a numeric theme map (spacing, fontSize, etc.).
 *
 * @param map - The theme map to resolve
 * @param vars - CSS variable map for var() resolution
 * @param inlineRem - Base pixel value for rem→px conversion (default 16)
 */
export function resolveNumericMap(
  map: Record<string, number | string> | undefined,
  vars: Record<string, string>,
  inlineRem: number = 16
): Record<string, number> {
  if (!map) return {};

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === 'number') {
      result[key] = value;
    } else if (typeof value === 'string') {
      result[key] = resolveNumericExpression(value, vars, inlineRem);
    }
  }
  return result;
}

/**
 * Resolve all CSS expressions in a color map.
 * Also flattens nested color objects.
 */
export function resolveColorMap(
  colors: Record<string, string | Record<string, string>> | undefined,
  vars: Record<string, string>
): Record<string, string> {
  if (!colors) return {};

  // First flatten nested objects
  const flat = flattenColors(colors);

  // Then resolve CSS expressions
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (containsCssExpression(value)) {
      result[key] = resolveColorExpression(value, vars);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Resolve all CSS expressions in a shadow map.
 * Handles both string values and { boxShadow: string } objects.
 * Always returns plain strings suitable for use directly as the `boxShadow`
 * style property value in React Native.
 */
export function resolveShadowMap(
  shadows: Record<string, string | object> | undefined,
  vars: Record<string, string>
): Record<string, string> {
  if (!shadows) return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(shadows)) {
    if (typeof value === 'string') {
      // Plain string — resolve var()/hsl()/rgb() and store as-is
      result[key] = resolveShadowExpression(value, vars);
    } else if (value && typeof value === 'object') {
      // Object with a boxShadow property — extract and resolve the string
      const obj = value as Record<string, unknown>;
      const boxShadow = obj.boxShadow;
      if (typeof boxShadow === 'string') {
        result[key] = containsCssExpression(boxShadow)
          ? resolveShadowExpression(boxShadow, vars)
          : boxShadow;
      }
      // Ignore objects without a boxShadow string — not supported
    }
  }
  return result;
}

// =============================================================================
// Auto-detect color-like CSS variables
//
// Scans raw CSS variables and identifies values that look like colors:
//   - Bare HSL values: "220 13% 91%" (shadcn/ui convention)
//   - Hex colors: "#fff", "#ffffff"
//   - hsl()/rgb() function calls
//
// Detected color vars are auto-promoted to t.colors.* so users can write:
//   --input: 220 13% 91%;
// and use it as:
//   t.colors.input
// without needing to manually map `input: 'hsl(var(--input))'` in config.
// =============================================================================

/**
 * Regex for bare HSL values (the shadcn/ui convention):
 *   "220 13% 91%"
 *   "0 0% 100%"
 *   "220 13% 91% / 0.5" (with alpha)
 *
 * Does NOT match plain numbers, shadow strings, keywords, etc.
 */
const BARE_HSL_RE =
  /^\s*(\d+\.?\d*)\s+(\d+\.?\d*)%\s+(\d+\.?\d*)%\s*(?:\/\s*(\d+\.?\d*)%?\s*)?$/;

/**
 * Regex for hex color values: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 */
const HEX_COLOR_RE = /^\s*#([0-9a-fA-F]{3,8})\s*$/;

/**
 * Check if a CSS variable value looks like a color.
 */
function isColorLikeValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();

  // Bare HSL values (shadcn convention): "220 13% 91%"
  if (BARE_HSL_RE.test(trimmed)) return true;

  // Hex colors: #fff, #ffffff, etc.
  if (HEX_COLOR_RE.test(trimmed)) return true;

  // hsl()/hsla()/rgb()/rgba() function calls
  if (/^hsla?\s*\(/i.test(trimmed)) return true;
  if (/^rgba?\s*\(/i.test(trimmed)) return true;

  return false;
}

/**
 * Convert a bare HSL value string to an hsl() function call string.
 * e.g. "220 13% 91%" → "hsl(220, 13%, 91%)"
 *      "220 13% 91% / 0.5" → "hsla(220, 13%, 91%, 0.5)"
 */
function wrapBareHsl(value: string): string {
  const match = value.trim().match(BARE_HSL_RE);
  if (!match) return value;

  const h = match[1];
  const s = match[2];
  const l = match[3];
  const a = match[4];

  if (a !== undefined) {
    return `hsla(${h}, ${s}%, ${l}%, ${a})`;
  }
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Scan raw CSS variables and return a map of auto-detected color variables.
 * Only variables whose values look like colors are included.
 *
 * Bare HSL values are converted to hex via hsl→hex conversion.
 * Other color formats are resolved via resolveColorExpression.
 *
 * Variables that start with known non-color prefixes (shadow-, radius, etc.)
 * are skipped even if their values happen to match a color pattern.
 *
 * @param rawVars - The raw CSS variables map (-- prefix already stripped)
 * @param allRawVars - Full raw vars map for var() resolution within color values
 * @returns Map of variable name → resolved hex color string
 */
export function autoDetectColorVars(
  rawVars: Record<string, string>,
  allRawVars?: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  const vars = allRawVars ?? rawVars;

  for (const [key, value] of Object.entries(rawVars)) {
    // Skip --color-* vars (already handled by the existing prefix-based logic)
    if (key.startsWith('color-')) continue;

    // Skip known non-color variable prefixes
    if (
      key.startsWith('shadow-') ||
      key.startsWith('radius') ||
      key.startsWith('font-') ||
      key.startsWith('spacing-') ||
      key.startsWith('breakpoint-')
    ) {
      continue;
    }

    // First resolve any var() references in the value
    let resolved = value;
    if (resolved.includes('var(')) {
      resolved = resolveColorExpression(resolved, vars);
    }

    // Check if the (resolved) value looks like a color
    if (!isColorLikeValue(resolved)) continue;

    // Convert bare HSL to wrapped hsl() call, then resolve to hex
    if (BARE_HSL_RE.test(resolved.trim())) {
      resolved = wrapBareHsl(resolved);
    }

    // Resolve hsl()/rgb() to hex
    resolved = resolveColorExpression(resolved, vars);

    // Only include if we got a non-empty result
    if (resolved && resolved !== 'transparent') {
      result[key] = resolved;
    }
  }

  return result;
}

/**
 * Get the raw CSS variables map for a given color scheme.
 * Falls back to constructing from color vars if rawVars is not available.
 */
export function getRawVarsForScheme(
  cssVars: {
    light: Record<string, string>;
    dark: Record<string, string>;
    rawVars?: { light: Record<string, string>; dark: Record<string, string> };
  },
  scheme: 'light' | 'dark'
): Record<string, string> {
  if (cssVars.rawVars) {
    return scheme === 'light' ? cssVars.rawVars.light : cssVars.rawVars.dark;
  }

  // Backward compat: reconstruct from color vars (prefix with color-)
  const colorVars = scheme === 'light' ? cssVars.light : cssVars.dark;
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(colorVars)) {
    raw[`color-${key}`] = value;
  }
  return raw;
}

declare const __DEV__: boolean;
