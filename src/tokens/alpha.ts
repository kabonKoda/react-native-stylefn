/**
 * Color opacity helper — `t.alpha(color, opacity)`
 *
 * Applies an opacity value to any CSS/React Native color string and returns
 * an `#RRGGBBAA` hex string that React Native renders natively.
 *
 * This is the runtime counterpart of Tailwind's `/opacity` modifier:
 *   `bg-primary/50`  →  `t.alpha(t.colors.primary, 0.5)`
 *   `bg-muted/30`    →  `t.alpha(t.colors.muted, 0.3)`
 *   `bg-black/80`    →  `t.alpha('#000000', 0.8)`
 *
 * Accepted color formats
 * ──────────────────────
 *  - `#RGB`         (3-char shorthand, e.g. `#f00`)
 *  - `#RGBA`        (4-char shorthand, e.g. `#f00f`)
 *  - `#RRGGBB`      (6-char, e.g. `#ff0000`)
 *  - `#RRGGBBAA`    (8-char, existing alpha is replaced)
 *  - `rgb(r, g, b)` / `rgba(r, g, b, a)` (0–255 integers or percentages)
 *  - `hsl(h, s%, l%)` / `hsla(h, s%, l%, a)`
 *
 * Opacity range
 * ─────────────
 *  - `0–1`   treated as a fraction (standard CSS range)
 *  - `1–100` treated as a percentage (auto-detected) and divided by 100
 *
 * Returns `#RRGGBBAA` — an 8-character hex string React Native supports
 * natively on all platforms.
 *
 * @example
 * ```tsx
 * // Inside a style function:
 * <View style={(t) => ({
 *   backgroundColor: t.alpha(t.colors.primary, 0.1),   // 10% opacity
 *   borderColor:     t.alpha(t.colors.border, 0.2),    // 20% opacity
 *   shadowColor:     t.alpha('#000000', 0.5),           // black at 50%
 * })} />
 *
 * // With active/hovered state:
 * <View style={(t) => ({
 *   backgroundColor: t.active
 *     ? t.alpha(t.colors.primary, 0.9)
 *     : t.alpha(t.colors.muted, 0.5),
 * })} />
 * ```
 */
export function alpha(color: string, opacity: number): string {
  // ── Normalise opacity ────────────────────────────────────────────────────────
  let o = opacity;
  // Treat values > 1 as a 0–100 percentage (convenience for Tailwind migrations)
  if (o > 1) o = o / 100;
  // Clamp to [0, 1]
  o = Math.max(0, Math.min(1, o));

  const alphaInt = Math.round(o * 255);
  const alphaHex = alphaInt.toString(16).padStart(2, '0');

  const [r, g, b] = parseColorToRGB(color);

  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0') +
    alphaHex
  );
}

// =============================================================================
// t.colors Proxy — `/opacity`, `/light`, `/dark`, and `/light|dark/opacity`
// =============================================================================

/**
 * Wraps a resolved colors map in a `Proxy` that handles four key formats:
 *
 * ```
 * colorKey                    plain color (current scheme)
 * colorKey/opacity            current-scheme color at N% opacity   ← backward compat
 * colorKey/light              light-scheme color, regardless of current scheme
 * colorKey/dark               dark-scheme color, regardless of current scheme
 * colorKey/light/opacity      light-scheme color at N% opacity
 * colorKey/dark/opacity       dark-scheme color at N% opacity
 * ```
 *
 * **Scheme variants** let you hard-code a color to always come from a
 * specific palette — useful for UI elements that must look a certain way
 * independent of the device's color scheme:
 *
 * ```tsx
 * // Always dark-mode background (e.g. for a dark overlay on a light screen)
 * t.colors['background/dark']
 *
 * // Always light-mode surface (e.g. for a card that stays light in dark mode)
 * t.colors['surface/light']
 *
 * // Dark-mode primary color at 50% opacity
 * t.colors['primary/dark/50']
 *
 * // Light-mode text at 75% opacity
 * t.colors['text/light/75']
 * ```
 *
 * **Opacity rules** (same as `alpha()`):
 *   - `0–1`   treated as a fraction  (`/0.5` → 50%)
 *   - `2–100` treated as a percentage (`/50`  → 50%)
 *
 * When `lightColors` / `darkColors` are not provided (backward-compat call
 * sites) the proxy falls back to the current-scheme map.
 *
 * @param colors      Resolved color map for the **current** color scheme.
 * @param lightColors Resolved color map for the **light** scheme (optional).
 * @param darkColors  Resolved color map for the **dark** scheme (optional).
 * @returns A Proxy that resolves the key formats above on the fly.
 */
export function createColorsProxy(
  colors: Record<string, string>,
  lightColors?: Record<string, string>,
  darkColors?: Record<string, string>
): Record<string, string> {
  return new Proxy(colors, {
    get(target, prop: string | symbol) {
      if (typeof prop !== 'string') {
        return (target as Record<string | symbol, string>)[prop];
      }

      // Fast path — no slash, nothing to parse
      if (prop.indexOf('/') === -1) {
        return target[prop];
      }

      // Split into at most 3 parts on '/'
      // We only support exactly 2 or 3 segments beyond the fast path.
      // Color keys never contain '/' (CSS variable names use '-' separators).
      const firstSlash = prop.indexOf('/');
      const colorKey = prop.slice(0, firstSlash);
      const rest = prop.slice(firstSlash + 1); // everything after the first '/'

      const secondSlash = rest.indexOf('/');

      let scheme: 'light' | 'dark' | null = null;
      let opacity: number | null = null;

      if (secondSlash === -1) {
        // ── Two-segment key: colorKey/X ───────────────────────────────────────
        // X is either a scheme name ('light'|'dark') or a numeric opacity.
        if (rest === 'light' || rest === 'dark') {
          scheme = rest;
        } else {
          const num = parseFloat(rest);
          if (!isNaN(num)) {
            opacity = num; // backward-compat: colorKey/opacity
          } else {
            return target[prop]; // unknown format — fall through
          }
        }
      } else {
        // ── Three-segment key: colorKey/scheme/opacity ────────────────────────
        const schemePart = rest.slice(0, secondSlash);
        const opacityPart = rest.slice(secondSlash + 1);

        if (schemePart !== 'light' && schemePart !== 'dark') {
          return target[prop]; // unknown format — fall through
        }
        const num = parseFloat(opacityPart);
        if (isNaN(num)) {
          return target[prop]; // opacity part isn't numeric — fall through
        }

        scheme = schemePart;
        opacity = num;
      }

      // ── Select the correct color map ─────────────────────────────────────────
      const colorMap: Record<string, string> =
        scheme === 'light'
          ? lightColors ?? target
          : scheme === 'dark'
          ? darkColors ?? target
          : target;

      if (!(colorKey in colorMap)) {
        return target[prop]; // color key not found — fall through
      }

      const baseColor = colorMap[colorKey]!;

      return opacity !== null ? alpha(baseColor, opacity) : baseColor;
    },
  });
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Parses a CSS color string into [R, G, B] integers (0–255 each).
 * Returns [0, 0, 0] for unrecognised inputs.
 */
function parseColorToRGB(color: string): [number, number, number] {
  const s = color.trim().toLowerCase();

  // ── Hex formats ─────────────────────────────────────────────────────────────
  if (s.startsWith('#')) {
    const h = s.slice(1);
    let r: number, g: number, b: number;

    if (h.length === 3 || h.length === 4) {
      // #RGB or #RGBA
      r = parseInt(h[0]! + h[0]!, 16);
      g = parseInt(h[1]! + h[1]!, 16);
      b = parseInt(h[2]! + h[2]!, 16);
    } else if (h.length === 6 || h.length === 8) {
      // #RRGGBB or #RRGGBBAA
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      return [0, 0, 0];
    }

    return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
  }

  // ── rgb() / rgba() ───────────────────────────────────────────────────────────
  // Matches both integer (0-255) and percentage (0%-100%) channel values.
  const rgbMatch = s.match(
    /^rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)/i
  );
  if (rgbMatch) {
    return [
      parseChannelValue(rgbMatch[1]!),
      parseChannelValue(rgbMatch[2]!),
      parseChannelValue(rgbMatch[3]!),
    ];
  }

  // ── hsl() / hsla() ───────────────────────────────────────────────────────────
  // e.g. hsl(210, 40%, 60%) or hsla(210deg, 40%, 60%, 0.8)
  const hslMatch = s.match(
    /^hsla?\(\s*([\d.]+)(?:deg|rad|turn|grad)?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]!) / 360;
    const sl = parseFloat(hslMatch[2]!) / 100;
    const l = parseFloat(hslMatch[3]!) / 100;
    return hslToRGB(h, sl, l);
  }

  // ── Space-separated modern syntax: rgb(210 40% 60%) ─────────────────────────
  const spaceSepMatch = s.match(
    /^rgba?\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)/i
  );
  if (spaceSepMatch) {
    return [
      parseChannelValue(spaceSepMatch[1]!),
      parseChannelValue(spaceSepMatch[2]!),
      parseChannelValue(spaceSepMatch[3]!),
    ];
  }

  // ── Unrecognised (named colours etc.) ───────────────────────────────────────
  return [0, 0, 0];
}

/**
 * Parses a CSS channel value that may be a plain number (0–255) or a
 * percentage string like `"40%"`.
 */
function parseChannelValue(value: string): number {
  if (value.endsWith('%')) {
    return Math.round((parseFloat(value) / 100) * 255);
  }
  return Math.min(255, Math.max(0, Math.round(parseFloat(value))));
}

/**
 * Converts HSL fractions (all in [0,1]) to [R, G, B] integers (0–255).
 */
function hslToRGB(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tNorm = t;
  if (tNorm < 0) tNorm += 1;
  if (tNorm > 1) tNorm -= 1;
  if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
  if (tNorm < 1 / 2) return q;
  if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
  return p;
}
