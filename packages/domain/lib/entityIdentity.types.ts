// Types extracted from lib/entityIdentity.ts (driver extraction, Phase 2, D19). Types only — no runtime code.
import type { PartyEntityType } from './partyAvatarDisplay';

export interface ResolvedPartyAvatarIdentity {
  displayName: string;
  entityType: PartyEntityType;
  organizationImageUrl?: string | null;
  organizationAvatarSeed?: string | null;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  isIntegrated?: boolean;
}
