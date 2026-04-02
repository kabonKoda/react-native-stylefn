import type { CSSVariables } from '../types';

/**
 * Recursively unwrap @layer blocks, returning just their inner content.
 * Handles deeply nested braces correctly by counting brace depth.
 *
 * e.g. @layer theme { :root { --foo: bar; } }  →  :root { --foo: bar; }
 *
 * Also strips bare @layer declarations (no block):
 *   @layer base, utilities;  →  (empty)
 */
function unwrapAtLayerBlocks(css: string): string {
  // Strip bare @layer declarations (no block body): @layer base, utilities;
  css = css.replace(/@layer\s+[^{;]+;/g, '');

  let result = '';
  let i = 0;

  while (i < css.length) {
    const remaining = css.slice(i);
    const atLayerMatch = remaining.match(/^@layer\s+[^{]+\{/);

    if (atLayerMatch) {
      const matchStr = atLayerMatch[0];
      let depth = 1;
      let j = i + matchStr.length;

      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }

      // Recursively unwrap nested @layer blocks inside this one
      const innerContent = css.slice(i + matchStr.length, j);
      result += unwrapAtLayerBlocks(innerContent);
      i = j + 1; // skip past the closing }
    } else {
      result += css[i];
      i++;
    }
  }

  return result;
}

/**
 * Parses a CSS string containing :root and .dark selectors,
 * extracting CSS custom properties (variables) into light/dark maps.
 *
 * Only :root and .dark selectors are processed.
 * Other selectors emit a dev warning and are ignored.
 *
 * Produces two sets of variables:
 * 1. `light`/`dark` — only `--color-*` variables with prefix stripped (backward compat)
 * 2. `rawVars.light`/`rawVars.dark` — ALL `--*` variables with `--` prefix stripped (for var() resolution)
 */
export function parseCSSVariables(css: string): CSSVariables {
  const result: CSSVariables = {
    light: {},
    dark: {},
    rawVars: {
      light: {},
      dark: {},
    },
  };

  if (!css || typeof css !== 'string') {
    return result;
  }

  // Strip CSS comments (/* ... */) before parsing to prevent them
  // from being included in selector matches
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip @tailwind directives (no-op in RN — defaults are already built in)
  // e.g. @tailwind base; @tailwind components; @tailwind utilities;
  css = css.replace(/@tailwind\s+[^;]+;/g, '');

  // Strip @import directives (not supported in RN context)
  css = css.replace(/@import\s+[^;]+;/g, '');

  // Unwrap @layer blocks using a brace-balanced parser.
  // The simple regex approach breaks for nested blocks like:
  //   @layer theme { :root { --foo: bar; } }
  // because [^}] stops at the first closing brace. We walk character-by-character
  // counting depth so every nested level is correctly unwrapped.
  css = unwrapAtLayerBlocks(css);

  // Match selector blocks: selector { ... }
  const blockRegex = /([^{]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(css)) !== null) {
    const selector = (match[1] ?? '').trim();
    const body = match[2] ?? '';

    let colorTarget: Record<string, string> | null = null;
    let rawTarget: Record<string, string> | null = null;

    if (selector === ':root') {
      colorTarget = result.light;
      rawTarget = result.rawVars!.light;
    } else if (selector === '.dark') {
      colorTarget = result.dark;
      rawTarget = result.rawVars!.dark;
    } else {
      if (__DEV__) {
        console.warn(
          `[react-native-stylefn] CSS selector "${selector}" is not supported. ` +
            'Only :root and .dark selectors are parsed.'
        );
      }
      continue;
    }

    // Parse ALL CSS custom properties: --name: value;
    const allPropRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
    let propMatch: RegExpExecArray | null;

    while ((propMatch = allPropRegex.exec(body)) !== null) {
      const fullName = (propMatch[1] ?? '').trim();
      const value = (propMatch[2] ?? '').trim();

      if (!fullName || !value) continue;

      // Store in rawVars (ALL variables, -- prefix stripped, full name preserved)
      rawTarget[fullName] = value;

      // Backward compat: also store --color-* variables with prefix stripped
      if (fullName.startsWith('color-')) {
        const colorName = fullName.slice(6); // strip 'color-' prefix
        if (colorName) {
          colorTarget[colorName] = value;
        }
      }
    }
  }

  return result;
}

/**
 * Attempts to read and parse a global.css file.
 * Returns empty variables if the file doesn't exist or can't be read.
 */
export function loadCSSVariables(cssContent?: string): CSSVariables {
  if (!cssContent) {
    return { light: {}, dark: {}, rawVars: { light: {}, dark: {} } };
  }
  return parseCSSVariables(cssContent);
}

declare const __DEV__: boolean;
