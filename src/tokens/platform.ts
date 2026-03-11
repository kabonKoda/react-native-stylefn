import { Platform } from 'react-native';
import type { PlatformTokens } from '../types';

/**
 * Derives platform boolean flags from the current Platform.OS.
 */
export function derivePlatform(): PlatformTokens {
  const os = Platform.OS ?? 'ios';
  return {
    ios: os === 'ios',
    android: os === 'android',
    web: os === 'web',
    windows: os === 'windows',
    macos: os === 'macos',
  };
}
