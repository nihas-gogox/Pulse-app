import type { SuiteProductId } from '@pulse/domain/lib/suite/suiteProductModule.types';
export type { SuiteProductId } from '@pulse/domain/lib/suite/suiteProductModule.types';


export type ProductReadiness = {
  accessible: boolean;
  setupComplete: boolean;
  nextStep?: string;
};

/** Inputs shared across suite products — platform hydrates before evaluation. */
export type ProductContext = {
  userId: string | null;
  sessionReady: boolean;
  organizationHydrated: boolean;
  platformOrganization: { id: string; name: string } | null;
  workspaceId?: string | null;
  /** @deprecated Prefer PlatformReadinessService — local collections are not source of truth. */
  localState?: unknown;
};

/**
 * Contract for suite product apps (Commerce, Pilot, Finance, …).
 * Register on `SuiteProductDefinition.module` when the product ships.
 */
export interface SuiteProductModule {
  id: SuiteProductId;
  dashboardRoute: string;
  onboardingRoute: string;
  evaluateReadiness(context: ProductContext): Promise<ProductReadiness>;
}

/** Platform-only access gate — never inspect product configuration here. */
export function evaluatePlatformAccessible(
  context: Pick<
    ProductContext,
    'userId' | 'sessionReady' | 'organizationHydrated' | 'platformOrganization'
  >,
): boolean {
  return Boolean(
    context.sessionReady &&
      context.organizationHydrated &&
      context.userId &&
      context.platformOrganization,
  );
}
