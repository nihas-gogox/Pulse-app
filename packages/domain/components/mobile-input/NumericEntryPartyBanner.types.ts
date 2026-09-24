// Types extracted from components/mobile-input/NumericEntryPartyBanner.tsx (driver extraction, Phase 2, D19). Types only — no runtime code.

export interface NumericEntryPartyPreview {
  name: string;
  subtitle?: string;
  /**
   * Optional route / corridor line (e.g. "Delhi → Hyderabad").
   * When set, rendered as a compact hero under the name.
   * If omitted but `subtitle` contains "→", the first ·-segment is treated as hero.
   */
  heroLine?: string;
  /** Specs under the hero (vehicle, counter, target) — quieter than heroLine. */
  detailLine?: string;
  entityType?: "client" | "supplier" | "driver";
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  organizationImageUrl?: string | null;
  organizationAvatarSeed?: string | null;
}
