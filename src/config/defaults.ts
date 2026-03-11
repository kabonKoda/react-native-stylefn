import type { ThemeConfig, StyleFnConfig, CSSVariables } from '../types';

/**
 * Default theme tokens — sensible out-of-the-box values inspired by Tailwind.
 */
export const defaultTheme: ThemeConfig = {
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
    'sm': 4,
    'md': 8,
    'lg': 12,
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
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    danger: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
  },
  shadows: {
    sm: {
      boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    },
    md: {
      boxShadow:
        '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
    },
    lg: {
      boxShadow:
        '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
    },
  },
};

/**
 * Default configuration.
 */
export const defaultConfig: StyleFnConfig = {
  theme: defaultTheme,
  darkMode: 'system',
};

/**
 * Default CSS variables (light/dark palettes).
 */
export const defaultCSSVariables: CSSVariables = {
  light: {
    'background': '#ffffff',
    'surface': '#f5f5f5',
    'border': '#e5e7eb',
    'text': '#111827',
    'text-muted': '#6b7280',
    'primary': '#3b82f6',
  },
  dark: {
    'background': '#0f172a',
    'surface': '#1e293b',
    'border': '#334155',
    'text': '#f8fafc',
    'text-muted': '#94a3b8',
    'primary': '#60a5fa',
  },
  rawVars: {
    light: {
      'color-background': '#ffffff',
      'color-surface': '#f5f5f5',
      'color-border': '#e5e7eb',
      'color-text': '#111827',
      'color-text-muted': '#6b7280',
      'color-primary': '#3b82f6',
    },
    dark: {
      'color-background': '#0f172a',
      'color-surface': '#1e293b',
      'color-border': '#334155',
      'color-text': '#f8fafc',
      'color-text-muted': '#94a3b8',
      'color-primary': '#60a5fa',
    },
  },
};
