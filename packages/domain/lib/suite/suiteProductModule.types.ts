// Types extracted from lib/suite/suiteProductModule.ts (driver extraction, Phase 2, D19). Types only — no runtime code.

/**
 * Product readiness — evaluated by each suite product module.
 *
 * `accessible` is platform state only (session, org, membership, permissions).
 * `setupComplete` is entirely product-owned (warehouses, catalog, etc.).
 */

/** Suite products — shared Pulse Identity, separate apps (Zoho-style). */
export type SuiteProductId = 'core' | 'pilot' | 'commerce' | 'invoice' | 'pod' | 'finance-pro';
