/**
 * Onboarding intent — what the user is becoming, not which steps to skip.
 * Stored in auth metadata as `onboarding_type` and read by handle_new_user.
 */
export const ONBOARDING_TYPES = [
  'owner',
  'member',
  'guest',
  'contractor',
  'partner',
  'supplier',
] as const;

export type OnboardingType = (typeof ONBOARDING_TYPES)[number];

const ORG_CREATING_TYPES: ReadonlySet<OnboardingType> = new Set(['owner']);

/** Types that provision a new organization + owner membership on signup. */
export function createsOrganization(onboardingType: OnboardingType): boolean {
  return ORG_CREATING_TYPES.has(onboardingType);
}

export function isOnboardingType(value: unknown): value is OnboardingType {
  return typeof value === 'string' && (ONBOARDING_TYPES as readonly string[]).includes(value);
}

/** Resolve intent from auth metadata (supports legacy skip_org_creation). */
export function resolveOnboardingTypeFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): OnboardingType {
  const explicit = metadata?.onboarding_type;
  if (isOnboardingType(explicit)) return explicit;

  const legacySkip =
    metadata?.skip_org_creation === true ||
    metadata?.skip_org_creation === 'true';
  if (legacySkip) return 'member';

  return 'owner';
}

export function onboardingTypeToMetadata(
  onboardingType: OnboardingType,
): Record<string, string> {
  return { onboarding_type: onboardingType };
}
