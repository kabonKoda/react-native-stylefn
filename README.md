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

The postinstall script automatically:
1. **Patches React Native's `StyleProp` type** so every component accepts style functions
2. **Adds `jsxImportSource` to your tsconfig.json** so all component props accept token functions `(tokens) => value` — no `PropFunction<T>` annotations needed

## Quick Start

### 1. Add the Babel plugin

```js
// babel.config.js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-stylefn/babel-plugin'],
};
```

### 2. Add the Metro config wrapper

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withStyleFn } = require('react-native-stylefn/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = withStyleFn(config, {
  input: './global.css',  // your CSS variables file (optional)
});
```

### 3. Wrap your app with `StyleProvider`

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

### 4. Write style functions

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

### 5. Mix functions and objects in arrays

```tsx
<View style={[
  { flex: 1 },
  (t) => ({ backgroundColor: t.dark ? '#000' : '#fff' }),
  (t) => t.breakpoint.down('md') && { padding: 8 },
]} />
```

### 6. Use with `StyleSheet.create`

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
</View>
```

### 7. Use with Reanimated

```tsx
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useStyleFn } from 'react-native-stylefn';

function AnimatedCard() {
  const { colors, theme, dark } = useStyleFn();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={() => { scale.value = withSpring(0.95); }}>
      <Animated.View style={[
        {
          backgroundColor: dark ? '#1e293b' : colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
        },
        animatedStyle,
      ]} />
    </Pressable>
  );
}
```

### 8. Build custom components with style functions

```tsx
import { useStyleFn } from 'react-native-stylefn';

function StyledCard({ style, children }) {
  const tokens = useStyleFn();

  // Resolve: if style is a function, call it with tokens
  const resolvedStyle = typeof style === 'function' ? style(tokens) : style;

  return <View style={resolvedStyle}>{children}</View>;
}

// Usage
<StyledCard style={(t) => ({
  backgroundColor: t.colors.surface,
  padding: t.theme.spacing[4],
  borderRadius: t.theme.borderRadius.lg,
})}>
  <Text>Custom component with style functions</Text>
</StyledCard>
```

### 9. Token functions in ANY prop (not just style)

Token functions aren't limited to `style` props — you can use them in **any** prop that accepts a value. The Babel plugin automatically detects arrow functions in non-callback props and resolves them with the current tokens.

**No special types needed!** Your component can declare plain types like `width: number` and consumers can still pass token functions. The custom JSX runtime handles TypeScript automatically.

```tsx
// Component uses plain types — no PropFunction<T> needed:
function ResponsiveBox({ width, height, color }: { width: number; height: number; color: string }) {
  return <View style={{ width, height, backgroundColor: color }} />;
}

// ✅ Consumers pass token functions — TypeScript is happy, Babel resolves at runtime:
<ResponsiveBox
  width={({ orientation }) => orientation.landscape ? 200 : 120}
  height={80}
  color={({ dark }) => dark ? '#3b82f6' : '#2563eb'}
/>
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

### 10. `usePropsFn` hook — resolve multiple token props at once

For cases where you need explicit control, or when building wrapper components that pass resolved values to third-party libraries, use the `usePropsFn` hook:

```tsx
import { usePropsFn } from 'react-native-stylefn';

function StrokePreview({ brushState, isEraser }) {
  const { width, height, columns } = usePropsFn({
    width: ({ orientation }) => orientation.landscape ? 266 : 200,
    height: 180,  // static values pass through unchanged
    columns: ({ breakpoint }) => breakpoint.up('lg') ? 3 : 2,
  });

  return <Canvas width={width} height={height} columns={columns} />;
}
```

```tsx
// Great for third-party components that don't go through the Babel plugin
function ResponsiveSlider() {
  const { sliderWidth, thumbSize, trackHeight } = usePropsFn({
    sliderWidth: ({ screen }) => screen.width - 32,
    thumbSize: ({ breakpoint }) => breakpoint.up('md') ? 24 : 16,
    trackHeight: ({ breakpoint }) => breakpoint.up('md') ? 6 : 4,
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
    panelWidth: ({ orientation }) => orientation.landscape ? 360 : 280,
    swatchSize: ({ breakpoint }) => breakpoint.up('lg') ? 32 : 26,
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

### 11. `PropFunction<T>` (optional — for explicit typing)

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

## How Types Work — Universal & Automatic

The type system works through **two complementary mechanisms**, both set up automatically by the postinstall script:

### 1. Style Props — `StyleProp<T>` patching

The postinstall script patches React Native's `StyleProp<T>` type definition to include style functions:

```ts
// Before (RN's original type):
type StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>>;

// After (patched by react-native-stylefn):
type StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>>
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

| Token | Type | Description |
|-------|------|-------------|
| `theme` | `object` | Full resolved theme (spacing, fontSize, borderRadius, fontWeight, colors, shadows, opacity) |
| `colors` | `Record<string, string>` | Resolved color palette for the current color scheme |
| `dark` | `boolean` | Whether dark mode is active |
| `colorScheme` | `'light' \| 'dark'` | Current color scheme |
| `breakpoint` | `BreakpointQuery` | Breakpoint queries: `.current`, `.up(name)`, `.down(name)` |
| `screen` | `{ width, height, scale, fontScale }` | Screen dimensions |
| `orientation` | `OrientationTokens` | Boolean flags: `.landscape`, `.portrait` |
| `platform` | `PlatformTokens` | Boolean flags: `.ios`, `.android`, `.web`, `.windows`, `.macos` |
| `insets` | `{ top, bottom, left, right }` | Safe area insets |
| `reducedMotion` | `boolean` | User prefers reduced motion |
| `fontScale` | `number` | Current font scale multiplier |
| `boldText` | `boolean` | Bold text enabled (iOS) |
| `highContrast` | `boolean` | High contrast enabled |

### Breakpoint Queries

```tsx
// t.breakpoint.current → 'sm' | 'md' | 'lg' | 'xl' (active breakpoint name)
// t.breakpoint.up('md')  → true when screen width >= md threshold (375dp)
// t.breakpoint.down('lg') → true when screen width < lg threshold (430dp)

<View style={(t) => ({
  padding: t.breakpoint.up('lg') ? 24 : 12,
  flexDirection: t.breakpoint.up('xl') ? 'row' : 'column',
})} />
```

### Orientation Booleans

```tsx
// t.orientation.landscape → true when width >= height
// t.orientation.portrait  → true when height > width

<View style={(t) => ({
  flexDirection: t.orientation.landscape ? 'row' : 'column',
})} />
```

### Platform Booleans

```tsx
// t.platform.ios     → true on iOS
// t.platform.android → true on Android
// t.platform.web     → true on Web
// t.platform.windows → true on Windows
// t.platform.macos   → true on macOS

<View style={(t) => ({
  paddingTop: t.platform.ios ? 44 : 0,
  fontFamily: t.platform.ios ? 'SF Pro' : 'Roboto',
})} />
```

### Shadow Tokens

Shadows use the `boxShadow` CSS string format (supported in React Native 0.76+):

```tsx
<View style={(t) => ({
  ...t.theme.shadows.md,
  // Expands to: { boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), ...' }
})} />
```

## Hooks

### `useStyleFn()`

Access tokens inside component logic, event handlers, or animations:

```tsx
import { useStyleFn } from 'react-native-stylefn';

function MyComponent() {
  const { dark, colors, breakpoint, theme } = useStyleFn();

  return (
    <Pressable onPress={() => analytics.track('tap', { theme: dark ? 'dark' : 'light' })}>
      <Text style={{ color: colors.text, fontSize: theme.fontSize.base }}>Hello</Text>
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
    width: ({ orientation }) => orientation.landscape ? 360 : 280,
    height: 180,  // static values pass through unchanged
    columns: ({ breakpoint }) => breakpoint.up('lg') ? 3 : 2,
  });

  return <Grid width={width} height={height} columns={columns} />;
}
```

This is especially useful for passing resolved values to third-party components that don't go through the Babel plugin.

## Configuration

### `StyleProvider` Props

```tsx
<StyleProvider
  config={{ darkMode: 'system', theme: { /* overrides */ } }}
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
      0: 0, 1: 4, 2: 8, 3: 12, 4: 16,
      5: 20, 6: 24, 8: 32, 10: 40, 12: 48,
    },
    // Override font sizes
    fontSize: {
      xs: 10, sm: 12, base: 14, lg: 16,
      xl: 20, '2xl': 24, '3xl': 30,
    },
    // Override border radii
    borderRadius: {
      none: 0, sm: 4, md: 8, lg: 12,
      xl: 16, '2xl': 24, full: 9999,
    },
    // Override font weights
    fontWeight: {
      normal: '400', medium: '500', semibold: '600', bold: '700',
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
      colors: { brand: '#ff6600', 'brand-dark': '#cc5200' },
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
      sm: 'calc(var(--radius) - 4px)',   // → 4
      md: 'calc(var(--radius) - 2px)',   // → 6
      lg: 'var(--radius)',               // → 8
    },

    // hsl(var()) — resolves CSS variable, then converts HSL to hex
    colors: {
      border: 'hsl(var(--border))',           // → '#e8e9eb'
      primary: {
        DEFAULT: 'hsl(var(--primary))',       // → '#2662d9'
        foreground: 'hsl(var(--primary-foreground))', // → '#f5f7fa'
      },
    },

    // var() for shadows — resolves to boxShadow CSS string
    // boxShadow is a Tailwind-compatible alias for shadows
    boxShadow: {
      sm: 'var(--shadow-1)',    // → { boxShadow: '0px 1px 2px ...' }
      md: 'var(--shadow-4)',
      lg: 'var(--shadow-8)',
    },
  },
};
```

**Supported CSS expression syntax:**

| Expression | Example | Resolves to |
|------------|---------|-------------|
| `var(--name)` | `'var(--radius)'` | Value from CSS variables |
| `var(--name, fallback)` | `'var(--radius, 8)'` | Value with fallback |
| `hsl(...)` | `'hsl(220 13% 91%)'` | Hex color string |
| `hsl(var(--name))` | `'hsl(var(--primary))'` | HSL from CSS var → hex |
| `calc(...)` | `'calc(var(--radius) - 2px)'` | Evaluated number |
| `rgb(...)`/`rgba(...)` | `'rgb(59 130 246)'` | Hex color string |

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
<Text style={(t) => ({
  color: t.theme.colors.brand,        // '#ff6600'
  fontSize: t.theme.fontSize['3xl'],  // 30
  padding: t.theme.spacing[8],        // 32
})} />
```

---

### Using `global.css`

Create a `global.css` in your project root to define your **light/dark color palette** and **design tokens**. Two naming conventions are supported:

```css
/* global.css */

:root {
  /* ---- Color palette (--color-* → t.colors.*) ---- */
  --color-background:   #ffffff;
  --color-surface:      #f8fafc;
  --color-border:       #e2e8f0;
  --color-text:         #0f172a;
  --color-text-muted:   #64748b;
  --color-primary:      #3b82f6;
  --color-secondary:    #8b5cf6;

  /* ---- Generic variables (for var() resolution in config) ---- */
  /* HSL color values — use with hsl(var(--primary)) in config */
  --border:                220 13% 91%;
  --primary:               224 71% 51%;
  --primary-foreground:    210 20% 98%;
  --secondary:             220 14% 96%;
  --secondary-foreground:  221 39% 11%;
  --destructive:           0 84% 60%;
  --muted:                 220 14% 96%;
  --muted-foreground:      220 9% 46%;

  /* Design tokens — use with var(--radius), calc(var(--radius) - 2px) */
  --radius: 8;

  /* Shadow levels — use with var(--shadow-N) in config */
  --shadow-0: none;
  --shadow-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
  --shadow-4: 0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1);
}

.dark {
  /* Dark mode colors */
  --color-background:   #0f172a;
  --color-surface:      #1e293b;
  --color-border:       #334155;
  --color-text:         #f1f5f9;
  --color-text-muted:   #94a3b8;
  --color-primary:      #60a5fa;
  --color-secondary:    #a78bfa;

  /* Dark mode HSL overrides */
  --border:                215 28% 17%;
  --primary:               216 91% 70%;
  --primary-foreground:    221 39% 11%;
  --secondary:             215 28% 17%;

  --radius: 8;
  --shadow-1: 0px 1px 2px 0px rgba(0, 0, 0, 0.3);
  --shadow-4: 0px 4px 6px -1px rgba(0, 0, 0, 0.4), 0px 2px 4px -2px rgba(0, 0, 0, 0.3);
}
```

> **Variable naming**:
> - `--color-<name>` format: The `--color-` prefix is stripped, so `--color-text` → `t.colors.text`
> - `--<name>` format: Available for `var(--<name>)` resolution in config values. Both are stored in `rawVars` for CSS expression resolution.

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

| Export | Description |
|--------|-------------|
| `StyleProvider` | Provider component — wraps your app |
| `useStyleFn()` | Access tokens in component logic |
| `useTheme()` | Manual dark mode control |
| `usePropsFn()` | Resolve token functions in any prop (hook) |
| `create()` | StyleSheet.create replacement with style function support |
| `__resolveStyle()` | Style resolver for style props (used by Babel plugin) |
| `__resolveProp()` | Prop resolver for non-style props (used by Babel plugin) |
| `getTokenStore()` | Direct access to the token store singleton |
| `applyPatch()` | Manually apply the StyleSheet.create patch |
| `resolveConfig()` | Resolve user config with defaults |
| `parseCSSVariables()` | Parse CSS variable file content |
| `defaultTheme` | Built-in theme defaults |
| `defaultConfig` | Built-in config defaults |
| `defaultCSSVariables` | Built-in CSS variable defaults |

### Types

| Type | Description |
|------|-------------|
| `StyleTokens` | Full token store shape passed to every token function |
| `StyleFunction<S>` | Style function type: `(tokens: StyleTokens) => S` |
| `StyleProp<S>` | Style prop: static, function, or array of both |
| `PropFunction<T>` | A prop value that can be static or a token function: `T \| (tokens: StyleTokens) => T` |
| `TokenProp<T>` | Alias for `PropFunction<T>` (from `usePropsFn`) |
| `ThemeKeyRegistry` | Known theme key registry (extensible via module augmentation) |

### CSS Expression Utilities

| Export | Description |
|--------|-------------|
| `resolveColorExpression()` | Resolve `var()`, `hsl()`, `rgb()` in a color string |
| `resolveNumericExpression()` | Resolve `var()`, `calc()` in a numeric string |
| `resolveShadowExpression()` | Resolve `var()` in a shadow string |
| `resolveCssExpression()` | Auto-detect and resolve any CSS expression |
| `flattenColors()` | Flatten nested Tailwind-style color objects |
| `getRawVarsForScheme()` | Get raw CSS vars map for a color scheme |

## TypeScript Autocomplete for Theme Keys

All theme properties provide **autocomplete for known keys** out of the box:

```tsx
// ✅ Full autocomplete — IDE suggests 'sm', 'md', 'lg', 'xl', '2xl', 'full', 'none'
t.theme.borderRadius['lg']

// ✅ Full autocomplete — IDE suggests '0', '1', '2', '3', '4', '5', '6', '8', '10', '12'
t.theme.spacing[4]

// ✅ Full autocomplete — IDE suggests 'primary', 'secondary', 'background', 'text', etc.
t.colors.primary

// ✅ Full autocomplete — IDE suggests 'sm', 'md', 'lg', 'xl'
t.breakpoint.up('md')
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
      | 'primary' | 'primary-foreground'
      | 'secondary' | 'secondary-foreground'
      | 'destructive' | 'destructive-foreground'
      | 'muted' | 'muted-foreground'
      | 'accent' | 'accent-foreground'
      | 'popover' | 'popover-foreground'
      | 'card' | 'card-foreground'
      | 'border' | 'input' | 'ring'
      | 'background' | 'foreground';

    // Add custom shadow keys
    shadow: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
      | 'elevation-none' | 'elevation-low' | 'elevation-medium' | 'elevation-high';

    // Add custom spacing keys
    spacing: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '14' | '16';
  }
}
```

Now your IDE suggests all your custom keys everywhere!

## License

MIT
