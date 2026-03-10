/**
 * Accessibility token defaults.
 *
 * These are resolved from platform APIs in the provider.
 * This module provides the fallback defaults.
 */
export interface AccessibilityTokens {
  reducedMotion: boolean;
  fontScale: number;
  boldText: boolean;
  highContrast: boolean;
}

export const defaultAccessibility: AccessibilityTokens = {
  reducedMotion: false,
  fontScale: 1,
  boldText: false,
  highContrast: false,
};
