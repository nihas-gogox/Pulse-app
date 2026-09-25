/**
 * Driver pilot levels and preset avatars (reference: Qu Tactical Hub).
 * Used for Pilot Card, Rank Path Progression, and onboarding.
 *
 * IMPORTANT: Do NOT statically import `UserAvatars` here. Map markers import
 * `resolveDriverAvatarImageSource` from this module — eagerly requiring all
 * 64+ user avatar PNGs on that path blanks Expo Go maps (react-native-maps).
 * User catalog is loaded lazily only when resolving a `user-*` seed.
 */

import { type ImageSourcePropType } from 'react-native';
import {
  getPresetAvatarUri,
  type PresetAvatar,
} from './presetAvatar';

export type { PresetAvatar } from './presetAvatar';
export { getPresetAvatarUri } from './presetAvatar';

export const DEFAULT_DRIVER_AVATAR_SEED = 'driver-1';

export const LEVELS_CONFIG = [
  { level: 1, name: 'Initiate', goalText: 'Complete Signup', type: 'signup', target: 1, privilege: 'Access Hub', tier: 'Bronze' },
  { level: 2, name: 'Novice', goalText: 'Complete 2 Trips', type: 'trips', target: 2, privilege: 'Standard Trips', tier: 'Bronze' },
  { level: 3, name: 'Verified', goalText: 'Verify Identity', type: 'verification', target: 1, privilege: 'Silver Status', tier: 'Silver' },
  { level: 4, name: 'Trusted', goalText: 'Earn 2 Five-Star Ratings', type: 'ratings', target: 2, privilege: 'Priority Support', tier: 'Silver' },
  { level: 5, name: 'Navigator', goalText: 'Complete 10 Trips', type: 'trips', target: 10, privilege: 'Grid Boost', tier: 'Silver' },
  { level: 6, name: 'Veteran', goalText: 'Complete 25 Trips', type: 'trips', target: 25, privilege: 'Tier-1 Settlements', tier: 'Silver' },
  { level: 7, name: 'Elite', goalText: 'Get 10 Five-Star Ratings', type: 'ratings', target: 10, privilege: 'Hot Request Lock', tier: 'Silver' },
  { level: 8, name: 'Gold', goalText: 'Get 20 Five-Star Ratings', type: 'ratings', target: 20, privilege: 'Gold Yield (+5%)', tier: 'Gold' },
] as const;

const driver1 = require('@/assets/drivers/driver-1.png');
const driver2 = require('@/assets/drivers/driver-2.png');
const driver3 = require('@/assets/drivers/driver-3.png');
const driver4 = require('@/assets/drivers/driver-4.png');
const driver5 = require('@/assets/drivers/driver-5.png');
const driver6 = require('@/assets/drivers/driver-6.png');
const driver7 = require('@/assets/drivers/driver-7.png');
const driver8 = require('@/assets/drivers/driver-8.png');
const driver9 = require('@/assets/drivers/driver-9.png');
const driver10 = require('@/assets/drivers/driver-10.png');

/** Core driver mascot presets (bundled in assets/drivers). */
export const DRIVER_PRESET_AVATARS: PresetAvatar[] = [
  { name: 'Happy Captain', seed: 'driver-1', image: driver1 },
  { name: 'Trusty Veteran', seed: 'driver-2', image: driver2 },
  { name: 'Modern Rider', seed: 'driver-3', image: driver3 },
  { name: 'The Chauffeur', seed: 'driver-4', image: driver4 },
  { name: 'Swift Sister', seed: 'driver-5', image: driver5 },
  { name: 'Express Pilot', seed: 'driver-6', image: driver6 },
  { name: 'Safety First', seed: 'driver-7', image: driver7 },
  { name: 'The Legend', seed: 'driver-8', image: driver8 },
  { name: 'Urban Guru', seed: 'driver-9', image: driver9 },
  { name: 'Friendly Fellow', seed: 'driver-10', image: driver10 },
];

/**
 * Default catalog for profile pickers / hash fallbacks = driver mascots only.
 * Signup / expanded pickers should use `getSignupPresetAvatars()`.
 */
export const ALL_PRESET_AVATARS: PresetAvatar[] = DRIVER_PRESET_AVATARS;

let signupCatalogCache: PresetAvatar[] | null = null;

/** Drivers + full `assets/avatars` catalog (lazy — safe for signup UI, not map markers). */
export function getSignupPresetAvatars(): PresetAvatar[] {
  if (signupCatalogCache) return signupCatalogCache;
  // Lazy require keeps UserAvatars PNGs off the map-marker import graph.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { USER_2D_AVATARS } = require('./UserAvatars') as typeof import('./UserAvatars');
  signupCatalogCache = [
    ...DRIVER_PRESET_AVATARS,
    ...USER_2D_AVATARS.map(({ name, seed, image }) => ({ name, seed, image })),
  ];
  return signupCatalogCache;
}

function findPresetForSeed(seed?: string | null): PresetAvatar | null {
  const s = (seed ?? '').trim();
  if (!s) return null;
  const fromDrivers = DRIVER_PRESET_AVATARS.find((av) => av.seed === s);
  return fromDrivers ?? null;
}

/** Bundled `require()` source for a driver preset seed (preferred for `<Image source={…} />`). */
export function getPresetImageSourceForSeed(
  seed?: string | null,
): ImageSourcePropType {
  const preset = findPresetForSeed(seed);
  return preset ? preset.image : DRIVER_PRESET_AVATARS[0]!.image;
}

/** Resolve stored avatarSeed to display URI, or null when seed is unrecognised. */
export function getAvatarUriForSeed(seed: string): string | null {
  const preset = findPresetForSeed(seed);
  return preset ? getPresetAvatarUri(preset) : null;
}

/** Preset row for a driver seed (falls back to driver-1). */
export function getDriverPresetForSeed(seed?: string | null): PresetAvatar {
  return findPresetForSeed(seed) ?? DRIVER_PRESET_AVATARS[0]!;
}

/** Image source for driver UI: uploaded photo URL or bundled preset. */
export function resolveDriverAvatarImageSource(
  avatarUri?: string | null,
  avatarSeed?: string | null,
): ImageSourcePropType {
  const trimmed = avatarUri?.trim();
  if (trimmed) {
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('file:') ||
      trimmed.startsWith('blob:')
    ) {
      return { uri: trimmed };
    }
  }
  const s = (avatarSeed ?? '').trim();
  const driver = DRIVER_PRESET_AVATARS.find((av) => av.seed === s);
  if (driver) return driver.image;
  // user-* seeds: never pull UserAvatars on this hot path (Expo Go map blank).
  return DRIVER_PRESET_AVATARS[0]!.image;
}

/** Display URI for map markers / web img src. */
export function resolveDriverAvatarUriForSeed(seed?: string | null): string {
  const preset = findPresetForSeed(seed);
  return preset ? getPresetAvatarUri(preset) : getPresetAvatarUri(DRIVER_PRESET_AVATARS[0]!);
}

/** @deprecated Use getAvatarUriForSeed. Kept for compatibility. */
export function getAvatarUrl(seed: string): string {
  return getAvatarUriForSeed(seed) ?? '';
}
