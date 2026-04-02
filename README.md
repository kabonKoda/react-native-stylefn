# react-native-stylefn

A Tailwind-inspired styling library that injects design tokens into every React Native component's `style` prop — **automatically**, with zero per-component setup.

Write style _functions_ instead of style objects. Every function receives rich contextual tokens — theme, dark mode, breakpoints, orientation, platform, safe area insets, and accessibility — and returns a standard RN style object. The Babel plugin resolves these functions at compile time so native components always receive plain style objects.

## Features

- 🎨 **Tailwind-inspired design tokens** — spacing, fonts, colors, shadows, border radius, and more
- 🌓 **Automatic dark mode** — system-driven or manual toggle
- 📱 **Responsive breakpoints** — `sm`, `md`, `lg`, `xl` derived from screen width
- 🔄 **Orientation-aware** — `portrait` / `landscape` token updates on rotation
- 🛡️ **Safe area insets** — passed directly into every style function
- ♿ **Accessibility tokens** — reduced motion, font scale, bold text, high contrast
- 👆 **Interaction states** — `t.active` and `t.hovered` in any style function, on **any** component — no Pressable, no imports, no hooks needed. Backed by `react-native-gesture-handler` gestures when available (iOS/Android/Web), with automatic `onTouchStart`/`onTouchEnd` fallback.
- ⚡ **Zero runtime overhead** — compile-time transform, no monkey-patching of React internals
- 🧩 **Truly universal** — works on ALL components (built-in, third-party, custom) — any prop ending in `style` or `Style`
- 🔮 **Token functions in any prop** — use `(t) => ...` in `width`, `height`, `columns`, or any non-callback prop
- 📦 **Zero config** — works out of the box with sensible defaults
- 🎯 **Full TypeScript** — automatic type patching, complete autocomplete on every token
- 🔌 **Babel plugin** — transforms style props at build time, patches `StyleSheet.create` at runtime
- 🎬 **Reanimated compatible** — works with `useAnimatedStyle` via `useStyleFn()` hook

## Installation

```bash
npm install react-native-stylefn
# or
yarn add react-native-stylefn
```

## Complete Setup Guide

After installing, there are **6 steps** to fully set up the library. Steps 1–3 are handled automatically by the postinstall script. Steps 4–6 require manual file edits. An optional Step 7 covers the design token config files.

> **TL;DR** — Install, check that postinstall ran, add the Babel plugin, add the Metro wrapper, wrap your app in `<StyleProvider>`, create `global.css` if you want CSS variables. That's it.

---

### Step 1 — Automatic: `StyleProp<T>` type patching (postinstall)

**What happens:** The `postinstall` script (`scripts/setup.js`) runs automatically after `npm install` / `yarn add`. It patches React Native's `StyleProp<T>` type definition so that **every** component's `style` prop accepts style functions.

**Where it patches:**

```
node_modules/react-native/
  ├── types_generated/Libraries/StyleSheet/StyleSheetTypes.d.ts  ← StyleProp<T>
  ├── types_generated/Libraries/StyleSheet/StyleSheetExports.d.ts ← StyleSheet.create()
  └── Libraries/StyleSheet/StyleSheet.d.ts                       ← (older RN versions)
```

**What the patch looks like:**

```ts
// Before (React Native's original type):
export type StyleProp<T> =
  | null
  | void
  | T
  | false
  | ''
  | ReadonlyArray<StyleProp<T>>;

// After (patched by react-native-stylefn):
export type StyleProp<T> =
  | null
  | void
  | T
  | false
  | ''
  | ReadonlyArray<StyleProp<T>>
  | ((
      tokens: import('react-native-stylefn').StyleTokens
    ) => T | false | null | undefined);
```

Since **every** React Native component (`View`, `Text`, `ScrollView`, `FlatList`, third-party components, etc.) uses `StyleProp` for its style props, this single patch makes style functions work everywhere.

It also patches `StyleSheet.create()` to accept style functions as values, so you can mix static styles and dynamic style functions in the same `StyleSheet.create()` call.

**The script also creates a type stub** at `node_modules/react-native/node_modules/react-native-stylefn/` so that the `import('react-native-stylefn').StyleTokens` reference in the patched type always resolves correctly, regardless of monorepo layout.

> **If postinstall didn't run** (e.g. you used `--ignore-scripts`), run it manually:
>
> ```bash
> npx react-native-stylefn setup
> ```

> **After upgrading React Native**, run it again — RN upgrades overwrite the type files:
>
> ```bash
> npx react-native-stylefn setup
> ```

---

### Step 2 — Automatic: `tsconfig.json` patching (postinstall)

**What happens:** The same postinstall script also patches your project's `tsconfig.json` to add `jsxImportSource`. This points TypeScript to a **custom JSX runtime** that makes ALL component props (not just style props) accept token functions.

**What it adds to your `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react-native-stylefn"
  }
}
```

**Why this matters:** Without this, only `style` props would accept `(t) => ...` functions (via the `StyleProp` patch from Step 1). With `jsxImportSource`, **any** non-callback prop like `width`, `height`, `columns`, `color`, etc. also accepts token functions — and TypeScript won't complain:

```tsx
// Component declares plain types:
function Box({ width, color }: { width: number; color: string }) { ... }

// Consumer passes token functions — TypeScript is happy because jsxImportSource is set:
<Box
  width={({ orientation }) => orientation.landscape ? 200 : 120}
  color={({ dark }) => dark ? '#fff' : '#000'}
/>
```

**How it works:** The custom JSX runtime lives in:

```
react-native-stylefn/
  ├── jsx-runtime/index.d.ts      ← Production builds
  └── jsx-dev-runtime/index.d.ts  ← Development builds
```

These files override TypeScript's `LibraryManagedAttributes` type to wrap every non-callback, non-style prop `T` with `T | ((tokens: StyleTokens) => T)`. Props that are **never** widened (they keep their original types):

- `key`, `ref`, `children`
- Event handlers: `on*` (onPress, onChange, etc.)
- Render props: `render*`, `handle*`
- Style props: `style`, `*Style` (already handled by `StyleProp` patching)
- Known callbacks: `keyExtractor`, `getItem`, `ListHeaderComponent`, etc.

> **Manual setup** — If the postinstall script couldn't auto-patch your tsconfig (e.g. it has comments), add the settings manually:
>
> ```json
> // tsconfig.json
> {
>   "compilerOptions": {
>     "jsx": "react-jsx",
>     "jsxImportSource": "react-native-stylefn"
>   }
> }
> ```

---

### Step 3 — Automatic: `stylefn.d.ts` type declarations (generated by Metro)

**What happens:** When Metro starts (via `withStyleFn()` — set up in Step 5), it reads your `rn-stylefn.config.js` and `global.css`, then generates a `stylefn.d.ts` file that gives you **full TypeScript autocomplete** for all your theme keys.

**Where it's generated:**

```
your-project/
  └── node_modules/react-native-stylefn/stylefn.d.ts   ← auto-generated
```

A copy is also written to your project root as `stylefn.d.ts` if the library's installed location isn't writable.

**What the generated file looks like:**

```ts
// Auto-generated by react-native-stylefn — do not edit
export {};

declare module 'react-native-stylefn' {
  interface ThemeKeyOverrides {
    spacing: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12';
    fontSize: '2xl' | '3xl' | 'base' | 'lg' | 'sm' | 'xl' | 'xs';
    borderRadius: '2xl' | 'full' | 'lg' | 'md' | 'none' | 'sm' | 'xl';
    color: 'accent' | 'background' | 'border' | 'primary' | 'primary-foreground' | ...;
    shadow: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'none' | ...;
    breakpoint: 'lg' | 'md' | 'sm' | 'xl';
  }
}
```

**How to reference it** — Create a `stylefn-env.d.ts` file (or any `.d.ts` file) in your project's root that references the generated declarations:

```ts
// stylefn-env.d.ts
/// <reference types="react-native-stylefn/stylefn" />
```

Make sure this file is included in your `tsconfig.json`'s `include` pattern (e.g. `"include": ["**/*.ts", "**/*.tsx"]`).

**Result:** Your IDE now suggests all your actual theme keys everywhere:

```tsx
t.theme.borderRadius['lg']; // ✅ autocomplete suggests 'sm', 'md', 'lg', 'xl', '2xl', 'full', 'none'
t.theme.spacing[4]; // ✅ autocomplete suggests '0', '1', '2', '3', '4', '5', '6', '8', '10', '12'
t.colors.primary; // ✅ autocomplete suggests 'primary', 'secondary', 'background', 'text', etc.
t.breakpoint.up('md'); // ✅ autocomplete suggests 'sm', 'md', 'lg', 'xl'
```

> **Note:** This file is auto-generated every time Metro starts. Add `stylefn.d.ts` to your `.gitignore` (the Metro wrapper does this automatically).

---

### Step 4 — Manual: Add the Babel plugin

Create or update your `babel.config.js` to include the stylefn Babel plugin:

```js
// babel.config.js
module.exports = {
  presets: ['babel-preset-expo'], // or your existing preset
  plugins: ['react-native-stylefn/babel-plugin'],
};
```

**What the Babel plugin does** (at compile time):

1. **Transforms style props** — wraps function/array expressions in `__resolveStyle()`:

   ```
   style={(t) => ({...})}  →  style={__resolveStyle((t) => ({...}))}
   ```

2. **Transforms non-style token props** — wraps arrow functions in non-callback props with `__resolveProp()`:

   ```
   width={({ orientation }) => ...}  →  width={__resolveProp(({ orientation }) => ...)}
   ```

3. **Auto-imports `react-native-stylefn/auto`** — injects a side-effect import that patches `StyleSheet.create` to support style functions at runtime.

> **Important:** Clear your Metro cache after adding/changing the Babel config:
>
> ```bash
> npx expo start --clear
> # or
> npx react-native start --reset-cache
> ```

---

### Step 5 — Manual: Add the Metro config wrapper

Update your `metro.config.js` to wrap with `withStyleFn`:

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withStyleFn } = require('react-native-stylefn/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = withStyleFn(config, {
  input: './global.css', // path to your CSS variables file (optional)
  config: './rn-stylefn.config.js', // path to your config file (optional, this is the default)
});
```

**What `withStyleFn()` does:**

1. **Parses `global.css`** — reads CSS custom properties from `:root` and `.dark` selectors
2. **Creates a virtual module** — writes parsed CSS variables to `node_modules/react-native-stylefn/css-vars.js` and registers a Metro resolver so `react-native-stylefn/css-vars` resolves to it
3. **Resolves the config file** — maps `rn-stylefn.config` imports to your config file
4. **Generates `stylefn.d.ts`** — type declarations for autocomplete (Step 3 above)
5. **Updates `.gitignore`** — adds `stylefn.d.ts` to your `.gitignore`

---

### Step 6 — Manual: Wrap your app with `StyleProvider`

In your root layout or App component, wrap everything with `StyleProvider`:

```tsx
import { StyleProvider } from 'react-native-stylefn';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function App() {
  const insets = useSafeAreaInsets();

  // rn-stylefn.config.js and global.css are auto-loaded — no imports needed
  return (
    <StyleProvider insets={insets}>
      <RootNavigator />
    </StyleProvider>
  );
}
```

`StyleProvider` subscribes to device state (dimensions, color scheme, accessibility) and updates the token store. Children always render with current token values.

> **Note:** `insets` are optional but recommended. If you don't use `react-native-safe-area-context`, you can omit the `insets` prop.

---

### Step 7 — Optional: Create design token files

#### `global.css` — CSS custom properties

Create a `global.css` in your project root to define light/dark color palettes and design tokens:

```css
/* global.css */
:root {
  /* --color-* prefix → available as t.colors.* */
  --color-background: #ffffff;
  --color-text: #111827;
  --color-primary: #3b82f6;

  /* Generic variables → available for var() resolution in config */
  --primary: 224 71% 51%;
  --primary-foreground: 210 20% 98%;
  --radius: 8;

  /* Shadow levels → available for var() resolution in config */
  --shadow-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
}

.dark {
  --color-background: #0f172a;
  --color-text: #f8fafc;
  --color-primary: #60a5fa;

  --primary: 216 91% 70%;
  --primary-foreground: 221 39% 11%;
  --radius: 8;

  --shadow-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.3);
}
```

#### `rn-stylefn.config.js` — Theme configuration

Create a `rn-stylefn.config.js` in your project root to customize design tokens:

```js
// rn-stylefn.config.js
module.exports = {
  darkMode: 'system', // 'system' | 'manual'
  theme: {
    spacing: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
    fontSize: { 'xs': 10, 'sm': 12, 'base': 14, 'lg': 16, 'xl': 20, '2xl': 24 },
    borderRadius: {
      sm: 'calc(var(--radius) - 4px)', // CSS expression → resolved from global.css
      md: 'calc(var(--radius) - 2px)',
      lg: 'var(--radius)',
      full: 9999,
    },
    colors: {
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      danger: '#ef4444',
    },
    screens: { sm: 0, md: 375, lg: 430, xl: 768 },
  },
};
```

Both files are **auto-loaded** — no manual imports required. Just create them and restart Metro.

---

### Setup Checklist

Here's a summary checklist for verifying your setup:

| #   | What                                           | File                                                 | Auto / Manual         |
| --- | ---------------------------------------------- | ---------------------------------------------------- | --------------------- |
| 1   | `StyleProp<T>` patching                        | `node_modules/react-native/.../StyleSheetTypes.d.ts` | ✅ Auto (postinstall) |
| 2   | `tsconfig.json` — `jsx` + `jsxImportSource`    | `tsconfig.json`                                      | ✅ Auto (postinstall) |
| 3   | `stylefn.d.ts` — theme key autocomplete        | `node_modules/react-native-stylefn/stylefn.d.ts`     | ✅ Auto (Metro start) |
| 4   | Babel plugin                                   | `babel.config.js`                                    | ✍️ Manual             |
| 5   | Metro config wrapper                           | `metro.config.js`                                    | ✍️ Manual             |
| 6   | `StyleProvider` in root component              | `app/_layout.tsx` or `App.tsx`                       | ✍️ Manual             |
| 7a  | `global.css` (CSS variables)                   | `global.css`                                         | ✍️ Optional           |
| 7b  | `rn-stylefn.config.js` (theme config)          | `rn-stylefn.config.js`                               | ✍️ Optional           |
| 7c  | `stylefn-env.d.ts` (reference generated types) | `stylefn-env.d.ts`                                   | ✍️ Optional           |

### Troubleshooting Setup

| Problem                              | Solution                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `StyleProp` doesn't accept functions | Run `npx react-native-stylefn setup` manually                                                 |
| No autocomplete on `t.theme.*`       | Check that `stylefn-env.d.ts` references the generated types, and restart your TS server      |
| `jsxImportSource` not in tsconfig    | Add `"jsx": "react-jsx"` and `"jsxImportSource": "react-native-stylefn"` to `compilerOptions` |
| Metro can't find `css-vars` module   | Make sure `withStyleFn()` wraps your Metro config in `metro.config.js`                        |
| Style functions not being resolved   | Check that `react-native-stylefn/babel-plugin` is in your `babel.config.js` plugins           |
| Types broken after RN upgrade        | Run `npx react-native-stylefn setup` — RN upgrades overwrite the patched type files           |
| Cache issues after config changes    | Run `npx expo start --clear` or `npx react-native start --reset-cache`                        |

---

## Usage Examples

Once setup is complete, you can start using style functions immediately.

### 1. Write style functions

```tsx
import { View, Text, ScrollView } from 'react-native';

// No special imports — just write a function where you'd write a style object

<View style={(t) => ({
  backgroundColor: t.dark ? t.colors.background : t.colors.surface,
  padding: t.breakpoint.up('lg') ? 24 : 12,
  flexDirection: t.orientation.landscape ? 'row' : 'column',
})} />

<Text style={(t) => ({
  fontSize: t.theme.fontSize.base,
  color: t.theme.colors.primary,
  fontWeight: t.theme.fontWeight.bold,
})} />

<ScrollView
  contentContainerStyle={(t) => ({
    padding: t.theme.spacing[4],
    paddingTop: t.insets.top + t.theme.spacing[4],
    paddingBottom: t.insets.bottom + t.theme.spacing[6],
  })}
/>
```

### 2. Mix functions and objects in arrays

```tsx
<View
  style={[
    { flex: 1 },
    (t) => ({ backgroundColor: t.dark ? '#000' : '#fff' }),
    (t) => t.breakpoint.down('md') && { padding: 8 },
  ]}
/>
```

### 3. Use with `StyleSheet.create`

```tsx
import { StyleSheet, View, Text } from 'react-native';

const styles = StyleSheet.create({
  // Dynamic — resolved at render time
  container: (t) => ({
    flex: 1,
    backgroundColor: t.colors.background,
    padding: t.theme.spacing[4],
  }),
  // Static — processed normally
  badge: {
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
});

<View style={styles.container}>
  <View style={styles.badge} />
</View>;
```

### 4. Use with Reanimated

```tsx
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useStyleFn } from 'react-native-stylefn';

function AnimatedCard() {
  const { colors, theme, dark } = useStyleFn();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={() => {
        scale.value = withSpring(0.95);
      }}
    >
      <Animated.View
        style={[
          {
            backgroundColor: dark ? '#1e293b' : colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: theme.spacing[4],
          },
          animatedStyle,
        ]}
      />
    </Pressable>
  );
}
```

### 5. Build custom components with style functions

```tsx
import { useStyleFn } from 'react-native-stylefn';

function StyledCard({ style, children }) {
  const tokens = useStyleFn();

  // Resolve: if style is a function, call it with tokens
  const resolvedStyle = typeof style === 'function' ? style(tokens) : style;

  return <View style={resolvedStyle}>{children}</View>;
}

// Usage
<StyledCard
  style={(t) => ({
    backgroundColor: t.colors.surface,
    padding: t.theme.spacing[4],
    borderRadius: t.theme.borderRadius.lg,
  })}
>
  <Text>Custom component with style functions</Text>
</StyledCard>;
```

### 6. Token functions in ANY prop (not just style)

Token functions aren't limited to `style` props — you can use them in **any** prop that accepts a value. The Babel plugin automatically detects arrow functions in non-callback props and resolves them with the current tokens.

**No special types needed!** Your component can declare plain types like `width: number` and consumers can still pass token functions. The custom JSX runtime handles TypeScript automatically.

```tsx
// Component uses plain types — no PropFunction<T> needed:
function ResponsiveBox({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  return <View style={{ width, height, backgroundColor: color }} />;
}

// ✅ Consumers pass token functions — TypeScript is happy, Babel resolves at runtime:
<ResponsiveBox
  width={({ orientation }) => (orientation.landscape ? 200 : 120)}
  height={80}
  color={({ dark }) => (dark ? '#3b82f6' : '#2563eb')}
/>;
```

```tsx
// ✅ These all work automatically — the Babel plugin wraps them for you

<StrokePreview
  width={({ orientation }) => orientation.landscape ? 266 : 200}
  height={180}
  isEraser={disabled}
/>

<Image
  source={require('./avatar.png')}
  width={({ breakpoint }) => breakpoint.up('lg') ? 120 : 80}
  height={({ breakpoint }) => breakpoint.up('lg') ? 120 : 80}
  borderRadius={({ breakpoint }) => breakpoint.up('lg') ? 60 : 40}
/>

<Grid
  columns={({ breakpoint }) => breakpoint.up('xl') ? 4 : breakpoint.up('md') ? 2 : 1}
  spacing={({ theme }) => theme.spacing[4]}
/>

<Canvas
  backgroundColor={({ dark }) => dark ? '#1a1a2e' : '#ffffff'}
  lineWidth={({ platform }) => platform.web ? 2 : 1}
/>
```

> **Smart detection:** The plugin only wraps arrow/function expressions. Event handlers (`onPress`, `onChange`, etc.), render props (`renderItem`, `renderHeader`, etc.), and known callbacks (`keyExtractor`, `ref`, etc.) are **never** wrapped — they keep working as normal callbacks.

#### How it works under the hood

```
                   Compile Time (Babel)                          Runtime
                   ────────────────────                          ───────

width={({ orientation }) => ...}                                 __resolveProp calls
        │                                                        the function with
        ▼                                                        current tokens and
width={__resolveProp(({ orientation }) => ...)}                  returns the value
```

### 7. `usePropsFn` hook — resolve multiple token props at once

For cases where you need explicit control, or when building wrapper components that pass resolved values to third-party libraries, use the `usePropsFn` hook:

```tsx
import { usePropsFn } from 'react-native-stylefn';

function StrokePreview({ brushState, isEraser }) {
  const { width, height, columns } = usePropsFn({
    width: ({ orientation }) => (orientation.landscape ? 266 : 200),
    height: 180, // static values pass through unchanged
    columns: ({ breakpoint }) => (breakpoint.up('lg') ? 3 : 2),
  });

  return <Canvas width={width} height={height} columns={columns} />;
}
```

```tsx
// Great for third-party components that don't go through the Babel plugin
function ResponsiveSlider() {
  const { sliderWidth, thumbSize, trackHeight } = usePropsFn({
    sliderWidth: ({ screen }) => screen.width - 32,
    thumbSize: ({ breakpoint }) => (breakpoint.up('md') ? 24 : 16),
    trackHeight: ({ breakpoint }) => (breakpoint.up('md') ? 6 : 4),
  });

  return (
    <Slider
      style={{ width: sliderWidth }}
      thumbSize={thumbSize}
      trackHeight={trackHeight}
    />
  );
}
```

```tsx
// Use with color picker, drawing tools, or any responsive component
function DrawingToolbar({ brushState }) {
  const { panelWidth, swatchSize, previewSize } = usePropsFn({
    panelWidth: ({ orientation }) => (orientation.landscape ? 360 : 280),
    swatchSize: ({ breakpoint }) => (breakpoint.up('lg') ? 32 : 26),
    previewSize: ({ orientation, breakpoint }) => ({
      width: orientation.landscape ? 266 : 200,
      height: breakpoint.up('lg') ? 200 : 180,
    }),
  });

  return (
    <View style={{ width: panelWidth }}>
      <Swatches swatchStyle={{ width: swatchSize, height: swatchSize }} />
      <StrokePreview width={previewSize.width} height={previewSize.height} />
    </View>
  );
}
```

### 8. `PropFunction<T>` (optional — for explicit typing)

With `jsxImportSource` configured (done automatically by postinstall), you **don't need** `PropFunction<T>` — plain types like `width: number` already accept token functions in JSX.

However, if you prefer explicit typing or need it for non-JSX contexts, `PropFunction<T>` is still available:

```tsx
import type { PropFunction } from 'react-native-stylefn';

// Option A: Plain types (recommended — works automatically with jsxImportSource)
interface BoxProps {
  width: number;
  height: number;
}

// Option B: Explicit PropFunction (still works, useful for documentation)
interface BoxProps {
  width: PropFunction<number>;
  height: PropFunction<number>;
}

// Both allow consumers to pass:
<Box width={266} height={180} />                                              // static
<Box width={({ orientation }) => orientation.landscape ? 266 : 200} height={180} /> // dynamic
```

## Interaction States — `t.active` and `t.hovered`

The Babel plugin performs **static analysis** on every style (and prop) function. When it detects `t.active` or `t.hovered`, it automatically wraps the element with `__InteractiveView` — injecting the gesture / event handlers needed to track interaction state. **No imports, no hooks, no `Pressable` wrapping required.**

### `t.active` — works on any component

```tsx
// View, Text, Image — it doesn't matter. Babel handles everything.
<View style={(t) => ({
  backgroundColor: t.active ? t.colors.accent : t.colors.surface,
  opacity: t.active ? 0.85 : 1,
  transform: [{ scale: t.active ? 0.97 : 1 }],
})} />

<Text style={(t) => ({
  color: t.active ? '#fff' : t.colors.text,
  fontWeight: t.active ? t.theme.fontWeight.semibold : t.theme.fontWeight.normal,
})} />
```

**What Babel emits at compile time:**

```tsx
// Developer writes:
<View style={(t) => ({ opacity: t.active ? 0.85 : 1 })} />

// Babel transforms to:
<__InteractiveView
  __type={View}
  __needsActive
  __styleFn={(t) => ({ opacity: t.active ? 0.85 : 1 })}
/>
```

`__InteractiveView` manages state and resolves the style function with the live `active` value.

### Gesture Handler integration (primary — when available)

When `react-native-gesture-handler` is installed **and** the component is inside a `GestureHandlerRootView`, `__InteractiveView` uses `Gesture.Tap()` with `.runOnJS(true)` to track the active state:

```tsx
// __InteractiveView internal logic (simplified):
const tap = Gesture.Tap()
  .runOnJS(true) // callbacks on JS thread — no worklet compiler needed
  .onBegin(() => setActive(true))
  .onFinalize(() => setActive(false));

return (
  <GestureDetector gesture={tap}>
    <Component style={resolvedStyle} />
  </GestureDetector>
);
```

This approach works on **iOS, Android, and Web** without any platform-specific code.

`react-native-gesture-handler` is an **optional** peer dependency — add it only if you want the gesture-backed behaviour (recommended for most apps that already use it via Expo Router / React Navigation):

```bash
npx expo install react-native-gesture-handler
# or
yarn add react-native-gesture-handler
```

> **Tip:** Wrap your root layout with `<GestureHandlerRootView style={{ flex: 1 }}>` (from `react-native-gesture-handler`) so gesture detection works throughout your app. If you use Expo Router, this is already done for you.

### Touch-handler fallback

If `react-native-gesture-handler` is not installed, or the component is **not** inside a `GestureHandlerRootView`, `__InteractiveView` automatically falls back to `onTouchStart` / `onTouchEnd` / `onTouchCancel` event props on the wrapped component:

```tsx
// Fallback (when no GestureHandlerRootView ancestor):
<Component
  onTouchStart={() => setActive(true)}
  onTouchEnd={() => setActive(false)}
  onTouchCancel={() => setActive(false)}
  style={resolvedStyle}
/>
```

User-provided `onTouchStart`, `onTouchEnd`, etc. handlers are **preserved and composed** — they're always called alongside the injected setters.

### `t.hovered` — pointer events on web and iPad

```tsx
<View
  style={(t) => ({
    backgroundColor: t.hovered ? t.colors.accent : t.colors.surface,
    transform: [{ scale: t.hovered ? 1.03 : 1 }],
    shadowOpacity: t.hovered ? 0.2 : 0.05,
  })}
/>
```

- **Primary (RNGH):** Uses `Gesture.Hover().runOnJS(true)` — works on web and any platform that supports pointer events (e.g. iPad with Magic Keyboard/Trackpad).
- **Fallback:** Uses `onMouseEnter` / `onMouseLeave` (web-only React Native events).

### Combined `t.active` + `t.hovered`

When both tokens are used the plugin emits `__needsActive` and `__needsHovered` together. `__InteractiveView` composes both gestures with `Gesture.Simultaneous()`:

```tsx
<View
  style={(t) => ({
    backgroundColor: t.hovered
      ? t.active
        ? t.colors.accent
        : t.colors.surface
      : t.colors.background,
    opacity: t.active ? 0.85 : 1,
    transform: [{ scale: t.hovered ? 1.02 : 1 }],
  })}
/>
```

### Works with destructured parameters too

```tsx
// Both syntaxes are detected by the plugin:
<View style={({ active }) => ({ opacity: active ? 0.7 : 1 })} />
<View style={({ active, hovered }) => ({
  opacity: active ? 0.7 : 1,
  backgroundColor: hovered ? '#e0f2fe' : 'transparent',
})} />
```

### Also works in non-style props

```tsx
// accessibilityState referencing t.active:
<View
  style={(t) => ({ opacity: t.active ? 0.7 : 1 })}
  accessibilityState={(t) => ({ pressed: t.active })}
/>
```

---

## How Types Work — Universal & Automatic

The type system works through **two complementary mechanisms**, both set up automatically by the postinstall script:

### 1. Style Props — `StyleProp<T>` patching

The postinstall script patches React Native's `StyleProp<T>` type definition to include style functions:

```ts
// Before (RN's original type):
type StyleProp<T> = null | void | T | false | '' | ReadonlyArray<StyleProp<T>>;

// After (patched by react-native-stylefn):
type StyleProp<T> =
  | null
  | void
  | T
  | false
  | ''
  | ReadonlyArray<StyleProp<T>>
  | ((tokens: StyleTokens) => T | false | null | undefined);
```

Since **every** React Native component uses `StyleProp` for its style props, this single patch makes style functions work everywhere — View, Text, ScrollView, FlatList, third-party components, custom components — any prop typed as `StyleProp`.

### 2. Non-Style Props — Custom JSX Runtime (`jsxImportSource`)

The postinstall script also adds `jsxImportSource: "react-native-stylefn"` to your `tsconfig.json`. This points TypeScript to a custom JSX runtime that overrides `LibraryManagedAttributes` — the type TypeScript uses to check JSX props.

The custom runtime wraps every non-callback, non-style prop type `T` with `T | ((tokens: StyleTokens) => T)`, so **any component prop** automatically accepts token functions without needing `PropFunction<T>`:

```tsx
// Your component — plain types, nothing special:
function Box({ width, color }: { width: number; color: string }) { ... }

// TypeScript sees the JSX props as:
//   width: number | ((tokens: StyleTokens) => number)
//   color: string | ((tokens: StyleTokens) => string)

// So this just works:
<Box width={({ breakpoint }) => breakpoint.up('lg') ? 200 : 120} color="#fff" />
```

Props that are **never** widened (they keep their original types):

- `key`, `ref`, `children`
- Event handlers: `on*` (onPress, onChange, etc.)
- Render props: `render*`, `handle*`
- Style props: `style`, `*Style` (already handled by StyleProp patching)
- Known callbacks: `keyExtractor`, `getItem`, `ListHeaderComponent`, etc.

### Manual setup

You can also run the setup manually:

```bash
npx react-native-stylefn setup
```

Or add the tsconfig settings yourself:

```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react-native-stylefn"
  }
}
```

## Token Reference

Every style function receives a `StyleTokens` object:

| Token           | Type                                  | Description                                                                                 |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `theme`         | `object`                              | Full resolved theme (spacing, fontSize, borderRadius, fontWeight, colors, shadows, opacity) |
| `colors`        | `Record<string, string>`              | Resolved color palette for the current color scheme                                         |
| `dark`          | `boolean`                             | Whether dark mode is active                                                                 |
| `colorScheme`   | `'light' \| 'dark'`                   | Current color scheme                                                                        |
| `breakpoint`    | `BreakpointQuery`                     | Breakpoint queries: `.current`, `.up(name)`, `.down(name)`                                  |
| `screen`        | `{ width, height, scale, fontScale }` | Screen dimensions                                                                           |
| `orientation`   | `OrientationTokens`                   | Boolean flags: `.landscape`, `.portrait`                                                    |
| `platform`      | `PlatformTokens`                      | Boolean flags: `.ios`, `.android`, `.web`, `.windows`, `.macos`                             |
| `insets`        | `{ top, bottom, left, right }`        | Safe area insets                                                                            |
| `active`        | `boolean`                             | Whether the component is actively being pressed/touched (injected by Babel plugin)          |
| `hovered`       | `boolean`                             | Whether the component is being hovered by a pointer — web / iPad pointer (Babel plugin)     |
| `reducedMotion` | `boolean`                             | User prefers reduced motion                                                                 |
| `fontScale`     | `number`                              | Current font scale multiplier                                                               |
| `boldText`      | `boolean`                             | Bold text enabled (iOS)                                                                     |
| `highContrast`  | `boolean`                             | High contrast enabled                                                                       |
| `alpha`         | `(color, opacity) => string`          | Apply opacity to any color → returns `#RRGGBBAA` hex                                        |
| `vw`            | `(v: number) => number`               | Viewport width unit: `t.vw(50)` = 50% of screen width                                       |
| `vh`            | `(v: number) => number`               | Viewport height unit: `t.vh(50)` = 50% of screen height                                     |
| `rem`           | `(v: number) => number`               | Rem unit: `t.rem(1)` = 16px (configurable via `inlineRem`)                                  |
| `calc`          | `(expr: string) => number`            | Evaluate calc expressions: `t.calc('100vw - 32px')`                                         |

### Color Opacity — `t.alpha()`

Apply opacity to any color, returning an `#RRGGBBAA` hex string. This is the runtime equivalent of Tailwind's `/opacity` modifier:

```tsx
<View
  style={(t) => ({
    backgroundColor: t.alpha(t.colors.primary, 0.1), // primary at 10% opacity
    borderColor: t.alpha(t.colors.border, 0.5), // border at 50% opacity
    shadowColor: t.alpha('#000000', 0.25), // black at 25%
  })}
/>
```

**Opacity range:**

- `0–1` → treated as a fraction (e.g. `0.5` = 50%)
- `1–100` → treated as a percentage (e.g. `50` = 50%)

**Shorthand via `t.colors` proxy** — append `/opacity` to any color key:

```tsx
<View
  style={(t) => ({
    backgroundColor: t.colors['primary/10'], // primary at 10%
    borderColor: t.colors['muted-foreground/30'], // muted-foreground at 30%
    color: t.colors['yellow-900/50'], // Tailwind yellow-900 at 50%
  })}
/>
```

### Breakpoint Queries

```tsx
// t.breakpoint.current → 'sm' | 'md' | 'lg' | 'xl' (active breakpoint name)
// t.breakpoint.up('md')  → true when screen width >= md threshold (375dp)
// t.breakpoint.down('lg') → true when screen width < lg threshold (430dp)

<View
  style={(t) => ({
    padding: t.breakpoint.up('lg') ? 24 : 12,
    flexDirection: t.breakpoint.up('xl') ? 'row' : 'column',
  })}
/>
```

### Orientation Booleans

```tsx
// t.orientation.landscape → true when width >= height
// t.orientation.portrait  → true when height > width

<View
  style={(t) => ({
    flexDirection: t.orientation.landscape ? 'row' : 'column',
  })}
/>
```

### Platform Booleans

```tsx
// t.platform.ios     → true on iOS
// t.platform.android → true on Android
// t.platform.web     → true on Web
// t.platform.windows → true on Windows
// t.platform.macos   → true on macOS

<View
  style={(t) => ({
    paddingTop: t.platform.ios ? 44 : 0,
    fontFamily: t.platform.ios ? 'SF Pro' : 'Roboto',
  })}
/>
```

### Shadow Tokens

Shadows use the `boxShadow` CSS string format (supported in React Native 0.76+):

```tsx
<View
  style={(t) => ({
    ...t.theme.shadows.md,
    // Expands to: { boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), ...' }
  })}
/>
```

## Hooks

### `useStyleFn()`

Access tokens inside component logic, event handlers, or animations:

```tsx
import { useStyleFn } from 'react-native-stylefn';

function MyComponent() {
  const { dark, colors, breakpoint, theme } = useStyleFn();

  return (
    <Pressable
      onPress={() => analytics.track('tap', { theme: dark ? 'dark' : 'light' })}
    >
      <Text style={{ color: colors.text, fontSize: theme.fontSize.base }}>
        Hello
      </Text>
    </Pressable>
  );
}
```

### `useTheme()`

Manual dark mode control (when `darkMode: 'manual'` is set):

```tsx
import { useTheme } from 'react-native-stylefn';

function SettingsScreen() {
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <View>
      <Text>Dark Mode: {theme ? 'On' : 'Off'}</Text>
      <Switch value={theme} onValueChange={toggleTheme} />
    </View>
  );
}
```

### `usePropsFn()`

Resolve an object of props where any value can be a token function. Re-renders when tokens change (orientation, breakpoint, dark mode, etc.):

```tsx
import { usePropsFn } from 'react-native-stylefn';

function ResponsivePanel() {
  const { width, height, columns } = usePropsFn({
    width: ({ orientation }) => (orientation.landscape ? 360 : 280),
    height: 180, // static values pass through unchanged
    columns: ({ breakpoint }) => (breakpoint.up('lg') ? 3 : 2),
  });

  return <Grid width={width} height={height} columns={columns} />;
}
```

This is especially useful for passing resolved values to third-party components that don't go through the Babel plugin.

## Configuration

### `StyleProvider` Props

```tsx
<StyleProvider
  config={{
    darkMode: 'system',
    theme: {
      /* overrides */
    },
  }}
  insets={safeAreaInsets}
  cssVars={parsedCSSVariables}
>
  {children}
</StyleProvider>
```

---

### Using `rn-stylefn.config.js`

Create a config file at the root of your project:

```js
// rn-stylefn.config.js
module.exports = {
  darkMode: 'system', // 'system' | 'manual'

  theme: {
    // Override built-in spacing scale
    spacing: {
      0: 0,
      1: 4,
      2: 8,
      3: 12,
      4: 16,
      5: 20,
      6: 24,
      8: 32,
      10: 40,
      12: 48,
    },
    // Override font sizes
    fontSize: {
      'xs': 10,
      'sm': 12,
      'base': 14,
      'lg': 16,
      'xl': 20,
      '2xl': 24,
      '3xl': 30,
    },
    // Override border radii
    borderRadius: {
      'none': 0,
      'sm': 4,
      'md': 8,
      'lg': 12,
      'xl': 16,
      '2xl': 24,
      'full': 9999,
    },
    // Override font weights
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    // Override breakpoints (screen widths in dp)
    screens: { sm: 0, md: 375, lg: 430, xl: 768 },

    // Add your brand colors (available via t.theme.colors.*)
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      danger: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },

    // extend: merges on top of the built-in theme without replacing
    extend: {
      colors: { 'brand': '#ff6600', 'brand-dark': '#cc5200' },
      spacing: { 13: 52, 14: 56 },
    },
  },
};
```

> **Auto-loaded:** `StyleProvider` automatically `require`s `rn-stylefn.config.js` from your project root — no manual import or prop needed. Just create the file and your tokens are available everywhere.

#### CSS Variable Expressions in Config

Theme values in `rn-stylefn.config.js` can reference CSS variables from `global.css` using standard CSS expression syntax. This enables a **Tailwind CSS-style** config where colors, sizes, and shadows are driven by CSS custom properties that change between light/dark mode:

```js
// rn-stylefn.config.js
module.exports = {
  theme: {
    // var() — resolves CSS variable, then parses as number
    borderRadius: {
      sm: 'calc(var(--radius) - 4px)', // → 4
      md: 'calc(var(--radius) - 2px)', // → 6
      lg: 'var(--radius)', // → 8
    },

    // hsl(var()) — resolves CSS variable, then converts HSL to hex
    colors: {
      border: 'hsl(var(--border))', // → '#e8e9eb'
      primary: {
        DEFAULT: 'hsl(var(--primary))', // → '#2662d9'
        foreground: 'hsl(var(--primary-foreground))', // → '#f5f7fa'
      },
    },

    // var() for shadows — resolves to boxShadow CSS string
    // boxShadow is a Tailwind-compatible alias for shadows
    boxShadow: {
      sm: 'var(--shadow-1)', // → { boxShadow: '0px 1px 2px ...' }
      md: 'var(--shadow-4)',
      lg: 'var(--shadow-8)',
    },
  },
};
```

**Supported CSS expression syntax:**

| Expression              | Example                       | Resolves to              |
| ----------------------- | ----------------------------- | ------------------------ |
| `var(--name)`           | `'var(--radius)'`             | Value from CSS variables |
| `var(--name, fallback)` | `'var(--radius, 8)'`          | Value with fallback      |
| `hsl(...)`              | `'hsl(220 13% 91%)'`          | Hex color string         |
| `hsl(var(--name))`      | `'hsl(var(--primary))'`       | HSL from CSS var → hex   |
| `calc(...)`             | `'calc(var(--radius) - 2px)'` | Evaluated number         |
| `rgb(...)`/`rgba(...)`  | `'rgb(59 130 246)'`           | Hex color string         |

**Nested color objects** (Tailwind convention) are automatically flattened:

```js
primary: {
  DEFAULT: 'hsl(var(--primary))',         // → t.theme.colors.primary
  foreground: 'hsl(var(--primary-foreground))', // → t.theme.colors['primary-foreground']
}
```

> **Color-scheme aware:** CSS variable expressions are resolved per color scheme — light mode uses `:root` variables, dark mode uses `.dark` variables. So `hsl(var(--primary))` resolves to different colors in light vs dark mode.

If you need to pass config **programmatically** (e.g. from a remote source), you can still use the `config` prop:

```tsx
<StyleProvider config={myDynamicConfig} insets={insets}>
```

Now your custom tokens are available in every style function:

```tsx
<Text
  style={(t) => ({
    color: t.theme.colors.brand, // '#ff6600'
    fontSize: t.theme.fontSize['3xl'], // 30
    padding: t.theme.spacing[8], // 32
  })}
/>
```

---

### Using `global.css`

Create a `global.css` in your project root to define your **light/dark color palette** and **design tokens**. Three approaches are supported — pick the one that fits your workflow:

#### Approach 1: shadcn/ui-style (Recommended — zero config needed)

CSS variables with color-like values are **automatically detected** and promoted to `t.colors.*`. Just paste your shadcn/ui CSS and everything works — **no `rn-stylefn.config.js` mapping required**:

```css
/* global.css — shadcn/ui style, works out of the box */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
  }
}
```

Then use directly — no config mapping needed:

```tsx
<View style={(t) => ({
  backgroundColor: t.colors.background,   // auto-detected from bare HSL
  borderColor: t.colors.border,           // auto-detected
})} />

<TextInput style={(t) => ({
  borderColor: t.colors.input,            // auto-detected
  color: t.colors.foreground,             // auto-detected
})} />
```

> **How auto-detection works:** The CSS parser scans all raw CSS variables and identifies values that look like colors — bare HSL values (`220 13% 91%`), hex colors (`#fff`), `hsl()`/`rgb()` functions. These are automatically converted to hex and made available as `t.colors.*`. Non-color values like `--radius: 8` and `--shadow-1: 0px 1px 2px...` are correctly excluded.

> **Supported CSS directives:**
>
> - `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;` — silently stripped (defaults are built in)
> - `@import ...;` — silently stripped (not applicable in RN)
> - `@layer base { ... }` — unwrapped so inner `:root`/`.dark` selectors are parsed normally

#### Approach 2: Explicit `--color-*` prefix (backward compatible)

Variables with the `--color-` prefix are mapped to `t.colors.*` with the prefix stripped:

```css
/* global.css */
:root {
  --color-background: #ffffff;
  --color-text: #111827;
  --color-primary: #3b82f6;
}
.dark {
  --color-background: #0f172a;
  --color-text: #f8fafc;
  --color-primary: #60a5fa;
}
```

```tsx
<Text style={(t) => ({ color: t.colors.text })} />
```

#### Approach 3: Config mapping with `hsl(var(...))` (full control)

Define raw HSL values in CSS and explicitly map them in `rn-stylefn.config.js`:

```css
/* global.css */
:root {
  --primary: 224 71% 51%;
  --primary-foreground: 210 20% 98%;
  --radius: 8;
}
```

```js
// rn-stylefn.config.js
module.exports = {
  theme: {
    colors: {
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
    },
  },
};
```

#### Combining all approaches

All three approaches work together. The merge priority (lowest → highest):

1. Built-in default colors
2. Auto-detected color vars (bare HSL, hex, etc.)
3. Config-mapped colors (`rn-stylefn.config.js`)
4. `--color-*` CSS variables

This means config mappings always override auto-detected values, and `--color-*` variables always win. You can use all three in the same project.

#### Full example with all variable types

```css
/* global.css */

:root {
  /* ---- Color palette (--color-* → t.colors.*) ---- */
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-border: #e2e8f0;
  --color-text: #0f172a;
  --color-text-muted: #64748b;
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;

  /* ---- Auto-detected colors (bare HSL → t.colors.*) ---- */
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 224 71% 51%;
  --primary: 224 71% 51%;
  --primary-foreground: 210 20% 98%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 221 39% 11%;
  --destructive: 0 84% 60%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;

  /* ---- Non-color tokens (for var() resolution in config) ---- */
  --radius: 8;
  --shadow-0: none;
  --shadow-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
  --shadow-4: 0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.dark {
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
  --color-primary: #60a5fa;
  --color-secondary: #a78bfa;

  --border: 215 28% 17%;
  --input: 215 28% 17%;
  --ring: 216 91% 70%;
  --primary: 216 91% 70%;
  --primary-foreground: 221 39% 11%;
  --secondary: 215 28% 17%;

  --radius: 8;
  --shadow-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.3);
  --shadow-4: 0px 4px 6px -1px rgba(0, 0, 0, 0.4), 0px 2px 4px -2px rgba(0, 0, 0, 0.3);
}
```

> **Auto-loaded:** When you set `input: './global.css'` in `withStyleFn()` (step 2 of Quick Start), Metro processes the CSS at build time and `StyleProvider` loads it automatically as a virtual module — no manual import or prop needed.

If you need to pass CSS variables **programmatically** (e.g. without Metro or from a dynamic source), you can still use the `cssVars` prop with `parseCSSVariables`:

```tsx
import { StyleProvider, parseCSSVariables } from 'react-native-stylefn';
import cssRaw from '../global.css'; // requires "*.css" in metro sourceExts

const cssVars = parseCSSVariables(cssRaw); // pre-parse once, outside component

export default function RootLayout() {
  const insets = useSafeAreaInsets();
  return (
    <StyleProvider cssVars={cssVars} insets={insets}>
      {/* your app */}
    </StyleProvider>
  );
}
```

Now use the colors in style functions:

```tsx
<View style={(t) => ({
  backgroundColor: t.colors.background,   // switches with dark mode
  borderColor: t.colors.border,
})} />

<Text style={(t) => ({
  color: t.colors.text,
  fontSize: t.theme.fontSize.base,
})} />
```

**Using both config and CSS variables together:**

Both are **auto-loaded** — no manual imports or props required. Just:

1. Create `rn-stylefn.config.js` at your project root
2. Set `input: './global.css'` in `withStyleFn()` in `metro.config.js`
3. Wrap your app with `<StyleProvider insets={insets}>`

`StyleProvider` automatically picks up both at runtime. Your theme tokens and CSS color variables are all available in every style function.

## How It Works

The library uses a **compile-time Babel transform** — no monkey-patching of `React.createElement` or `jsx`/`jsxs`:

```
                   Compile Time (Babel)                    Runtime
                   ────────────────────                    ───────

style={(t) => ({...})}                                     __resolveStyle calls
        │                                                  the function with
        ▼                                                  current tokens from
style={__resolveStyle((t) => ({...}))}                     the singleton store
```

### The Babel plugin does three things:

1. **Transforms JSX style props** — wraps function/array/variable expressions in `__resolveStyle()` at compile time. Plain object literals (`style={{ padding: 10 }}`) are left untouched.

2. **Transforms non-style token props** — detects arrow/function expressions in any non-callback prop (e.g. `width`, `height`, `columns`) and wraps them in `__resolveProp()`. Event handlers (`on*`), render props (`render*`), and known callbacks (`keyExtractor`, `ref`, etc.) are never touched.

3. **Injects `import 'react-native-stylefn/auto'`** — patches `StyleSheet.create` so it accepts style functions alongside static styles.

### At runtime:

- **`__resolveStyle(value)`** — if the value is a function, calls it with the current token store and resolves viewport units; if it's an array, maps over it resolving any functions; otherwise returns as-is.
- **`__resolveProp(value)`** — if the value is a function, calls it with the current token store and returns the raw result (no viewport unit conversion). Used for non-style props like `width`, `height`, `columns`.
- **`StyleProvider`** — subscribes to device state (dimensions, color scheme, accessibility) and updates the token store synchronously via `useMemo` so children always render with current values.
- **Token store** — a synchronous singleton, always readable from anywhere.

### Why not monkey-patch React.createElement?

Patching `React.createElement` or `jsx`/`jsxs` is fragile — it breaks with React Native's new architecture (Fabric/JSI), doesn't work with virtual modules (Expo polyfills), and creates circular dependency issues in monorepos. The compile-time Babel transform is simpler, more reliable, and has zero runtime overhead for non-function styles.

## Architecture

```
src/
├── resolve.ts         # __resolveStyle + __resolveProp — resolve style/prop functions
├── patch.ts           # patches StyleSheet.create only
├── auto.ts            # side-effect import that calls applyPatch()
├── store.ts           # singleton token store (get/set/subscribe)
├── provider.tsx       # StyleProvider — syncs device state into token store
├── create.ts          # StyleSheet.create replacement supporting style functions
├── config/
│   ├── defaults.ts    # built-in Tailwind-inspired theme defaults
│   ├── loader.ts      # config loading utility
│   ├── resolver.ts    # deep merge: defaults + user config + extend
│   └── cssParser.ts   # parses global.css variables
├── tokens/
│   ├── breakpoint.ts  # breakpoint queries (up/down) from screen width
│   ├── orientation.ts # portrait/landscape boolean flags
│   ├── platform.ts    # ios/android/web/windows/macos boolean flags
│   ├── accessibility.ts
│   └── index.ts       # assembles full StyleTokens
├── hooks/
│   ├── useStyleFn.ts  # access tokens in component logic
│   ├── useTheme.ts    # manual dark mode toggle
│   └── usePropsFn.ts  # resolve token functions in any prop
├── types.ts           # full TypeScript types (StyleTokens, PropFunction, etc.)
├── stylefn.d.ts       # type augmentation for RN components
└── index.tsx          # public exports

jsx-runtime/
├── index.js           # re-exports react/jsx-runtime
└── index.d.ts         # custom JSX types — widens all props to accept token fns

jsx-dev-runtime/
├── index.js           # re-exports react/jsx-dev-runtime
└── index.d.ts         # same as jsx-runtime (for development builds)

babel-plugin/
└── index.js           # compile-time transform (style + prop + auto-import)

scripts/
└── setup.js           # postinstall: patches RN's StyleProp type + tsconfig
```

## API Reference

### Exports from `react-native-stylefn`

| Export                | Description                                               |
| --------------------- | --------------------------------------------------------- |
| `StyleProvider`       | Provider component — wraps your app                       |
| `useStyleFn()`        | Access tokens in component logic                          |
| `useTheme()`          | Manual dark mode control                                  |
| `usePropsFn()`        | Resolve token functions in any prop (hook)                |
| `create()`            | StyleSheet.create replacement with style function support |
| `__resolveStyle()`    | Style resolver for style props (used by Babel plugin)     |
| `__resolveProp()`     | Prop resolver for non-style props (used by Babel plugin)  |
| `getTokenStore()`     | Direct access to the token store singleton                |
| `applyPatch()`        | Manually apply the StyleSheet.create patch                |
| `resolveConfig()`     | Resolve user config with defaults                         |
| `parseCSSVariables()` | Parse CSS variable file content                           |
| `defaultTheme`        | Built-in theme defaults                                   |
| `defaultConfig`       | Built-in config defaults                                  |
| `defaultCSSVariables` | Built-in CSS variable defaults                            |

### Types

| Type               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| `StyleTokens`      | Full token store shape passed to every token function                                  |
| `StyleFunction<S>` | Style function type: `(tokens: StyleTokens) => S`                                      |
| `StyleProp<S>`     | Style prop: static, function, or array of both                                         |
| `PropFunction<T>`  | A prop value that can be static or a token function: `T \| (tokens: StyleTokens) => T` |
| `TokenProp<T>`     | Alias for `PropFunction<T>` (from `usePropsFn`)                                        |
| `ThemeKeyRegistry` | Known theme key registry (extensible via module augmentation)                          |

### CSS Expression Utilities

| Export                       | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `resolveColorExpression()`   | Resolve `var()`, `hsl()`, `rgb()` in a color string |
| `resolveNumericExpression()` | Resolve `var()`, `calc()` in a numeric string       |
| `resolveShadowExpression()`  | Resolve `var()` in a shadow string                  |
| `resolveCssExpression()`     | Auto-detect and resolve any CSS expression          |
| `flattenColors()`            | Flatten nested Tailwind-style color objects         |
| `getRawVarsForScheme()`      | Get raw CSS vars map for a color scheme             |

## TypeScript Autocomplete for Theme Keys

All theme properties provide **autocomplete for known keys** out of the box:

```tsx
// ✅ Full autocomplete — IDE suggests 'sm', 'md', 'lg', 'xl', '2xl', 'full', 'none'
t.theme.borderRadius['lg'];

// ✅ Full autocomplete — IDE suggests '0', '1', '2', '3', '4', '5', '6', '8', '10', '12'
t.theme.spacing[4];

// ✅ Full autocomplete — IDE suggests 'primary', 'secondary', 'background', 'text', etc.
t.colors.primary;

// ✅ Full autocomplete — IDE suggests 'sm', 'md', 'lg', 'xl'
t.breakpoint.up('md');
```

Custom keys from your config also work — they just won't appear in autocomplete unless you extend `ThemeKeyRegistry`.

### Extending with Module Augmentation

To add autocomplete for **your own custom keys**, extend `ThemeKeyRegistry` via module augmentation:

```ts
// stylefn-env.d.ts (or any .d.ts file in your project)
declare module 'react-native-stylefn' {
  interface ThemeKeyRegistry {
    // Add your custom color keys
    color:
      | 'primary'
      | 'primary-foreground'
      | 'secondary'
      | 'secondary-foreground'
      | 'destructive'
      | 'destructive-foreground'
      | 'muted'
      | 'muted-foreground'
      | 'accent'
      | 'accent-foreground'
      | 'popover'
      | 'popover-foreground'
      | 'card'
      | 'card-foreground'
      | 'border'
      | 'input'
      | 'ring'
      | 'background'
      | 'foreground';

    // Add custom shadow keys
    shadow:
      | 'none'
      | 'sm'
      | 'md'
      | 'lg'
      | 'xl'
      | '2xl'
      | 'elevation-none'
      | 'elevation-low'
      | 'elevation-medium'
      | 'elevation-high';

    // Add custom spacing keys
    spacing:
      | '0'
      | '1'
      | '2'
      | '3'
      | '4'
      | '5'
      | '6'
      | '8'
      | '10'
      | '12'
      | '14'
      | '16';
  }
}
```

Now your IDE suggests all your custom keys everywhere!

## License

MIT
