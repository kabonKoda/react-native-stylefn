/**
 * Tests for the `alpha(color, opacity)` color opacity helper.
 *
 * Covers all supported input formats and edge cases including:
 *  - Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
 *  - rgb() / rgba() with integers and percentages
 *  - hsl() / hsla() with various unit notations
 *  - Space-separated modern rgb() syntax
 *  - Opacity normalisation (0-1 and 0-100 ranges, clamping)
 *  - Tailwind migration patterns (the primary use case)
 */
import { alpha, createColorsProxy } from '../tokens/alpha';

// Helper: parse an 8-char hex string into [r, g, b, a] integers
function fromHex8(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    parseInt(h.slice(6, 8), 16),
  ];
}

describe('alpha(color, opacity)', () => {
  // ── Output format ───────────────────────────────────────────────────────────

  describe('output format', () => {
    it('always returns an 8-character #RRGGBBAA string', () => {
      const result = alpha('#ff0000', 0.5);
      expect(result).toMatch(/^#[0-9a-f]{8}$/);
    });

    it('returns lowercase hex', () => {
      const result = alpha('#FF0000', 1);
      expect(result).toBe('#ff0000ff');
    });
  });

  // ── Hex input formats ───────────────────────────────────────────────────────

  describe('hex inputs', () => {
    it('handles #RRGGBB at opacity 1', () => {
      expect(alpha('#ff0000', 1)).toBe('#ff0000ff');
    });

    it('handles #RRGGBB at opacity 0', () => {
      expect(alpha('#ff0000', 0)).toBe('#ff000000');
    });

    it('handles #RRGGBB at opacity 0.5 (128/255)', () => {
      const [, , , a] = fromHex8(alpha('#ff0000', 0.5));
      expect(a).toBe(Math.round(0.5 * 255)); // 128
    });

    it('handles #RGB shorthand', () => {
      // #f00 → #ff0000
      const result = alpha('#f00', 1);
      expect(result).toBe('#ff0000ff');
    });

    it('handles #RGBA shorthand (alpha channel is replaced)', () => {
      // #f00f → #ff0000 with new alpha
      const result = alpha('#f00f', 0.5);
      const [r, g, b, a] = fromHex8(result);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(a).toBe(Math.round(0.5 * 255));
    });

    it('handles #RRGGBBAA input (existing alpha replaced)', () => {
      // Original alpha (80) should be replaced by the new opacity
      const result = alpha('#ff000080', 1);
      expect(result).toBe('#ff0000ff');
    });

    it('handles uppercase hex', () => {
      expect(alpha('#FF0000', 1)).toBe('#ff0000ff');
    });

    it('handles zero colour (#000000)', () => {
      expect(alpha('#000000', 0.8)).toBe(
        '#000000' +
          Math.round(0.8 * 255)
            .toString(16)
            .padStart(2, '0')
      );
    });

    it('handles white (#ffffff)', () => {
      expect(alpha('#ffffff', 0.9)).toBe(
        '#ffffff' +
          Math.round(0.9 * 255)
            .toString(16)
            .padStart(2, '0')
      );
    });
  });

  // ── rgb() / rgba() ──────────────────────────────────────────────────────────

  describe('rgb() / rgba() inputs', () => {
    it('handles rgb(r, g, b) with integers', () => {
      const result = alpha('rgb(255, 0, 0)', 0.5);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('handles rgba(r, g, b, a) — ignores existing alpha', () => {
      const result = alpha('rgba(255, 0, 0, 0.2)', 0.8);
      const [, , , a] = fromHex8(result);
      expect(a).toBe(Math.round(0.8 * 255));
    });

    it('handles rgb() percentage channels', () => {
      // rgb(100%, 0%, 0%) = red
      const result = alpha('rgb(100%, 0%, 0%)', 1);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });
  });

  // ── hsl() / hsla() ──────────────────────────────────────────────────────────

  describe('hsl() / hsla() inputs', () => {
    it('handles hsl(0, 100%, 50%) → red', () => {
      const result = alpha('hsl(0, 100%, 50%)', 1);
      const [r, g, b, a] = fromHex8(result);
      expect(r).toBe(255);
      expect(g).toBe(0);
      expect(b).toBe(0);
      expect(a).toBe(255);
    });

    it('handles hsl(120, 100%, 50%) → green', () => {
      const result = alpha('hsl(120, 100%, 50%)', 1);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(0);
      expect(g).toBe(255);
      expect(b).toBe(0);
    });

    it('handles hsl(240, 100%, 50%) → blue', () => {
      const result = alpha('hsl(240, 100%, 50%)', 1);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(255);
    });

    it('handles hsl(0, 0%, 0%) → black', () => {
      const result = alpha('hsl(0, 0%, 0%)', 1);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('handles hsl(0, 0%, 100%) → white', () => {
      const result = alpha('hsl(0, 0%, 100%)', 1);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
    });

    it('handles hsla() — ignores existing alpha', () => {
      const result = alpha('hsla(0, 100%, 50%, 0.2)', 0.5);
      const [, , , a] = fromHex8(result);
      expect(a).toBe(Math.round(0.5 * 255));
    });
  });

  // ── Opacity normalisation ───────────────────────────────────────────────────

  describe('opacity normalisation', () => {
    it('treats opacity 0-1 as a fraction', () => {
      const [, , , a] = fromHex8(alpha('#ff0000', 0.3));
      expect(a).toBe(Math.round(0.3 * 255));
    });

    it('treats opacity > 1 as 0-100 percentage', () => {
      const [, , , a30pct] = fromHex8(alpha('#ff0000', 30));
      const [, , , a30frac] = fromHex8(alpha('#ff0000', 0.3));
      expect(a30pct).toBe(a30frac);
    });

    it('treats opacity 50 as 50% (same as 0.5)', () => {
      const [, , , a] = fromHex8(alpha('#ff0000', 50));
      expect(a).toBe(Math.round(0.5 * 255));
    });

    it('clamps opacity to 0 (negative)', () => {
      const [, , , a] = fromHex8(alpha('#ff0000', -0.5));
      expect(a).toBe(0);
    });

    it('clamps opacity to 1 when >1 after percentage conversion', () => {
      const [, , , a] = fromHex8(alpha('#ff0000', 150));
      expect(a).toBe(255);
    });

    it('opacity 0 produces transparent (#00 alpha channel)', () => {
      const result = alpha('#ff0000', 0);
      expect(result.endsWith('00')).toBe(true);
    });

    it('opacity 1 produces fully opaque (#ff alpha channel)', () => {
      const result = alpha('#ff0000', 1);
      expect(result.endsWith('ff')).toBe(true);
    });
  });

  // ── Tailwind migration patterns (primary use cases) ─────────────────────────

  describe('Tailwind migration patterns', () => {
    // bg-black/50 → t.alpha('#000000', 0.5)
    it('bg-black/50 equivalent', () => {
      const [, , , a] = fromHex8(alpha('#000000', 0.5));
      expect(a).toBe(Math.round(0.5 * 255));
    });

    // bg-white/90 → t.alpha('#ffffff', 0.9)
    it('bg-white/90 equivalent', () => {
      const [r, g, b, a] = fromHex8(alpha('#ffffff', 0.9));
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
      expect(a).toBe(Math.round(0.9 * 255));
    });

    // active:bg-white/30 → t.active ? t.alpha('#ffffff', 0.3) : ...
    it('active:bg-white/30 equivalent', () => {
      const [, , , a] = fromHex8(alpha('#ffffff', 0.3));
      expect(a).toBe(Math.round(0.3 * 255));
    });

    // border-border/20 — border token at 20% opacity
    it('border-border/20 equivalent (token colour string)', () => {
      const borderColor = '#94a3b8'; // example slate-400
      const result = alpha(borderColor, 0.2);
      const [r, g, b, a] = fromHex8(result);
      expect(r).toBe(0x94);
      expect(g).toBe(0xa3);
      expect(b).toBe(0xb8);
      expect(a).toBe(Math.round(0.2 * 255));
    });

    // bg-primary/10 at opacity 10
    it('accepts opacity as integer percentage (10 → 10%)', () => {
      const [, , , a] = fromHex8(alpha('#6366f1', 10));
      expect(a).toBe(Math.round(0.1 * 255));
    });
  });

  // ── createColorsProxy — t.colors['token/opacity'] ───────────────────────────

  describe('createColorsProxy — /opacity suffix on t.colors', () => {
    const colors = {
      'primary': '#6366f1',
      'muted': '#94a3b8',
      'muted-foreground': '#64748b',
      'border': '#e2e8f0',
      'yellow-900': '#713f12',
    };
    const proxy = createColorsProxy(colors);

    it('passes through plain keys unchanged', () => {
      expect(proxy['primary']).toBe('#6366f1');
      expect(proxy['muted']).toBe('#94a3b8');
    });

    it('applies /percentage opacity: primary/10', () => {
      const result = proxy['primary/10'];
      expect(result).toMatch(/^#[0-9a-f]{8}$/);
      // Should equal alpha('#6366f1', 10) = alpha at 10%
      expect(result).toBe(alpha('#6366f1', 10));
    });

    it('applies /percentage opacity: muted/30', () => {
      expect(proxy['muted/30']).toBe(alpha('#94a3b8', 30));
    });

    it('applies /percentage opacity: muted/50', () => {
      expect(proxy['muted/50']).toBe(alpha('#94a3b8', 50));
    });

    it('works with hyphenated token names: muted-foreground/30', () => {
      expect(proxy['muted-foreground/30']).toBe(alpha('#64748b', 30));
    });

    it('works with numeric token names: yellow-900/30', () => {
      expect(proxy['yellow-900/30']).toBe(alpha('#713f12', 30));
    });

    it('works with fraction opacity: border/0.2', () => {
      expect(proxy['border/0.2']).toBe(alpha('#e2e8f0', 0.2));
    });

    it('returns undefined for unknown base key', () => {
      expect(proxy['nonexistent/50']).toBeUndefined();
    });

    it('Tailwind pattern: bg-primary/10 → primary/10', () => {
      const result = proxy['primary/10']!;
      const h = result.replace('#', '');
      const a = parseInt(h.slice(6, 8), 16);
      expect(a).toBe(Math.round(0.1 * 255));
    });

    it('Tailwind pattern: bg-muted/50', () => {
      const result = proxy['muted/50']!;
      const h = result.replace('#', '');
      const a = parseInt(h.slice(6, 8), 16);
      expect(a).toBe(Math.round(0.5 * 255));
    });

    it('Tailwind pattern: border-border/20', () => {
      const result = proxy['border/20']!;
      const h = result.replace('#', '');
      const a = parseInt(h.slice(6, 8), 16);
      expect(a).toBe(Math.round(0.2 * 255));
    });

    it('dark:bg-yellow-900/30 pattern', () => {
      const result = proxy['yellow-900/30']!;
      expect(result).toBe(alpha('#713f12', 30));
    });
  });

  // ── Unrecognised inputs ─────────────────────────────────────────────────────

  describe('unrecognised inputs', () => {
    it('returns #000000xx for unrecognised colour strings', () => {
      const result = alpha('not-a-color', 0.5);
      const [r, g, b] = fromHex8(result);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });
  });
});
