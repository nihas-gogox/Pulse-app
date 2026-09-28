import Theme from "@/constants/Theme";
import type { DiscoverOrg } from "@/features/network/services/discover.service";

export type RecommendationSignal = {
  type: "mutual" | "location" | "lane";
  label: string;
};

export type ScoredDiscoverOrg = DiscoverOrg & {
  score: number;
  signals: RecommendationSignal[];
};

export function getDiscoverOrgLocation(org: DiscoverOrg): string | null {
  const cityState = [org.city, org.state]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(", ")
    .trim();
  if (cityState) return cityState;

  const direct =
    org.business_location ??
    org.location ??
    org.headquarters ??
    (org.address_line?.trim() ? org.address_line.trim() : null) ??
    null;
  if (direct && direct.trim()) {
    const parts = direct
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return direct.trim();
  }
  return null;
}

/** Maps RPC-enriched discover row to scored card model (DB already sorted). */
export function scoreDiscoverOrg(org: DiscoverOrg): ScoredDiscoverOrg {
  const signals: RecommendationSignal[] = [];
  const mutuals = org.mutual_count ?? org.mutual_connections_count ?? 0;
  const laneOverlaps = org.lane_overlap_count ?? 0;

  if (mutuals > 0) {
    signals.push({
      type: "mutual",
      label: `${mutuals} mutual${mutuals === 1 ? "" : "s"}`,
    });
  }
  if (laneOverlaps >= 2) {
    signals.push({
      type: "lane",
      label: `${laneOverlaps} lane overlaps`,
    });
  } else if (laneOverlaps >= 1 || org.is_in_user_trip_city) {
    signals.push({ type: "location", label: "Active on your routes" });
  }

  const score =
    typeof org.recommendation_score === "number"
      ? org.recommendation_score
      : signals.length === 0
        ? -1
        : 0;

  return { ...org, score, signals };
}

export function isConnectableDiscoverOrg(org: ScoredDiscoverOrg): boolean {
  const status = String(org.connection_status ?? "none").toLowerCase();
  const role = String(org.profile_role ?? "").toLowerCase();
  return status !== "approved" && role !== "driver";
}

export function pickGrowRecommendations(
  orgs: readonly DiscoverOrg[],
  opts: { limit: number; dismissed?: ReadonlySet<string> },
): ScoredDiscoverOrg[] {
  const scored = orgs.map(scoreDiscoverOrg).filter(isConnectableDiscoverOrg);
  const signalRecommended = scored.filter((o) => o.score > 0);
  const pool = signalRecommended.length > 0 ? signalRecommended : scored;

  const slots: ScoredDiscoverOrg[] = [];
  for (const org of pool) {
    if (opts.dismissed?.has(org.id)) continue;
    slots.push(org);
    if (slots.length >= opts.limit) break;
  }
  return slots;
}

export function primaryRecommendationReason(
  signals: readonly RecommendationSignal[],
): string | null {
  const lane = signals.find((s) => s.type === "lane");
  if (lane) return lane.label;
  const location = signals.find((s) => s.type === "location");
  if (location) return location.label;
  const mutual = signals.find((s) => s.type === "mutual");
  if (mutual) return mutual.label;
  return null;
}

export type RecommendationPillTone = "lane" | "location" | "mutual" | "default";

export type RecommendationPill = {
  label: string;
  tone: RecommendationPillTone;
};

export function recommendationPills(
  signals: readonly RecommendationSignal[],
): RecommendationPill[] {
  if (signals.length === 0) {
    return [{ label: "Suggested partner", tone: "default" }];
  }
  return signals.map((signal) => ({
    label: signal.label,
    tone: signal.type,
  }));
}

/** One-line match copy for sidebar rows — avoids duplicating pill labels. */
export function growRowMatchLine(signals: readonly RecommendationSignal[]): {
  prefix: string;
  highlight: string;
  tone: RecommendationPillTone;
} {
  const lane = signals.find((s) => s.type === "lane");
  if (lane) {
    return { prefix: "Strong fit · ", highlight: lane.label, tone: "lane" };
  }
  const location = signals.find((s) => s.type === "location");
  if (location) {
    return {
      prefix: "Route match · ",
      highlight: location.label,
      tone: "location",
    };
  }
  const mutual = signals.find((s) => s.type === "mutual");
  if (mutual) {
    return { prefix: "Network · ", highlight: mutual.label, tone: "mutual" };
  }
  return {
    prefix: "",
    highlight: "Suggested partner",
    tone: "default",
  };
}

/** Accent for the highlighted match phrase — Theme ink / success, not Metronic purple. */
export function growRowAccentColor(tone: RecommendationPillTone): string {
  if (tone === "lane") return Theme.primary;
  if (tone === "location") return Theme.primary;
  if (tone === "mutual") return Theme.success;
  return Theme.textSecondary;
}

export type LoadCenterRecommendMode = "give" | "get";

function normalizeOperatingModel(org: DiscoverOrg): string {
  return String(org.operating_model ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/** Asset / hybrid orgs — own fleet capacity to quote on give-load. */
export function isAssetOwnerDiscoverOrg(org: DiscoverOrg): boolean {
  const model = normalizeOperatingModel(org);
  return model === "ASSET_BASED" || model === "HYBRID";
}

/** Aggregate / hybrid orgs — post indents to market (get-load counterparties). */
export function isAggregatorDiscoverOrg(org: DiscoverOrg): boolean {
  const model = normalizeOperatingModel(org);
  return model === "NON_ASSET" || model === "HYBRID";
}

function loadCenterMarketActivityScore(org: ScoredDiscoverOrg): number {
  const rec =
    typeof org.recommendation_score === "number" ? org.recommendation_score : 0;
  const trips = typeof org.trip_count === "number" ? org.trip_count : 0;
  const mutuals = org.mutual_count ?? org.mutual_connections_count ?? 0;
  const lanes = org.lane_overlap_count ?? 0;
  return rec * 1000 + trips * 10 + mutuals * 5 + lanes * 3 + org.score;
}

/**
 * Load Center partner suggestions:
 * - give → asset-owning suppliers (ASSET_BASED / HYBRID)
 * - get → aggregators sharing market indents (NON_ASSET / HYBRID), ranked by activity
 */
export function pickLoadCenterRecommendations(
  orgs: readonly DiscoverOrg[],
  opts: {
    mode: LoadCenterRecommendMode;
    limit: number;
    dismissed?: ReadonlySet<string>;
  },
): ScoredDiscoverOrg[] {
  const scored = orgs.map(scoreDiscoverOrg).filter(isConnectableDiscoverOrg);
  const filtered = scored.filter((org) =>
    opts.mode === "give"
      ? isAssetOwnerDiscoverOrg(org)
      : isAggregatorDiscoverOrg(org),
  );

  const preferred =
    opts.mode === "give"
      ? filtered.filter(
          (org) => normalizeOperatingModel(org) === "ASSET_BASED",
        )
      : filtered.filter(
          (org) => normalizeOperatingModel(org) === "NON_ASSET",
        );
  const byActivity = (a: ScoredDiscoverOrg, b: ScoredDiscoverOrg) =>
    loadCenterMarketActivityScore(b) - loadCenterMarketActivityScore(a);
  const rankedPreferred = [...preferred].sort(byActivity);
  const preferredIds = new Set(rankedPreferred.map((org) => org.id));
  // Prefer pure asset / aggregator first, then fill remaining slots with HYBRID
  // so the card can show up to `limit` (typically 3) recommendations.
  const rankedRest = filtered
    .filter((org) => !preferredIds.has(org.id))
    .sort(byActivity);
  const ranked = [...rankedPreferred, ...rankedRest];

  const slots: ScoredDiscoverOrg[] = [];
  const usedLocations = new Set<string>();
  const locationKey = (org: ScoredDiscoverOrg) =>
    (org.city ?? org.state ?? getDiscoverOrgLocation(org) ?? "")
      .trim()
      .toLowerCase();

  for (const org of ranked) {
    if (opts.dismissed?.has(org.id)) continue;
    const loc = locationKey(org);
    if (loc && usedLocations.has(loc)) continue;
    if (loc) usedLocations.add(loc);
    slots.push(org);
    if (slots.length >= opts.limit) break;
  }
  if (slots.length < opts.limit) {
    const have = new Set(slots.map((org) => org.id));
    for (const org of ranked) {
      if (opts.dismissed?.has(org.id) || have.has(org.id)) continue;
      slots.push(org);
      if (slots.length >= opts.limit) break;
    }
  }
  return slots;
}

export function loadCenterRecommendMatchLine(
  mode: LoadCenterRecommendMode,
  org: ScoredDiscoverOrg,
): { prefix: string; highlight: string; tone: RecommendationPillTone } {
  if (mode === "give") {
    const model = normalizeOperatingModel(org);
    if (model === "ASSET_BASED") {
      return {
        prefix: "Fleet · ",
        highlight: "Owns assets",
        tone: "lane",
      };
    }
    if (model === "HYBRID") {
      return {
        prefix: "Hybrid · ",
        highlight: "Fleet + network",
        tone: "location",
      };
    }
  } else {
    const model = normalizeOperatingModel(org);
    const trips = typeof org.trip_count === "number" ? org.trip_count : 0;
    if (model === "NON_ASSET") {
      return {
        prefix: "Aggregator · ",
        highlight: trips > 0 ? `${trips} market trips` : "Shares indents",
        tone: "mutual",
      };
    }
    if (model === "HYBRID") {
      return {
        prefix: "Hybrid · ",
        highlight: "Active on market",
        tone: "location",
      };
    }
  }
  return growRowMatchLine(org.signals);
}

