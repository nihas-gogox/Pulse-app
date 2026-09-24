export type CacheDomain =
  | 'trips'
  | 'transactions'
  | 'clients'
  | 'suppliers'
  | 'drivers'
  | 'vehicles'
  | 'indents'
  | 'trip-conversations'
  | 'network-conversations'
  | 'invoicing'
  | 'pod-reconciliation'
  | 'log-pods'
  | 'shared-ledger-notifications';

export interface DeltaCursor {
  updatedAt: string;
  tieBreakerId?: string | null;
}

export interface DeltaResponse<T> {
  changed: T[];
  deletedIds: string[];
  nextCursor: DeltaCursor | null;
  fullSyncRequired?: boolean;
}

export interface DomainCacheMeta {
  domain: CacheDomain;
  orgId: string;
  schemaVersion: string;
  lastSuccessfulCursor: DeltaCursor | null;
  lastFullSyncAt: string | null;
  lastDeltaSyncAt: string | null;
  etag?: string | null;
}

export interface SyncPolicy {
  maxDeltaLagMs: number;
  fullSyncEveryMs: number;
}

export interface SyncDecision {
  doFullSync: boolean;
  reason:
    | 'missing-meta'
    | 'missing-cursor'
    | 'schema-version-change'
    | 'full-sync-expired'
    | 'delta-ok';
}
