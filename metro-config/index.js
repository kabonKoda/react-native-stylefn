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
const DEFAULT_THEME_KEYS = {
  spacing: ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12'],
  fontSize: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'],
  borderRadius: ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'],
  fontWeight: ['normal', 'medium', 'semibold', 'bold'],
  opacity: ['0', '25', '50', '75', '100'],
  screens: ['sm', 'md', 'lg', 'xl'],
  colors: ['primary', 'secondary', 'danger', 'success', 'warning'],
  shadows: ['sm', 'md', 'lg'],
};

/**
 * Generate stylefn.d.ts with ThemeKeyRegistry augmentation
 * based on the built-in defaults, user's config, and CSS variables.
 * Written into node_modules/react-native-stylefn/.
 *
 * Key merge strategy (matches runtime resolveTheme behavior):
 * - If user provides a top-level theme section (e.g. theme.spacing),
 *   it REPLACES defaults for that section (only user keys are used).
 * - If user only uses theme.extend, defaults are preserved and
 *   extended keys are added on top.
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

    // Helper: resolve keys for a section with Tailwind-like merge semantics.
    // If the user provides a top-level section, it REPLACES defaults.
    // Extend always adds on top (of either defaults or the user's override).
    function resolveKeys(sectionName, defaultKeys) {
      const userSection = theme[sectionName];
      const extendSection = extend[sectionName];

      // Start with defaults, unless user provided a top-level override (which replaces)
      let baseKeys = userSection ? Object.keys(userSection) : [...defaultKeys];

      // Merge extend keys on top
      if (extendSection) {
        baseKeys = [...baseKeys, ...Object.keys(extendSection)];
      }

      return baseKeys;
    }

    // Extract keys from each theme section (defaults + user overrides + extend)
    const spacingKeys = resolveKeys('spacing', DEFAULT_THEME_KEYS.spacing);
    const fontSizeKeys = resolveKeys('fontSize', DEFAULT_THEME_KEYS.fontSize);
    const borderRadiusKeys = resolveKeys(
      'borderRadius',
      DEFAULT_THEME_KEYS.borderRadius
    );
    const fontWeightKeys = resolveKeys(
      'fontWeight',
      DEFAULT_THEME_KEYS.fontWeight
    );
    const opacityKeys = resolveKeys('opacity', DEFAULT_THEME_KEYS.opacity);
    const screenKeys = resolveKeys('screens', DEFAULT_THEME_KEYS.screens);

    // Shadow keys: from both shadows and boxShadow (merge all sources)
    const userShadowKeys =
      theme.shadows || theme.boxShadow
        ? Object.keys({ ...theme.shadows, ...theme.boxShadow })
        : [...DEFAULT_THEME_KEYS.shadows];
    const extendShadowKeys = Object.keys({
      ...extend.shadows,
      ...extend.boxShadow,
    });
    const shadowKeys = [...userShadowKeys, ...extendShadowKeys];

    // Color keys: flatten nested objects from config
    // If user provides top-level colors, it replaces defaults; extend adds on top
    const userColorKeys = theme.colors
      ? flattenColorKeys(theme.colors)
      : [...DEFAULT_THEME_KEYS.colors];
    const extendColorKeys = extend.colors
      ? flattenColorKeys(extend.colors)
      : [];
    const configColorKeys = [...userColorKeys, ...extendColorKeys];

    // CSS variable color keys:
    // 1. --color-* prefixed vars (backward compat, with prefix stripped)
    // 2. ALL rawVars keys — covers shadcn/ui style vars like --primary, --destructive, etc.
    const cssColorKeysFromColorPrefix = [
      ...Object.keys(parsedCss.light || {}),
      ...Object.keys(parsedCss.dark || {}),
    ];
    const cssColorKeysFromRawVars = [
      ...Object.keys((parsedCss.rawVars && parsedCss.rawVars.light) || {}),
      ...Object.keys((parsedCss.rawVars && parsedCss.rawVars.dark) || {}),
    ];
    const cssColorKeys = [
      ...cssColorKeysFromColorPrefix,
      ...cssColorKeysFromRawVars,
    ];

    // Merge all color keys
    const allColorKeys = [...configColorKeys, ...cssColorKeys];

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
    // Augment StyleSheet.create so that style functions receive StyleTokens
    // instead of `any`. This makes `StyleSheet.create({ key: (t) => ({}) })`
    // fully typed — `t` is inferred as `StyleTokens` automatically.
    // -------------------------------------------------------------------------
    dts.push("declare module 'react-native' {");
    dts.push('  namespace StyleSheet {');
    dts.push('    function create<T extends {');
    dts.push('      [key: string]:');
    dts.push("        | import('react-native').ViewStyle");
    dts.push("        | import('react-native').TextStyle");
    dts.push("        | import('react-native').ImageStyle");
    dts.push(
      "        | ((tokens: import('react-native-stylefn').StyleTokens) =>"
    );
    dts.push("            import('react-native-stylefn').LooseStyle<");
    dts.push("              import('react-native').ViewStyle |");
    dts.push("              import('react-native').TextStyle |");
    dts.push("              import('react-native').ImageStyle");
    dts.push('            > | false | null | undefined);');
    dts.push('    }>(styles: T): T;');
    dts.push('  }');
    dts.push('}');
    dts.push('');

    // Write stylefn.d.ts into the library's installed location
    // so users can reference it as: /// <reference types="react-native-stylefn/stylefn" />
    let libDir;
    try {
      const pkgPath = require.resolve('react-native-stylefn/package.json', {
        paths: [projectRoot],
      });
      libDir = path.dirname(pkgPath);
    } catch {
      // Fallback: node_modules/react-native-stylefn/
      libDir = path.resolve(
        projectRoot,
        'node_modules',
        'react-native-stylefn'
      );
    }

    if (fs.existsSync(libDir)) {
      const dtsPath = path.join(libDir, 'stylefn.d.ts');
      fs.writeFileSync(dtsPath, dts.join('\n'));
      console.log(
        `[react-native-stylefn] ✓ Generated type declarations at ${path.relative(
          projectRoot,
          dtsPath
        )}`
      );
    } else {
      // Last resort: write to project root
      const dtsPath = path.join(projectRoot, 'stylefn.d.ts');
      fs.writeFileSync(dtsPath, dts.join('\n'));
      console.log(
        `[react-native-stylefn] ✓ Generated type declarations at stylefn.d.ts`
      );
    }
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
  if (fs.existsSync(cssPath)) {
    try {
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      parsedCss = parseCSSVariables(cssContent);

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
