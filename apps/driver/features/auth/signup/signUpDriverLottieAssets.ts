import type { AnimationObject } from 'lottie-react-native';

import type { PulseMascotIllustrationId } from '@pulse/core/lib/pulseMascotIllustrations';

/** Driver activation — step hero Lotties (green workforce flow). Kept for non-keypad steps. */
export const DRIVER_SIGNUP_LOTTIE = {
  phone: require('@/assets/Animated folder/phone call check.json') as AnimationObject,
  verify: require('@/assets/Animated folder/security.json') as AnimationObject,
  account: require('@/assets/Animated folder/user-info.json') as AnimationObject,
  license: require('@/assets/Animated folder/law approved.json') as AnimationObject,
  success: require('@/assets/Animated folder/delivery completed.json') as AnimationObject,
} as const;

/**
 * Soft watermark mascots for phone / OTP keypad steps
 * (`assets/illustrations` Pulse mascot set).
 */
export const DRIVER_SIGNUP_HERO_MASCOT = {
  phone: 'driverAtWarehouse' satisfies PulseMascotIllustrationId,
  verify: 'phoneVerifiedMessage' satisfies PulseMascotIllustrationId,
} as const;
