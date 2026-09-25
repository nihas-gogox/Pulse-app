import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hydrateOwnerBusinessProfileFlag,
  isOwnerBusinessProfileRequiredSync,
} from './incompleteOwnerOrg.util';
import { bumpPredicateSignals } from '@pulse/core/lib/navigationPolicy/predicateSignals';

const BUSINESS_BRANDING_FLAG_KEY = '@pulse_business_signup_branding_v1';
const BUSINESS_BRANDING_STEP_KEY = '@pulse_business_signup_branding_step_v1';
const DRIVER_SUCCESS_FLAG_KEY = '@pulse_driver_signup_success_v1';

/** In-memory mirrors so route guards can read synchronously after hydrate. */
let businessBrandingActive = false;
let driverSuccessActive = false;

export const BUSINESS_SIGNUP_BRANDING_PATHS = [
  '/onboarding/business',
  '/sign-up',
] as const;

export const DRIVER_SIGNUP_COMPLETION_PATHS = ['/driver-signup', '/onboarding/driver'] as const;

export function isBusinessSignupBrandingPath(pathname: string): boolean {
  return BUSINESS_SIGNUP_BRANDING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isDriverSignupCompletionPath(pathname: string): boolean {
  return DRIVER_SIGNUP_COMPLETION_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function setBusinessSignupBrandingActive(active: boolean): void {
  businessBrandingActive = active;
  void AsyncStorage.setItem(BUSINESS_BRANDING_FLAG_KEY, active ? '1' : '0');
  if (!active) {
    void AsyncStorage.removeItem(BUSINESS_BRANDING_STEP_KEY);
  }
  bumpPredicateSignals();
}

export function isBusinessSignupBrandingActiveSync(): boolean {
  return businessBrandingActive;
}

export function setDriverSignupSuccessActive(active: boolean): void {
  driverSuccessActive = active;
  void AsyncStorage.setItem(DRIVER_SUCCESS_FLAG_KEY, active ? '1' : '0');
  bumpPredicateSignals();
}

export function isDriverSignupSuccessActiveSync(): boolean {
  return driverSuccessActive;
}

export function isSignupFlowGateActiveSync(): boolean {
  return (
    businessBrandingActive ||
    driverSuccessActive ||
    isOwnerBusinessProfileRequiredSync()
  );
}

export async function hydrateBusinessSignupBrandingFlag(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BUSINESS_BRANDING_FLAG_KEY);
    businessBrandingActive = value === '1';
  } catch {
    businessBrandingActive = false;
  }
  return businessBrandingActive;
}

export async function hydrateDriverSignupSuccessFlag(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(DRIVER_SUCCESS_FLAG_KEY);
    driverSuccessActive = value === '1';
  } catch {
    driverSuccessActive = false;
  }
  return driverSuccessActive;
}

/** Hydrate all signup completion gates (call once at boot). */
export async function hydrateSignupFlowFlags(): Promise<void> {
  await Promise.all([
    hydrateBusinessSignupBrandingFlag(),
    hydrateDriverSignupSuccessFlag(),
    hydrateOwnerBusinessProfileFlag(),
  ]);
  bumpPredicateSignals();
}

export async function persistBusinessSignupBrandingStep(step: number): Promise<void> {
  if (step < 6 || step > 8) return;
  try {
    await AsyncStorage.setItem(BUSINESS_BRANDING_STEP_KEY, String(step));
  } catch {
    // Non-fatal — in-session step state still works.
  }
}

export async function readBusinessSignupBrandingStep(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(BUSINESS_BRANDING_STEP_KEY);
    if (!raw) return null;
    const step = Number.parseInt(raw, 10);
    if (step >= 6 && step <= 8) return step;
  } catch {
    // ignore
  }
  return null;
}

export function clearBusinessSignupBranding(): void {
  setBusinessSignupBrandingActive(false);
}

export function clearDriverSignupSuccess(): void {
  setDriverSignupSuccessActive(false);
}
