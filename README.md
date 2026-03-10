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

The postinstall script automatically patches React Native's `StyleProp` type so that **every component** accepts style functions — no manual type configuration needed.

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
  padding: t.breakpoint === 'lg' ? 24 : 12,
  flexDirection: t.orientation === 'landscape' ? 'row' : 'column',
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
  (t) => t.breakpoint === 'sm' && { padding: 8 },
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

## How Types Work — Universal & Automatic

When you install `react-native-stylefn`, the **postinstall script** automatically patches React Native's `StyleProp<T>` type definition to include style functions:

```ts
// Before (RN's original type):
type StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>>;

// After (patched by react-native-stylefn):
type StyleProp<T> = null | void | T | false | "" | ReadonlyArray<StyleProp<T>>
  | ((tokens: StyleTokens) => T | false | null | undefined);
```

Since **every** React Native component uses `StyleProp` for its style props, this single patch makes style functions work everywhere — View, Text, ScrollView, FlatList, third-party components, custom components — any prop typed as `StyleProp`.

You can also run the setup manually:
```bash
npx react-native-stylefn setup
```

## Token Reference

Every style function receives a `StyleTokens` object:

| Token | Type | Description |
|-------|------|-------------|
| `theme` | `object` | Full resolved theme (spacing, fontSize, borderRadius, fontWeight, colors, shadows, opacity) |
| `colors` | `Record<string, string>` | Resolved color palette for the current color scheme |
| `dark` | `boolean` | Whether dark mode is active |
| `colorScheme` | `'light' \| 'dark'` | Current color scheme |
| `breakpoint` | `'sm' \| 'md' \| 'lg' \| 'xl'` | Current responsive breakpoint |
| `screen` | `{ width, height, scale, fontScale }` | Screen dimensions |
| `orientation` | `'portrait' \| 'landscape'` | Device orientation |
| `platform` | `'ios' \| 'android' \| 'web'` | Current platform |
| `insets` | `{ top, bottom, left, right }` | Safe area insets |
| `reducedMotion` | `boolean` | User prefers reduced motion |
| `fontScale` | `number` | Current font scale multiplier |
| `boldText` | `boolean` | Bold text enabled (iOS) |
| `highContrast` | `boolean` | High contrast enabled |

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

Create a `global.css` in your project root to define your **light/dark color palette**. These map to `t.colors.*` tokens:

```css
/* global.css */

:root {
  /* Light mode colors */
  --color-background:   #ffffff;
  --color-surface:      #f8fafc;
  --color-border:       #e2e8f0;
  --color-text:         #0f172a;
  --color-text-muted:   #64748b;
  --color-primary:      #3b82f6;
  --color-secondary:    #8b5cf6;
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
}
```

> **Variable naming**: Use `--color-<name>` format. The `--color-` prefix is stripped so `--color-text` becomes `t.colors.text`, `--color-text-muted` becomes `t.colors['text-muted']`.

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

### The Babel plugin does two things:

1. **Transforms JSX style props** — wraps function/array/variable expressions in `__resolveStyle()` at compile time. Plain object literals (`style={{ padding: 10 }}`) are left untouched.

2. **Injects `import 'react-native-stylefn/auto'`** — patches `StyleSheet.create` so it accepts style functions alongside static styles.

### At runtime:

- **`__resolveStyle(value)`** — if the value is a function, calls it with the current token store; if it's an array, maps over it resolving any functions; otherwise returns as-is.
- **`StyleProvider`** — subscribes to device state (dimensions, color scheme, accessibility) and updates the token store synchronously via `useMemo` so children always render with current values.
- **Token store** — a synchronous singleton, always readable from anywhere.

### Why not monkey-patch React.createElement?

Patching `React.createElement` or `jsx`/`jsxs` is fragile — it breaks with React Native's new architecture (Fabric/JSI), doesn't work with virtual modules (Expo polyfills), and creates circular dependency issues in monorepos. The compile-time Babel transform is simpler, more reliable, and has zero runtime overhead for non-function styles.

## Architecture

```
src/
├── resolve.ts         # __resolveStyle — called at render time to resolve functions
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
│   ├── breakpoint.ts  # sm/md/lg/xl from screen width
│   ├── orientation.ts # portrait/landscape
│   ├── accessibility.ts
│   └── index.ts       # assembles full StyleTokens
├── hooks/
│   ├── useStyleFn.ts  # access tokens in component logic
│   └── useTheme.ts    # manual dark mode toggle
├── types.ts           # full TypeScript types
├── stylefn.d.ts       # type augmentation for RN components
└── index.tsx          # public exports

babel-plugin/
└── index.js           # compile-time transform + auto-import injection

scripts/
└── setup.js           # postinstall: patches RN's StyleProp type
```

## API Reference

### Exports from `react-native-stylefn`

| Export | Description |
|--------|-------------|
| `StyleProvider` | Provider component — wraps your app |
| `useStyleFn()` | Access tokens in component logic |
| `useTheme()` | Manual dark mode control |
| `create()` | StyleSheet.create replacement with style function support |
| `__resolveStyle()` | Style resolver (used by Babel plugin, can be used manually) |
| `getTokenStore()` | Direct access to the token store singleton |
| `applyPatch()` | Manually apply the StyleSheet.create patch |
| `resolveConfig()` | Resolve user config with defaults |
| `parseCSSVariables()` | Parse CSS variable file content |
| `defaultTheme` | Built-in theme defaults |
| `defaultConfig` | Built-in config defaults |
| `defaultCSSVariables` | Built-in CSS variable defaults |

## License

MIT
