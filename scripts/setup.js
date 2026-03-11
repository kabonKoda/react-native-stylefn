#!/usr/bin/env node

/**
 * react-native-stylefn setup script
 *
 * Patches React Native's StyleProp<T> type definition to accept style functions.
 * This runs automatically as a postinstall hook.
 *
 * What it patches:
 *   StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>>
 * becomes:
 *   StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>>
 *                | ((tokens: import('react-native-stylefn').StyleTokens) => T | false | null | undefined)
 *
 * Since EVERY style prop in React Native is typed as StyleProp<...>, this
 * single patch makes style functions work on ALL components — built-in,
 * third-party, and custom — with zero manual configuration.
 */

const fs = require('fs');
const path = require('path');

const MARKER = '/* react-native-stylefn patched */';
const STYLE_FN_TYPE = `((tokens: import('react-native-stylefn').StyleTokens) => import('react-native-stylefn').LooseStyle<T> | false | null | undefined)`;

/**
 * Find react-native's node_modules directory from the current working directory.
 */
function findRNTypesDir() {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules/react-native'),
    path.resolve(__dirname, '../../react-native'),
    path.resolve(__dirname, '../../../react-native'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Patches a file's StyleProp type to include style functions.
 */
function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes(MARKER)) return false; // Already patched

    // RN 0.83+ generated types
    const generatedPattern =
      /export type StyleProp<T>\s*=\s*null\s*\|\s*void\s*\|\s*T\s*\|\s*false\s*\|\s*""\s*\|\s*ReadonlyArray<StyleProp<T>>;/;

    // Classic types (older RN, single-line)
    const classicPattern =
      /export type StyleProp<T>\s*=\s*T\s*\|\s*RecursiveArray<T\s*\|\s*Falsy>\s*\|\s*Falsy;/;

    // RN 0.76+ multi-line format with RegisteredStyle
    const multiLinePattern =
      /export type StyleProp<T>\s*=\s*\|\s*T\s*\|\s*RegisteredStyle<T>\s*\|\s*RecursiveArray<T\s*\|\s*RegisteredStyle<T>\s*\|\s*Falsy>\s*\|\s*Falsy;/;

    let patched = content;

    if (generatedPattern.test(content)) {
      patched = content.replace(
        generatedPattern,
        `${MARKER}\nexport type StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>> | ${STYLE_FN_TYPE};`
      );
    } else if (multiLinePattern.test(content)) {
      patched = content.replace(
        multiLinePattern,
        `${MARKER}\nexport type StyleProp<T> =\n  | T\n  | RegisteredStyle<T>\n  | RecursiveArray<T | RegisteredStyle<T> | Falsy | ${STYLE_FN_TYPE}>\n  | Falsy\n  | ${STYLE_FN_TYPE};`
      );
    } else if (classicPattern.test(content)) {
      patched = content.replace(
        classicPattern,
        `${MARKER}\nexport type StyleProp<T> = T | RecursiveArray<T | Falsy | ${STYLE_FN_TYPE}> | Falsy | ${STYLE_FN_TYPE};`
      );
    } else {
      return false;
    }

    fs.writeFileSync(filePath, patched, 'utf8');
    console.log(
      `[react-native-stylefn] ✓ Patched StyleProp in ${path.relative(
        process.cwd(),
        filePath
      )}`
    );
    return true;
  } catch (err) {
    console.warn(
      `[react-native-stylefn] Could not patch ${filePath}: ${err.message}`
    );
    return false;
  }
}

/**
 * Creates a virtual react-native-stylefn package inside
 * node_modules/react-native/node_modules/ so that import('react-native-stylefn')
 * always resolves from patched type files, regardless of monorepo layout.
 */
function ensureTypeStub(rnDir) {
  const stubDir = path.join(rnDir, 'node_modules', 'react-native-stylefn');
  const stubIndex = path.join(stubDir, 'index.d.ts');
  if (fs.existsSync(stubIndex)) return;

  // Try to find the real StyleTokens type definition
  let typesSource = null;
  const candidates = [
    // Sibling package (standard install or workspace link)
    path.resolve(
      rnDir,
      '../react-native-stylefn/lib/typescript/src/types.d.ts'
    ),
    // Two levels up (hoisted monorepo)
    path.resolve(
      rnDir,
      '../../react-native-stylefn/lib/typescript/src/types.d.ts'
    ),
    // Source (development)
    path.resolve(rnDir, '../react-native-stylefn/src/types.ts'),
    path.resolve(rnDir, '../../react-native-stylefn/src/types.ts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      typesSource = c;
      break;
    }
  }

  fs.mkdirSync(stubDir, { recursive: true });

  if (typesSource) {
    const relPath = path
      .relative(stubDir, typesSource)
      .replace(/\.d\.ts$|\.ts$/, '');
    const relImport = relPath.startsWith('.') ? relPath : './' + relPath;
    fs.writeFileSync(
      stubIndex,
      `export { StyleTokens, StyleFnDimension, LooseStyle } from '${relImport}';\n`,
      'utf8'
    );
  } else {
    // Fallback: define minimal types inline
    fs.writeFileSync(
      stubIndex,
      [
        `export interface StyleTokens {`,
        `  theme: { spacing: Record<string, number>; fontSize: Record<string, number>; borderRadius: Record<string, number>; fontWeight: Record<string, string>; colors: Record<string, string>; shadows: Record<string, object>; opacity: Record<string, number>; };`,
        `  colors: Record<string, string>;`,
        `  dark: boolean;`,
        `  colorScheme: 'light' | 'dark';`,
        `  breakpoint: 'sm' | 'md' | 'lg' | 'xl';`,
        `  screen: { width: number; height: number; scale: number; fontScale: number; };`,
        `  orientation: 'portrait' | 'landscape';`,
        `  platform: 'ios' | 'android' | 'web';`,
        `  insets: { top: number; bottom: number; left: number; right: number; };`,
        `  reducedMotion: boolean;`,
        `  fontScale: number;`,
        `  boldText: boolean;`,
        `  highContrast: boolean;`,
        `}`,
        `export type StyleFnDimension = \`\${number}/\${number}\` | \`\${number}vw\` | \`\${number}vh\` | \`\${number}rem\`;`,
        `export type LooseStyle<S> = S extends any ? { [K in keyof S]?: S[K] | StyleFnDimension } : never;`,
      ].join('\n') + '\n',
      'utf8'
    );
  }

  fs.writeFileSync(
    path.join(stubDir, 'package.json'),
    JSON.stringify(
      { name: 'react-native-stylefn', types: 'index.d.ts' },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

/**
 * Patches the user's tsconfig.json to add jsxImportSource for automatic
 * prop function support on ALL component props.
 *
 * This makes `(tokens) => value` work in any JSX prop without needing
 * PropFunction<T> annotations in component type definitions.
 */
function patchTsConfig() {
  const TSC_MARKER = 'react-native-stylefn';

  // Walk up from CWD to find the project root tsconfig.json
  const candidates = [path.resolve(process.cwd(), 'tsconfig.json')];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');

      // Already configured
      if (raw.includes('"jsxImportSource"') && raw.includes(TSC_MARKER)) {
        return false;
      }

      // Try to parse as JSON
      let config;
      try {
        config = JSON.parse(raw);
      } catch (_) {
        // tsconfig might have comments — can't safely auto-patch
        console.log(
          `[react-native-stylefn] ℹ️  Add this to your tsconfig.json compilerOptions for automatic prop functions:\n` +
            `    "jsx": "react-jsx",\n` +
            `    "jsxImportSource": "react-native-stylefn"`
        );
        return false;
      }

      if (!config.compilerOptions) {
        config.compilerOptions = {};
      }

      let changed = false;

      // Set jsx to react-jsx if not already set (required for jsxImportSource)
      const currentJsx = config.compilerOptions.jsx;
      if (
        !currentJsx ||
        currentJsx === 'react-native' ||
        currentJsx === 'preserve'
      ) {
        config.compilerOptions.jsx = 'react-jsx';
        changed = true;
      }

      // Add jsxImportSource
      if (config.compilerOptions.jsxImportSource !== TSC_MARKER) {
        config.compilerOptions.jsxImportSource = TSC_MARKER;
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(
          filePath,
          JSON.stringify(config, null, 2) + '\n',
          'utf8'
        );
        console.log(
          `[react-native-stylefn] ✓ Patched ${path.relative(
            process.cwd(),
            filePath
          )} — all props now accept token functions automatically.`
        );
        return true;
      }
    } catch (err) {
      console.warn(
        `[react-native-stylefn] Could not patch tsconfig: ${err.message}`
      );
    }
  }

  return false;
}

function setup() {
  const rnDir = findRNTypesDir();

  if (!rnDir) {
    console.log(
      '[react-native-stylefn] react-native not found, skipping type patching.'
    );
    return;
  }

  // Create the type stub for reliable import resolution
  try {
    ensureTypeStub(rnDir);
  } catch (_) {
    /* silent */
  }

  const filesToPatch = [
    path.join(
      rnDir,
      'types_generated/Libraries/StyleSheet/StyleSheetTypes.d.ts'
    ),
    path.join(rnDir, 'Libraries/StyleSheet/StyleSheet.d.ts'),
  ];

  let patchedAny = false;
  for (const f of filesToPatch) {
    if (patchFile(f)) patchedAny = true;
  }

  // Also patch StyleSheet.create in StyleSheet.d.ts so it accepts style functions
  // and returns a mapped type that normalises function values to a universal style
  // function type compatible with StyleProp<ViewStyle/TextStyle/ImageStyle>.
  const stylesheetFile = path.join(
    rnDir,
    'Libraries/StyleSheet/StyleSheet.d.ts'
  );
  if (fs.existsSync(stylesheetFile)) {
    try {
      let content = fs.readFileSync(stylesheetFile, 'utf8');
      const STYLESHEET_MARKER = '/* react-native-stylefn stylesheet patched */';
      if (!content.includes(STYLESHEET_MARKER)) {
        let changed = false;

        // 1. Patch NamedStyles to accept style functions as values
        const namedStylesPattern =
          /type NamedStyles<T>\s*=\s*\{[^}]*\[P in keyof T\]\s*:\s*ViewStyle\s*\|\s*TextStyle\s*\|\s*ImageStyle\s*\};/;
        if (namedStylesPattern.test(content)) {
          const fnType = `((tokens: import('react-native-stylefn').StyleTokens) => (ViewStyle | TextStyle | ImageStyle) | false | null | undefined)`;
          content = content.replace(
            namedStylesPattern,
            `${STYLESHEET_MARKER}\n  type NamedStyles<T> = {[P in keyof T]: ViewStyle | TextStyle | ImageStyle | ${fnType}};\n` +
              `  type _StyleFnReturn<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? ((tokens: import('react-native-stylefn').StyleTokens) => (ViewStyle & TextStyle & ImageStyle) | false | null | undefined) : T[K] };`
          );
          changed = true;
        }

        // 2. Patch create return type from T to _StyleFnReturn<T>
        //    Match specifically the create function's return (preceded by NamedStyles<any>)
        const createReturnPattern =
          /(styles:\s*T\s*&\s*NamedStyles<any>,\s*\)):\s*T\s*;/;
        if (changed && createReturnPattern.test(content)) {
          content = content.replace(
            createReturnPattern,
            `$1: _StyleFnReturn<T>;`
          );
        }

        if (changed) {
          fs.writeFileSync(stylesheetFile, content, 'utf8');
          patchedAny = true;
          console.log(
            `[react-native-stylefn] ✓ Patched StyleSheet.create in ${path.relative(
              process.cwd(),
              stylesheetFile
            )}`
          );
        }
      }
    } catch (_) {
      /* silent */
    }
  }

  // Patch the GENERATED StyleSheetExports.d.ts — this is the actual create()
  // function TypeScript resolves for modern RN (0.76+).
  const exportsFile = path.join(
    rnDir,
    'types_generated/Libraries/StyleSheet/StyleSheetExports.d.ts'
  );
  if (fs.existsSync(exportsFile)) {
    try {
      let content = fs.readFileSync(exportsFile, 'utf8');
      const EXPORTS_MARKER = '/* react-native-stylefn exports patched */';
      if (!content.includes(EXPORTS_MARKER)) {
        // Original: export declare const create: <S extends ____Styles_Internal>(obj: S & ____Styles_Internal) => Readonly<S>;
        const createPattern =
          /export declare const create:\s*<S extends ____Styles_Internal>\(obj:\s*S\s*&\s*____Styles_Internal\)\s*=>\s*Readonly<S>;/;
        if (createPattern.test(content)) {
          // First update the import to include ____DangerouslyImpreciseStyle_Internal
          const importPattern =
            /import type \{ ____Styles_Internal \} from "\.\/StyleSheetTypes";/;
          if (importPattern.test(content)) {
            content = content.replace(
              importPattern,
              'import type { ____Styles_Internal, ____DangerouslyImpreciseStyle_Internal } from "./StyleSheetTypes";'
            );
          }
          // Then replace the create function
          const replacement = [
            EXPORTS_MARKER,
            `type ____Styles_With_Fns_Internal = { readonly [key: string]: Partial<____DangerouslyImpreciseStyle_Internal> | ((tokens: import('react-native-stylefn').StyleTokens) => any) };`,
            `type _StyleFnResult<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : T[K] };`,
            `export declare const create: <S extends ____Styles_With_Fns_Internal>(obj: S & ____Styles_With_Fns_Internal) => Readonly<_StyleFnResult<S>>;`,
          ].join('\n');
          content = content.replace(createPattern, replacement);
          fs.writeFileSync(exportsFile, content, 'utf8');
          patchedAny = true;
          console.log(
            `[react-native-stylefn] ✓ Patched create in ${path.relative(
              process.cwd(),
              exportsFile
            )}`
          );
        }
      }
    } catch (_) {
      /* silent */
    }
  }

  if (patchedAny) {
    console.log(
      '[react-native-stylefn] Style functions now work on ALL components with full TypeScript support.'
    );
    console.log(
      '[react-native-stylefn] StyleSheet.create() also accepts style functions.'
    );
  } else {
    console.log(
      '[react-native-stylefn] Types already patched or no matching patterns found.'
    );
  }

  // Patch tsconfig.json to add jsxImportSource for automatic prop function support
  patchTsConfig();
}

setup();
