/**
 * @deprecated Use {@link PULSE_PRODUCTS} and {@link WORKSPACE_ACCESS_ACTIONS} from productCatalog.
 * Kept for onboarding persona assets and legacy references.
 */
export type OnboardingPersonaId =
  | 'business_owner'
  | 'driver'
  | 'join_team'
  | 'join_fleet';

export type OnboardingPersonaCard = {
  id: OnboardingPersonaId;
  title: string;
  subtitle: string;
  route: string;
  icon: 'building' | 'truck' | 'users' | 'link';
  eyebrow: string;
};
