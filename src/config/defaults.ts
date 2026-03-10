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
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 15,
      elevation: 6,
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
    background: '#ffffff',
    surface: '#f5f5f5',
    border: '#e5e7eb',
    text: '#111827',
    'text-muted': '#6b7280',
    primary: '#3b82f6',
  },
  dark: {
    background: '#0f172a',
    surface: '#1e293b',
    border: '#334155',
    text: '#f8fafc',
    'text-muted': '#94a3b8',
    primary: '#60a5fa',
  },
};
