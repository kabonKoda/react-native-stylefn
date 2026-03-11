/**
 * react-native-stylefn configuration
 *
 * Theme values can use CSS expressions that reference variables from global.css:
 *   - var(--name)                   → resolves to the CSS variable value
 *   - hsl(var(--primary))           → resolves var, then converts HSL to hex
 *   - calc(var(--radius) - 2px)     → resolves var, then evaluates arithmetic
 *   - var(--shadow-4)               → resolves to the shadow CSS string
 *
 * Nested color objects (Tailwind convention) are also supported:
 *   primary: { DEFAULT: '...', foreground: '...' }
 *   → flattened to: primary: '...', 'primary-foreground': '...'
 */
module.exports = {
  theme: {
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
    fontSize: {
      'xs': 10,
      'sm': 12,
      'base': 14,
      'lg': 16,
      'xl': 20,
      '2xl': 24,
      '3xl': 30,
    },
    borderRadius: {
      'none': 0,
      'sm': 'calc(var(--radius) - 4px)',
      'md': 'calc(var(--radius) - 2px)',
      'lg': 'var(--radius)',
      'xl': 16,
      '2xl': 24,
      'full': 9999,
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    opacity: {
      0: 0,
      25: 0.25,
      50: 0.5,
      75: 0.75,
      100: 1,
    },
    screens: {
      sm: 0,
      md: 375,
      lg: 430,
      xl: 768,
    },
    colors: {
      // Nested color objects (Tailwind convention) — automatically flattened
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      secondary: {
        DEFAULT: 'hsl(var(--secondary))',
        foreground: 'hsl(var(--secondary-foreground))',
      },
      destructive: {
        DEFAULT: 'hsl(var(--destructive))',
        foreground: 'hsl(var(--destructive-foreground))',
      },
      muted: {
        DEFAULT: 'hsl(var(--muted))',
        foreground: 'hsl(var(--muted-foreground))',
      },
      accent: {
        DEFAULT: 'hsl(var(--accent))',
        foreground: 'hsl(var(--accent-foreground))',
      },
      popover: {
        DEFAULT: 'hsl(var(--popover))',
        foreground: 'hsl(var(--popover-foreground))',
      },
      card: {
        DEFAULT: 'hsl(var(--card))',
        foreground: 'hsl(var(--card-foreground))',
      },
      // Plain colors still work
      danger: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
    },
    // boxShadow is a Tailwind-compatible alias for shadows
    // String values are auto-wrapped as { boxShadow: value }
    boxShadow: {
      'none': 'var(--shadow-0)',
      'sm': 'var(--shadow-1)',
      'DEFAULT': 'var(--shadow-2)',
      'md': 'var(--shadow-4)',
      'lg': 'var(--shadow-8)',
      'xl': 'var(--shadow-12)',
      '2xl': 'var(--shadow-16)',
      // Elevation aliases
      'elevation-none': 'var(--shadow-0)',
      'elevation-low': 'var(--shadow-2)',
      'elevation-medium': 'var(--shadow-4)',
      'elevation-high': 'var(--shadow-8)',
    },
    extend: {
      borderRadius: {
        '3xl': 60
      }
    },
  },
  darkMode: 'system',
};
