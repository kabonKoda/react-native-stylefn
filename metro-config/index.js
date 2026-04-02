/**
 * withStyleFn — Metro config wrapper for react-native-stylefn
 *
 * Processes your global.css and makes the parsed CSS variables available
 * at runtime via a virtual module that StyleProvider picks up automatically.
 *
 * Usage in metro.config.js:
 *
 *   const { withStyleFn } = require('react-native-stylefn/metro-config');
 *   module.exports = withStyleFn(config, { input: './global.css' });
 */

const path = require('path');
const fs = require('fs');

/**
 * Recursively unwrap @layer blocks, returning just their inner content.
 * Handles deeply nested braces correctly by counting brace depth.
 *
 * e.g. @layer theme { :root { --foo: bar; } }  →  :root { --foo: bar; }
 *
 * Also strips bare @layer declarations (no block):
 *   @layer base, utilities;  →  (empty)
 */
function unwrapAtLayerBlocks(css) {
  // Strip bare @layer declarations (no block body): @layer base, utilities;
  css = css.replace(/@layer\s+[^{;]+;/g, '');

  let result = '';
  let i = 0;

  while (i < css.length) {
    // Try to match the start of an @layer block at current position
    const remaining = css.slice(i);
    const atLayerMatch = remaining.match(/^@layer\s+[^{]+\{/);

    if (atLayerMatch) {
      const matchStr = atLayerMatch[0];
      // Walk forward counting braces until the @layer block is closed
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

      // Extract inner content and recursively unwrap any nested @layer blocks
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
 * If global.css contains `@import "tailwindcss"` (Tailwind v4 CSS-first),
 * process the file through the Tailwind CLI so all generated CSS custom
 * properties (--color-red-50, --color-green-100, etc.) are written to the
 * output and become available as t.colors.red-50, t.colors.green-100, etc.
 *
 * Falls back gracefully if tailwindcss is not installed.
 */
function expandTailwindImports(cssContent, cssPath, projectRoot) {
  // Only run when there's a Tailwind import (strip comments first to avoid
  // matching @import "tailwindcss" inside documentation comments)
  const withoutComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/@import\s+['"]tailwindcss['"]/m.test(withoutComments))
    return cssContent;

  console.log(
    '[react-native-stylefn] Found @import "tailwindcss" — running Tailwind compiler...'
  );

  // Locate the tailwindcss binary in node_modules/.bin/
  const binCandidates = [
    path.join(projectRoot, 'node_modules', '.bin', 'tailwindcss'),
    path.join(projectRoot, '..', 'node_modules', '.bin', 'tailwindcss'),
    path.join(projectRoot, '..', '..', 'node_modules', '.bin', 'tailwindcss'),
  ];

  const twBin = binCandidates.find((p) => fs.existsSync(p));

  if (!twBin) {
    console.warn(
      '[react-native-stylefn] ⚠  @import "tailwindcss" found but the tailwindcss\n' +
        '   CLI binary was not found in node_modules/.bin/.\n' +
        '   Install it:  npm install tailwindcss\n' +
        '   CSS variables from @import will NOT be available in t.colors.* until\n' +
        '   tailwindcss is installed and Metro is restarted.'
    );
    return cssContent;
  }

  try {
    const { execSync } = require('child_process');
    const os = require('os');
    const outFile = path.join(os.tmpdir(), `stylefn-tw-${Date.now()}.css`);

    // Run the Tailwind CLI synchronously so Metro config remains synchronous
    execSync(`"${twBin}" --input "${cssPath}" --output "${outFile}"`, {
      cwd: projectRoot,
      timeout: 90000,
      stdio: 'pipe',
    });

    const processed = fs.readFileSync(outFile, 'utf8');
    try {
      fs.unlinkSync(outFile);
    } catch {}

    const varCount = (processed.match(/--[a-zA-Z0-9_-]+\s*:/g) || []).length;
    console.log(
      `[react-native-stylefn] ✓ Tailwind CSS compiled (${varCount} CSS variables extracted)`
    );
    return processed;
  } catch (err) {
    console.warn(
      '[react-native-stylefn] ⚠  Tailwind processing failed:',
      err.message || String(err)
    );
    return cssContent;
  }
}

/**
 * Parses CSS variables from a global.css string.
 * Handles :root (light) and .dark selectors.
 *
 * Produces:
 * - light/dark: --color-* variables with prefix stripped (backward compat)
 * - rawVars.light/dark: ALL --* variables with -- prefix stripped (for var() resolution)
 */
function parseCSSVariables(css) {
  const result = { light: {}, dark: {}, rawVars: { light: {}, dark: {} } };
  if (!css || typeof css !== 'string') return result;

  // Strip CSS comments (/* ... */) before parsing to prevent them
  // from being included in selector matches
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip @tailwind directives (no-op in RN — defaults are already built in)
  css = css.replace(/@tailwind\s+[^;]+;/g, '');

  // Strip non-tailwind @import directives
  css = css.replace(/@import\s+[^;]+;/g, '');

  // Unwrap @layer blocks using a brace-balanced parser so deeply nested
  // structures like @layer theme { :root { ... } } are correctly extracted
  css = unwrapAtLayerBlocks(css);

  const blockRegex = /([^{]+)\{([^}]*)\}/g;
  let match;

  while ((match = blockRegex.exec(css)) !== null) {
    const selector = (match[1] || '').trim();
    const body = match[2] || '';

    let colorTarget = null;
    let rawTarget = null;

    if (selector === ':root') {
      colorTarget = result.light;
      rawTarget = result.rawVars.light;
    } else if (selector === '.dark') {
      colorTarget = result.dark;
      rawTarget = result.rawVars.dark;
    } else {
      continue;
    }

    // Parse ALL CSS custom properties: --name: value;
    const allPropRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
    let propMatch;
    while ((propMatch = allPropRegex.exec(body)) !== null) {
      const fullName = (propMatch[1] || '').trim();
      const value = (propMatch[2] || '').trim();

      if (!fullName || !value) continue;

      // Store in rawVars (ALL variables)
      rawTarget[fullName] = value;

      // Backward compat: also store --color-* with prefix stripped
      if (fullName.startsWith('color-')) {
        const colorName = fullName.slice(6);
        if (colorName) colorTarget[colorName] = value;
      }
    }
  }

  return result;
}

// =============================================================================
// Type Declaration Generator
// =============================================================================

/**
 * Regex for bare HSL values (shadcn/ui convention): "220 13% 91%"
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
function isColorLikeValue(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (BARE_HSL_RE.test(trimmed)) return true;
  if (HEX_COLOR_RE.test(trimmed)) return true;
  if (/^hsla?\s*\(/i.test(trimmed)) return true;
  if (/^rgba?\s*\(/i.test(trimmed)) return true;
  // Tailwind v4 / modern CSS color functions
  if (/^oklch\s*\(/i.test(trimmed)) return true;
  if (/^oklab\s*\(/i.test(trimmed)) return true;
  if (/^lab\s*\(/i.test(trimmed)) return true;
  if (/^lch\s*\(/i.test(trimmed)) return true;
  if (/^color\s*\(/i.test(trimmed)) return true;
  return false;
}

/**
 * Extract auto-detected color variable keys from raw CSS vars.
 * Returns an array of variable names whose values look like colors.
 */
function autoDetectColorKeys(rawVars) {
  if (!rawVars || typeof rawVars !== 'object') return [];
  const keys = [];
  for (const [key, value] of Object.entries(rawVars)) {
    if (key.startsWith('color-')) continue;
    if (
      key.startsWith('shadow-') ||
      key.startsWith('radius') ||
      key.startsWith('font-') ||
      key.startsWith('spacing-') ||
      key.startsWith('breakpoint-')
    )
      continue;
    if (isColorLikeValue(value)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Flatten nested color objects (Tailwind convention).
 * { primary: { DEFAULT: '...', foreground: '...' } }
 * → keys: ['primary', 'primary-foreground']
 */
function flattenColorKeys(colors) {
  const keys = [];
  if (!colors || typeof colors !== 'object') return keys;

  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      keys.push(key);
    } else if (value && typeof value === 'object') {
      for (const subKey of Object.keys(value)) {
        if (subKey === 'DEFAULT') {
          keys.push(key);
        } else {
          keys.push(`${key}-${subKey}`);
        }
      }
    }
  }
  return keys;
}

/**
 * Format an array of string keys into a TypeScript union type string.
 * e.g. ['a', 'b', 'c'] → "'a' | 'b' | 'c'"
 */
function toUnion(keys) {
  if (!keys.length) return 'string';
  const unique = [...new Set(keys)].sort();
  return unique.map((k) => `'${k}'`).join(' | ');
}

// =============================================================================
// Built-in default theme keys (must match src/config/defaults.ts)
// These are included in type declarations so users always get autocomplete
// for default keys even when they only use theme.extend.
// =============================================================================

/**
 * Try to load the Tailwind CSS color palette dynamically from the
 * installed tailwindcss package. Returns a flat map of color keys + values
 * and an array of all flattened keys.
 *
 * Works with both Tailwind v3 (`tailwindcss/colors`) and v4.
 * Returns empty results if tailwindcss is not installed.
 */
function loadTailwindPalette(projectRoot) {
  const SKIP = new Set([
    'inherit',
    'current',
    'transparent',
    'lightBlue',
    'warmGray',
    'trueGray',
    'coolGray',
    'blueGray',
  ]);
  try {
    const colorsPath = require.resolve('tailwindcss/colors', {
      paths: [projectRoot],
    });
    // Suppress deprecated color name warnings from Tailwind v3
    // (accessing renamed properties like lightBlue triggers console.warn via getters)
    const origWarn = console.warn;
    console.warn = () => {};
    try {
      const colors = require(colorsPath);
      const flat = {};
      const keys = [];
      for (const [name, value] of Object.entries(colors)) {
        if (SKIP.has(name)) continue;
        if (typeof value === 'string') {
          flat[name] = value;
          keys.push(name);
        } else if (value && typeof value === 'object') {
          for (const [shade, hex] of Object.entries(value)) {
            const key = `${name}-${shade}`;
            flat[key] = hex;
            keys.push(key);
          }
        }
      }
      return { flat, keys };
    } finally {
      console.warn = origWarn;
    }
  } catch {
    return { flat: {}, keys: [] };
  }
}

/**
 * Load the full Tailwind default theme (spacing, fontSize, fontWeight,
 * borderRadius, opacity, boxShadow) from `tailwindcss/defaultTheme`.
 * Converts rem/px string values to pixel numbers for React Native.
 *
 * Returns an object with RN-ready theme sections, or empty if tailwindcss
 * is not installed.
 */
function loadTailwindDefaults(projectRoot, inlineRem = 16) {
  try {
    const themePath = require.resolve('tailwindcss/defaultTheme', {
      paths: [projectRoot],
    });
    const origWarn = console.warn;
    console.warn = () => {};
    let dt;
    try {
      dt = require(themePath);
    } finally {
      console.warn = origWarn;
    }

    // Convert a CSS dimension string to a pixel number
    function toPx(val) {
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return NaN;
      const trimmed = val.trim();
      if (trimmed.endsWith('rem')) return parseFloat(trimmed) * inlineRem;
      if (trimmed.endsWith('px')) return parseFloat(trimmed);
      const n = parseFloat(trimmed);
      return isNaN(n) ? NaN : n;
    }

    // spacing: { '0': '0px', '1': '0.25rem', ... } → { '0': 0, '1': 4, ... }
    const spacing = {};
    if (dt.spacing) {
      for (const [k, v] of Object.entries(dt.spacing)) {
        const n = toPx(v);
        if (!isNaN(n)) spacing[k] = n;
      }
    }

    // fontSize: { 'sm': ['0.875rem', { lineHeight: '1.25rem' }], ... } → { 'sm': 14, ... }
    const fontSize = {};
    if (dt.fontSize) {
      for (const [k, v] of Object.entries(dt.fontSize)) {
        const raw = Array.isArray(v) ? v[0] : v;
        const n = toPx(raw);
        if (!isNaN(n) && n > 0) fontSize[k] = n;
      }
    }

    // fontWeight: { thin: '100', ... } → kept as-is (string values)
    const fontWeight = dt.fontWeight || {};

    // borderRadius: { 'sm': '0.125rem', ... } → { 'sm': 2, ... }
    const borderRadius = {};
    if (dt.borderRadius) {
      for (const [k, v] of Object.entries(dt.borderRadius)) {
        const n = toPx(v);
        if (!isNaN(n)) borderRadius[k] = n;
      }
    }

    // opacity: { '0': '0', '5': '0.05', ... } → { '0': 0, '5': 0.05, ... }
    const opacity = {};
    if (dt.opacity) {
      for (const [k, v] of Object.entries(dt.opacity)) {
        const n = parseFloat(v);
        if (!isNaN(n)) opacity[k] = n;
      }
    }

    // boxShadow: { sm: '...', DEFAULT: '...', ... } → kept as-is for shadow parsing
    const shadows = {};
    if (dt.boxShadow) {
      for (const [k, v] of Object.entries(dt.boxShadow)) {
        if (v && v !== 'none') shadows[k === 'DEFAULT' ? 'DEFAULT' : k] = v;
      }
    }

    // screens: { sm: '640px', ... } → { sm: 640, ... }
    const screens = {};
    if (dt.screens) {
      for (const [k, v] of Object.entries(dt.screens)) {
        if (typeof v === 'string') {
          const n = parseInt(v, 10);
          if (!isNaN(n)) screens[k] = n;
        }
      }
    }

    const sectionCount =
      Object.keys(spacing).length +
      Object.keys(fontSize).length +
      Object.keys(fontWeight).length +
      Object.keys(borderRadius).length +
      Object.keys(opacity).length +
      Object.keys(shadows).length;

    if (sectionCount > 0) {
      console.log(
        `[react-native-stylefn] ✓ Loaded Tailwind defaults from tailwindcss/defaultTheme ` +
          `(${Object.keys(spacing).length} spacing, ${
            Object.keys(fontSize).length
          } fontSize, ` +
          `${Object.keys(fontWeight).length} fontWeight, ${
            Object.keys(borderRadius).length
          } borderRadius, ` +
          `${Object.keys(opacity).length} opacity, ${
            Object.keys(shadows).length
          } shadows)`
      );
    }

    return {
      spacing,
      fontSize,
      fontWeight,
      borderRadius,
      opacity,
      shadows,
      screens,
    };
  } catch {
    return null;
  }
}

const DEFAULT_THEME_KEYS = {
  spacing: ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12'],
  fontSize: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'],
  borderRadius: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
  fontWeight: ['normal', 'medium', 'semibold', 'bold'],
  opacity: ['0', '25', '50', '75', '100'],
  screens: ['sm', 'md', 'lg', 'xl'],
  // Semantic defaults only — Tailwind palette loaded dynamically from tailwindcss/colors
  colors: ['primary', 'secondary', 'danger', 'success', 'warning'],
  shadows: ['sm', 'md', 'lg'],
};

/**
 * Generate stylefn.d.ts with ThemeKeyRegistry augmentation
 * based on the built-in defaults, user's config, and CSS variables.
 * Written into node_modules/react-native-stylefn/.
 *
 * Key merge strategy for type declarations:
 * All layers are MERGED so every possible key appears in the union type.
 * Priority order (lowest → highest, but all keys appear for autocomplete):
 *   1. defaults.ts keys (always present)
 *   2. Tailwind defaults (if @tailwind base in global.css)
 *   3. User's theme sections from rn-stylefn.config.js
 *   4. CSS variable keys from global.css
 *   5. theme.extend keys (additive)
 */
function generateTypeDeclarations(configFilePath, parsedCss, projectRoot) {
  try {
    // Load the user config
    let userConfig = {};
    if (configFilePath) {
      // Clear require cache so we get fresh config
      delete require.cache[require.resolve(configFilePath)];
      userConfig = require(configFilePath);
    }

    const theme = userConfig.theme || {};
    const extend = theme.extend || {};

    // Helper: merge keys from all layers for type declarations.
    // All keys from every layer appear in the union so autocomplete works.
    // Order: defaults → Tailwind → user config → extend
    function resolveKeys(sectionName, defaultKeys) {
      const userSection = theme[sectionName];
      const extendSection = extend[sectionName];

      // Always start with defaults (includes Tailwind defaults if opted in)
      let allKeys = [...defaultKeys];

      // Merge user's top-level config keys on top
      if (userSection) {
        allKeys.push(...Object.keys(userSection));
      }

      // Merge extend keys on top
      if (extendSection) {
        allKeys.push(...Object.keys(extendSection));
      }

      return allKeys;
    }

    // Only enrich with Tailwind defaults when the user opted in via @tailwind
    // directives in their CSS. parsedCss.tailwindDefaults is only set when
    // @tailwind base/utilities or @import "tailwindcss" is present.
    const twDefaults = parsedCss.tailwindDefaults || null;

    // Merge default keys with Tailwind defaults (only when opted in)
    function enrichedDefaults(section) {
      const base = [...DEFAULT_THEME_KEYS[section]];
      if (twDefaults && twDefaults[section]) {
        base.push(...Object.keys(twDefaults[section]));
      }
      return base;
    }

    // Extract keys from each theme section (defaults + TW defaults + user overrides + extend)
    const spacingKeys = resolveKeys('spacing', enrichedDefaults('spacing'));
    const fontSizeKeys = resolveKeys('fontSize', enrichedDefaults('fontSize'));
    const borderRadiusKeys = resolveKeys(
      'borderRadius',
      enrichedDefaults('borderRadius')
    );
    const fontWeightKeys = resolveKeys(
      'fontWeight',
      enrichedDefaults('fontWeight')
    );
    const opacityKeys = resolveKeys('opacity', enrichedDefaults('opacity'));
    const screenKeys = resolveKeys('screens', enrichedDefaults('screens'));

    // Shadow keys: merge all layers (defaults → Tailwind → user → extend)
    const twShadowKeys = twDefaults?.shadows
      ? Object.keys(twDefaults.shadows)
      : [];
    const userShadowKeys =
      theme.shadows || theme.boxShadow
        ? Object.keys({ ...theme.shadows, ...theme.boxShadow })
        : [];
    const extendShadowKeys = Object.keys({
      ...extend.shadows,
      ...extend.boxShadow,
    });
    const shadowKeys = [
      ...DEFAULT_THEME_KEYS.shadows,
      ...twShadowKeys,
      ...userShadowKeys,
      ...extendShadowKeys,
    ];

    // -----------------------------------------------------------------------
    // Auto-extract well-known CSS variable prefixes from rawVars (for types).
    // Same logic as src/tokens/index.ts — any CSS source with standard
    // prefixes (--text-*, --radius-*, --shadow-*, --font-weight-*) gets
    // their keys added to the respective type sections.
    // -----------------------------------------------------------------------
    const lightRaw = parsedCss.rawVars?.light || {};
    const darkRaw = parsedCss.rawVars?.dark || {};
    const allRawKeys = [
      ...new Set([...Object.keys(lightRaw), ...Object.keys(darkRaw)]),
    ];

    for (const key of allRawKeys) {
      if (key === 'spacing' || key.startsWith('spacing-')) {
        spacingKeys.push(key === 'spacing' ? 'DEFAULT' : key.slice(8));
      } else if (key.startsWith('text-') && !key.includes('--')) {
        fontSizeKeys.push(key.slice(5));
      } else if (key === 'radius' || key.startsWith('radius-')) {
        borderRadiusKeys.push(key === 'radius' ? 'DEFAULT' : key.slice(7));
      } else if (
        (key === 'shadow' || key.startsWith('shadow-')) &&
        !key.startsWith('drop-shadow-')
      ) {
        shadowKeys.push(key === 'shadow' ? 'DEFAULT' : key.slice(7));
      } else if (key.startsWith('font-weight-')) {
        fontWeightKeys.push(key.slice(12));
      }
    }

    // Color keys:
    // • Include built-in semantic defaults (primary, secondary, etc.)
    // • Merge user's theme.colors on top (flattened nested objects).
    // • Include CSS --color-* vars and auto-detected color-like variables.
    // • For the full Tailwind palette, users install tailwindcss and add
    //   @import "tailwindcss" — the --color-* vars are auto-extracted.
    // • Merge extend.colors last.
    const userColorKeys = theme.colors ? flattenColorKeys(theme.colors) : [];
    const extendColorKeys = extend.colors
      ? flattenColorKeys(extend.colors)
      : [];

    // CSS --color-* vars only (parsedCss.light already has the prefix stripped)
    const cssColorKeys = [
      ...Object.keys(parsedCss.light || {}),
      ...Object.keys(parsedCss.dark || {}),
    ];

    // Auto-detected color-like raw CSS variables (bare HSL, hex, etc.)
    // e.g. --input: 220 13% 91% → auto-detected as color → key "input"
    const autoDetectedKeys = [
      ...autoDetectColorKeys(parsedCss.rawVars?.light || {}),
      ...autoDetectColorKeys(parsedCss.rawVars?.dark || {}),
    ];

    // Dynamically load Tailwind palette keys only when opted in via CSS directives
    const twPalette = twDefaults
      ? loadTailwindPalette(projectRoot)
      : { flat: {}, keys: [] };

    const allColorKeys = [
      // Tailwind palette (only when @tailwind directives are in global.css)
      ...twPalette.keys,
      // Semantic defaults (built-in)
      'primary',
      'secondary',
      'danger',
      'success',
      'warning',
      // Auto-detected color vars from raw CSS (bare HSL, hex, etc.)
      ...autoDetectedKeys,
      // User's theme.colors (nested objects flattened, overrides palette keys)
      ...userColorKeys,
      // CSS --color-* variables
      ...cssColorKeys,
      // User's theme.extend.colors (additive)
      ...extendColorKeys,
    ];

    // Generate the declaration file
    // IMPORTANT: `export {}` makes this a module file, so `declare module`
    // becomes an augmentation (merges with real module) instead of a
    // full module declaration (which would replace it entirely).
    const dts = [
      '// Auto-generated by react-native-stylefn — do not edit',
      '// This file provides TypeScript autocomplete for your theme keys.',
      '// Re-generated every time Metro starts (via withStyleFn in metro.config.js).',
      '',
      'export {};',
      '',
      "declare module 'react-native-stylefn' {",
      '  interface ThemeKeyOverrides {',
    ];

    if (spacingKeys.length) {
      dts.push(`    spacing: ${toUnion(spacingKeys)};`);
    }
    if (fontSizeKeys.length) {
      dts.push(`    fontSize: ${toUnion(fontSizeKeys)};`);
    }
    if (borderRadiusKeys.length) {
      dts.push(`    borderRadius: ${toUnion(borderRadiusKeys)};`);
    }
    if (fontWeightKeys.length) {
      dts.push(`    fontWeight: ${toUnion(fontWeightKeys)};`);
    }
    if (opacityKeys.length) {
      dts.push(`    opacity: ${toUnion(opacityKeys)};`);
    }
    if (shadowKeys.length) {
      dts.push(`    shadow: ${toUnion(shadowKeys)};`);
    }
    if (allColorKeys.length) {
      dts.push(`    color: ${toUnion(allColorKeys)};`);
    }
    if (screenKeys.length) {
      dts.push(`    breakpoint: ${toUnion(screenKeys)};`);
    }

    dts.push('  }');
    dts.push('}');
    dts.push('');

    // -------------------------------------------------------------------------
    // Augment React Native's StyleSheet so that StyleSheet.create accepts
    // style functions and `t` is inferred as `StyleTokens`.
    //
    // We provide MULTIPLE augmentation strategies to cover all RN versions:
    // 1. StyleSheetStatic interface (classic RN < 0.76)
    // 2. StyleSheet namespace with a standalone create function (RN 0.76+)
    // 3. Direct re-export augmentation for generated types (RN 0.83+)
    //
    // TypeScript will merge compatible augmentations and ignore non-matching
    // ones, so it's safe to include all of them.
    // -------------------------------------------------------------------------
    const styleFnValueType = [
      "    | import('react-native').ViewStyle",
      "    | import('react-native').TextStyle",
      "    | import('react-native').ImageStyle",
      "    | ((tokens: import('react-native-stylefn').StyleTokens) =>",
      "        import('react-native-stylefn').LooseStyle<",
      "          import('react-native').ViewStyle |",
      "          import('react-native').TextStyle |",
      "          import('react-native').ImageStyle",
      '        > | false | null | undefined)',
    ].join('\n');

    dts.push("declare module 'react-native' {");
    // Strategy 1: Classic StyleSheetStatic (RN < 0.76)
    dts.push('  interface StyleSheetStatic {');
    dts.push('    create<T extends {');
    dts.push('      [key: string]:');
    dts.push(styleFnValueType + ';');
    dts.push('    }>(styles: T): T;');
    dts.push('  }');
    dts.push('');
    // Strategy 2: Namespace augmentation (RN 0.76+ where StyleSheet is a namespace)
    dts.push('  namespace StyleSheet {');
    dts.push('    function create<T extends {');
    dts.push('      [key: string]:');
    dts.push(styleFnValueType + ';');
    dts.push('    }>(styles: T): T;');
    dts.push('  }');
    dts.push('}');
    dts.push('');

    // Write stylefn.d.ts to BOTH:
    // 1. node_modules/react-native-stylefn/stylefn.d.ts — so that
    //    `/// <reference types="./node_modules/react-native-stylefn/stylefn" />`
    //    in stylefn-env.d.ts resolves correctly even when the package is a link:..
    // 2. <projectRoot>/stylefn.d.ts — picked up by TypeScript via include: ["**/*.ts"]
    //    and as a last-resort fallback when no reference directive is present.
    const absoluteProjectRoot = path.resolve(projectRoot);

    let libDir;
    try {
      const pkgPath = require.resolve('react-native-stylefn/package.json', {
        paths: [absoluteProjectRoot],
      });
      libDir = path.dirname(pkgPath);
    } catch {
      // Fallback: create node_modules/react-native-stylefn/ if it doesn't exist
      libDir = path.resolve(
        absoluteProjectRoot,
        'node_modules',
        'react-native-stylefn'
      );
    }

    // Always create libDir (harmless if it already exists) and write there
    fs.mkdirSync(libDir, { recursive: true });
    const libDtsPath = path.join(libDir, 'stylefn.d.ts');
    fs.writeFileSync(libDtsPath, dts.join('\n'));

    // Always also write to project root so TypeScript picks it up via include glob
    const rootDtsPath = path.join(absoluteProjectRoot, 'stylefn.d.ts');
    fs.writeFileSync(rootDtsPath, dts.join('\n'));

    console.log(
      `[react-native-stylefn] ✓ Generated type declarations → stylefn.d.ts`
    );
  } catch (err) {
    console.warn(
      '[react-native-stylefn] Could not generate type declarations:',
      err.message
    );
  }
}

/**
 * Wraps a Metro config to:
 * 1. Read and parse the given CSS file
 * 2. Generate a virtual module `react-native-stylefn/css-vars` with the parsed vars
 * 3. Add a resolver so Metro can find it
 *
 * @param {object} config - Base Metro config
 * @param {object} options
 * @param {string} [options.input='./global.css'] - Path to your CSS file (relative to project root)
 * @param {string} [options.config='./rn-stylefn.config.js'] - Path to your config file (relative to project root)
 * @param {number} [options.inlineRem=16] - Base pixel value for rem→px conversion (e.g. 16 means 1rem = 16px)
 * @returns {object} Updated Metro config
 */
function withStyleFn(config, options = {}) {
  const projectRoot = config.projectRoot || process.cwd();
  const cssInput = options.input || './global.css';
  const cssPath = path.resolve(projectRoot, cssInput);
  const inlineRem =
    typeof options.inlineRem === 'number' ? options.inlineRem : 16;

  // Locate the user's config file (rn-stylefn.config.js)
  const configInput = options.config || './rn-stylefn.config.js';
  const configPath = path.resolve(projectRoot, configInput);
  let configFilePath = null;

  if (fs.existsSync(configPath)) {
    configFilePath = configPath;
    console.log(
      `[react-native-stylefn] ✓ Found config at ${path.relative(
        projectRoot,
        configPath
      )}`
    );
  }

  // Parse the CSS file
  let parsedCss = { light: {}, dark: {}, rawVars: { light: {}, dark: {} } };
  // Track which @tailwind directives the user opted into (CSS = opt-in signal)
  let hasTailwindBase = false;
  let hasTailwindUtilities = false;
  let hasTailwindImport = false;

  if (fs.existsSync(cssPath)) {
    try {
      // Read the raw CSS first
      let cssContent = fs.readFileSync(cssPath, 'utf8');

      // Strip comments before detecting directives, so documentation
      // comments like `*   @import "tailwindcss"` don't trigger loading.
      const cssWithoutComments = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

      // Detect @tailwind directives BEFORE stripping them from CSS.
      // These act as opt-in signals: if present, we load the corresponding
      // Tailwind defaults from the installed tailwindcss package.
      hasTailwindBase = /@tailwind\s+base\s*;/m.test(cssWithoutComments);
      hasTailwindUtilities = /@tailwind\s+utilities\s*;/m.test(
        cssWithoutComments
      );
      hasTailwindImport = /@import\s+['"]tailwindcss['"]/m.test(
        cssWithoutComments
      );

      // If the CSS contains @import "tailwindcss" (Tailwind v4 CSS-first),
      // process it through the Tailwind CLI so all generated --color-*
      // variables are available.
      cssContent = expandTailwindImports(cssContent, cssPath, projectRoot);

      parsedCss = parseCSSVariables(cssContent);

      // Load Tailwind color palette ONLY when the user opted in via
      // @tailwind base, @tailwind utilities, or @import "tailwindcss"
      if (hasTailwindBase || hasTailwindUtilities || hasTailwindImport) {
        const twPalette = loadTailwindPalette(projectRoot);
        if (twPalette.keys.length > 0) {
          // Inject as lowest priority — don't overwrite existing CSS-defined colors
          const injected = { ...twPalette.flat, ...parsedCss.light };
          parsedCss.light = injected;
          // Also inject the --color-* prefixed versions into rawVars for expression resolution
          for (const [key, val] of Object.entries(twPalette.flat)) {
            if (!parsedCss.rawVars.light[`color-${key}`]) {
              parsedCss.rawVars.light[`color-${key}`] = val;
            }
          }
          console.log(
            `[react-native-stylefn] ✓ Loaded ${twPalette.keys.length} Tailwind palette colors from tailwindcss/colors`
          );
        }
      }

      const lightColorCount = Object.keys(parsedCss.light).length;
      const lightRawCount = Object.keys(parsedCss.rawVars.light).length;
      const darkRawCount = Object.keys(parsedCss.rawVars.dark).length;
      console.log(
        `[react-native-stylefn] ✓ Loaded CSS variables from ${path.relative(
          projectRoot,
          cssPath
        )}` +
          ` (${lightRawCount} light vars, ${darkRawCount} dark vars` +
          (lightColorCount > 0 ? `, ${lightColorCount} color vars` : '') +
          ')'
      );
    } catch (err) {
      console.warn('[react-native-stylefn] Failed to parse CSS:', err.message);
    }
  } else {
    console.warn('[react-native-stylefn] CSS file not found:', cssPath);
  }

  // Write the generated virtual module into the library's node_modules directory
  // so it doesn't pollute the user's project root.
  let libDir;
  try {
    const pkgPath = require.resolve('react-native-stylefn/package.json', {
      paths: [projectRoot],
    });
    libDir = path.dirname(pkgPath);
  } catch {
    // Fallback: node_modules/react-native-stylefn/
    libDir = path.resolve(projectRoot, 'node_modules', 'react-native-stylefn');
  }
  fs.mkdirSync(libDir, { recursive: true });

  // Inline-convert rem values in raw CSS variable strings to px numbers.
  // e.g. "0.625rem" → "10" when inlineRem=16, so downstream calc() works correctly.
  function inlineRemValues(vars) {
    const result = {};
    for (const [key, value] of Object.entries(vars)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/(\d+\.?\d*)rem/g, (_, num) =>
          String(parseFloat(num) * inlineRem)
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  if (parsedCss.rawVars) {
    parsedCss.rawVars.light = inlineRemValues(parsedCss.rawVars.light);
    parsedCss.rawVars.dark = inlineRemValues(parsedCss.rawVars.dark);
  }
  parsedCss.light = inlineRemValues(parsedCss.light);
  parsedCss.dark = inlineRemValues(parsedCss.dark);

  // Load full Tailwind defaults ONLY when the user opted in via @tailwind
  // directives in global.css. The CSS file is the opt-in signal.
  //   @tailwind base;       → load spacing, fontSize, fontWeight, borderRadius,
  //                            opacity, shadows, colors from tailwindcss
  //   @tailwind utilities;  → also triggers loading (utilities depend on theme)
  //   @import "tailwindcss" → Tailwind v4 (loads everything)
  if (hasTailwindBase || hasTailwindUtilities || hasTailwindImport) {
    const twDefaults = loadTailwindDefaults(projectRoot, inlineRem);
    if (twDefaults) {
      parsedCss.tailwindDefaults = twDefaults;
    }
  }

  // Attach the inlineRem value so the runtime can use it for calc()/rem() support
  parsedCss.inlineRem = inlineRem;

  const cssVarsFile = path.join(libDir, 'css-vars.js');
  fs.writeFileSync(
    cssVarsFile,
    `// Auto-generated by react-native-stylefn — do not edit\nmodule.exports = ${JSON.stringify(
      parsedCss,
      null,
      2
    )};\n`
  );

  console.log(
    `[react-native-stylefn] ✓ inlineRem = ${inlineRem}px (1rem = ${inlineRem}px)`
  );

  // =========================================================================
  // Generate TypeScript type declarations (stylefn.d.ts in project root)
  // Reads the user's config + CSS vars to produce ThemeKeyOverrides augmentation
  // =========================================================================
  generateTypeDeclarations(configFilePath, parsedCss, projectRoot);

  // Add generated files to .gitignore if not already there
  const gitignorePath = path.resolve(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const additions = [];
    if (!gitignore.includes('stylefn.d.ts')) additions.push('stylefn.d.ts');
    if (additions.length) {
      fs.appendFileSync(
        gitignorePath,
        '\n# react-native-stylefn generated\n' + additions.join('\n') + '\n'
      );
    }
  }

  // Wrap the resolver to map virtual modules → generated/actual files
  const existingResolver = config.resolver?.resolveRequest;

  return {
    ...config,
    resolver: {
      ...config.resolver,
      resolveRequest: (context, moduleName, platform) => {
        // Resolve react-native-stylefn/css-vars → generated css-vars.js
        if (moduleName === 'react-native-stylefn/css-vars') {
          return {
            filePath: cssVarsFile,
            type: 'sourceFile',
          };
        }
        // Resolve rn-stylefn.config → user's config file in project root
        if (moduleName === 'rn-stylefn.config' && configFilePath) {
          return {
            filePath: configFilePath,
            type: 'sourceFile',
          };
        }
        if (existingResolver) {
          return existingResolver(context, moduleName, platform);
        }
        return context.resolveRequest(context, moduleName, platform);
      },
    },
  };
}

module.exports = { withStyleFn };
