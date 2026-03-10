import type { CSSVariables } from '../types';

/**
 * Parses a CSS string containing :root and .dark selectors,
 * extracting CSS custom properties (variables) into light/dark maps.
 *
 * Only :root and .dark selectors are processed.
 * Other selectors emit a dev warning and are ignored.
 */
export function parseCSSVariables(css: string): CSSVariables {
  const result: CSSVariables = {
    light: {},
    dark: {},
  };

  if (!css || typeof css !== 'string') {
    return result;
  }

  // Match selector blocks: selector { ... }
  const blockRegex = /([^{]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(css)) !== null) {
    const selector = (match[1] ?? '').trim();
    const body = match[2] ?? '';

    let target: Record<string, string> | null = null;

    if (selector === ':root') {
      target = result.light;
    } else if (selector === '.dark') {
      target = result.dark;
    } else {
      if (__DEV__) {
        console.warn(
          `[react-native-stylefn] CSS selector "${selector}" is not supported. ` +
            'Only :root and .dark selectors are parsed.'
        );
      }
      continue;
    }

    // Parse CSS custom properties: --name: value;
    const propRegex = /--color-([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
    let propMatch: RegExpExecArray | null;

    while ((propMatch = propRegex.exec(body)) !== null) {
      const name = (propMatch[1] ?? '').trim();
      const value = (propMatch[2] ?? '').trim();
      if (name && value) {
        target[name] = value;
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
    return { light: {}, dark: {} };
  }
  return parseCSSVariables(cssContent);
}

declare const __DEV__: boolean;
