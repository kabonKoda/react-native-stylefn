import type { DeviceTokens } from '../types';

/**
 * Shape of the expo-device module we consume.
 * Declared here to avoid a hard dependency on expo-device types.
 */
interface ExpoDeviceModule {
  isDevice: boolean;
  brand: string | null;
  manufacturer: string | null;
  modelName: string | null;
  modelId: string | null;
  deviceYearClass: number | null;
  totalMemory: number | null;
  osName: string | null;
  osVersion: string | null;
  osBuildId: string | null;
  deviceName: string | null;
  deviceType: number | null;
  DeviceType: {
    UNKNOWN: number;
    PHONE: number;
    TABLET: number;
    DESKTOP: number;
    TV: number;
  };
}

/**
 * Safely attempt to require expo-device.
 * Returns null if expo-device is not installed.
 */
let ExpoDevice: ExpoDeviceModule | null = null;
try {
  ExpoDevice = require('expo-device') as ExpoDeviceModule;
} catch {
  ExpoDevice = null;
}

/**
 * Default device tokens when expo-device is not available.
 */
export const defaultDevice: DeviceTokens = {
  isDevice: true,
  brand: null,
  manufacturer: null,
  modelName: null,
  modelId: null,
  deviceYearClass: null,
  totalMemory: null,
  osName: null,
  osVersion: null,
  osBuildId: null,
  deviceName: null,
  deviceType: null,
  isPhone: false,
  isTablet: false,
  isDesktop: false,
  isTV: false,
};

/**
 * Derives device information from expo-device.
 *
 * If expo-device is not installed, returns safe defaults.
 *
 * @example
 * ```tsx
 * t.device.isTablet   // true on tablet devices
 * t.device.brand      // "Apple", "Samsung", etc.
 * t.device.modelName  // "iPhone 15 Pro", "Pixel 8", etc.
 * t.device.isDevice   // false in simulator/emulator
 * ```
 */
export function deriveDevice(): DeviceTokens {
  if (!ExpoDevice) {
    return defaultDevice;
  }

  // expo-device DeviceType enum values:
  // 0 = UNKNOWN, 1 = PHONE, 2 = TABLET, 3 = DESKTOP, 4 = TV
  const deviceType = ExpoDevice.deviceType;

  return {
    isDevice: ExpoDevice.isDevice ?? true,
    brand: ExpoDevice.brand ?? null,
    manufacturer: ExpoDevice.manufacturer ?? null,
    modelName: ExpoDevice.modelName ?? null,
    modelId: ExpoDevice.modelId ?? null,
    deviceYearClass: ExpoDevice.deviceYearClass ?? null,
    totalMemory: ExpoDevice.totalMemory ?? null,
    osName: ExpoDevice.osName ?? null,
    osVersion: ExpoDevice.osVersion ?? null,
    osBuildId: ExpoDevice.osBuildId ?? null,
    deviceName: ExpoDevice.deviceName ?? null,
    deviceType: deviceType ?? null,
    isPhone: deviceType === ExpoDevice.DeviceType.PHONE,
    isTablet: deviceType === ExpoDevice.DeviceType.TABLET,
    isDesktop: deviceType === ExpoDevice.DeviceType.DESKTOP,
    isTV: deviceType === ExpoDevice.DeviceType.TV,
  };
}
