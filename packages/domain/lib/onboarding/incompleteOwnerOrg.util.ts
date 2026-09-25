import AsyncStorage from '@react-native-async-storage/async-storage';
import { bumpPredicateSignals } from '@pulse/core/lib/navigationPolicy/predicateSignals';
import { supabase } from '@pulse/core/lib/supabase';

const OWNER_BUSINESS_PROFILE_FLAG_KEY = '@pulse_owner_business_profile_required_v1';
const OWNER_BUSINESS_PROFILE_STEP_KEY = '@pulse_owner_business_profile_step_v1';

/** In-memory mirror for sync route guards after hydrate. */
let ownerBusinessProfileRequired = false;

/** Default shell name from handle_new_user when company_name is absent. */
const SHELL_ORG_NAME_RE = /'s Organization$/i;

export function isDefaultShellOrganizationName(name: string | null | undefined): boolean {
  const n = (name ?? '').trim();
  return n.length > 0 && SHELL_ORG_NAME_RE.test(n);
}

/**
 * Shell owner org: trigger default name + no signup address.
 * Used to force Google (or interrupted) owners back through org/profile/city.
 */
export function isIncompleteOwnerOrganization(org: {
  name?: string | null;
  address_line?: string | null;
}): boolean {
  const address = (org.address_line ?? '').trim();
  return isDefaultShellOrganizationName(org.name) && !address;
}

export function setOwnerBusinessProfileRequired(active: boolean): void {
  ownerBusinessProfileRequired = active;
  void AsyncStorage.setItem(OWNER_BUSINESS_PROFILE_FLAG_KEY, active ? '1' : '0');
  if (!active) {
    void AsyncStorage.removeItem(OWNER_BUSINESS_PROFILE_STEP_KEY);
  }
  bumpPredicateSignals();
}

export function isOwnerBusinessProfileRequiredSync(): boolean {
  return ownerBusinessProfileRequired;
}

export function clearOwnerBusinessProfileRequired(): void {
  setOwnerBusinessProfileRequired(false);
}

export async function hydrateOwnerBusinessProfileFlag(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(OWNER_BUSINESS_PROFILE_FLAG_KEY);
    ownerBusinessProfileRequired = value === '1';
  } catch {
    ownerBusinessProfileRequired = false;
  }
  return ownerBusinessProfileRequired;
}

export async function persistOwnerBusinessProfileStep(step: number): Promise<void> {
  if (step < 2 || step > 4) return;
  try {
    await AsyncStorage.setItem(OWNER_BUSINESS_PROFILE_STEP_KEY, String(step));
  } catch {
    // Non-fatal
  }
}

export async function readOwnerBusinessProfileStep(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(OWNER_BUSINESS_PROFILE_STEP_KEY);
    if (!raw) return null;
    const step = Number.parseInt(raw, 10);
    if (step >= 2 && step <= 4) return step;
  } catch {
    // ignore
  }
  return null;
}

type SessionProviders = {
  provider?: string;
  providers?: string[];
};

/** True when the active session originated from (or includes) Google OAuth. */
export async function sessionHasGoogleProvider(): Promise<boolean> {
  try {
    const { data } = await supabase().auth.getSession();
    const app = (data.session?.user?.app_metadata ?? {}) as SessionProviders;
    if (app.provider === 'google') return true;
    if (Array.isArray(app.providers) && app.providers.includes('google')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Loads the caller's first owned/active org and reports whether it is still a
 * shell created by handle_new_user without signup address/company fields.
 */
export async function detectIncompleteOwnerOrgForSession(): Promise<{
  incomplete: boolean;
  orgId: string | null;
  orgName: string | null;
}> {
  try {
    const { data: authData } = await supabase().auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return { incomplete: false, orgId: null, orgName: null };

    const { data: membership } = await supabase()
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const orgId = membership?.organization_id as string | undefined;
    if (!orgId) return { incomplete: false, orgId: null, orgName: null };

    const { data: org } = await supabase()
      .from('organizations')
      .select('id, name, address_line')
      .eq('id', orgId)
      .maybeSingle();

    if (!org) return { incomplete: false, orgId: null, orgName: null };

    return {
      incomplete: isIncompleteOwnerOrganization(org),
      orgId: org.id as string,
      orgName: (org.name as string) ?? null,
    };
  } catch {
    return { incomplete: false, orgId: null, orgName: null };
  }
}
