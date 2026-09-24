/**
 * Story/load display formatting — extracted from StoryDetailScreen so the
 * same route/vehicle/date rendering can be reused for a snapshotted Reach
 * campaign (features/reach/), which no longer has a live PostRow to read
 * from once the source story is edited or deleted. Every function here
 * takes plain fields rather than a PostRow, so both a live post and a
 * reach_campaigns snapshot row can call the same formatting.
 */
import { hasVehicleMarker, stripVehicleMarker } from '../services/posts.service';

export type StoryPostType = 'UPDATE' | 'LOAD' | 'VEHICLE_AVAILABILITY';

export interface StoryContentFields {
  content: string | null;
  origin: string | null;
  destination: string | null;
  material: string | null;
}

/** Vehicle-availability posts are physically stored as `type: 'UPDATE'` with
 * a `[VEHICLE_AVAILABILITY]` marker prefixed on `content` — this reclassifies
 * a raw stored type/content pair the same way normalizeFeedPost does for a
 * live post, so a snapshot (which preserves the raw marker) classifies
 * identically. */
export function classifyStoredPostType(
  storedType: string | null | undefined,
  content: string | null | undefined,
): StoryPostType {
  if (storedType === 'LOAD') return 'LOAD';
  if (storedType === 'VEHICLE_AVAILABILITY' || hasVehicleMarker(content)) return 'VEHICLE_AVAILABILITY';
  return 'UPDATE';
}

/** Strips the vehicle marker for display, if present — safe to call on any
 * content regardless of type. */
export function displayStoryContent(content: string | null | undefined): string | null {
  return stripVehicleMarker(content ?? null);
}

/** Matches a date-only value (`YYYY-MM-DD`) with no time of day. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Load Center / stories are India operations — clock times are always IST. */
const STORY_TZ = 'Asia/Kolkata';

function parseStoryInstant(raw: string): Date | null {
  const t = raw.trim();
  if (!t) return null;
  if (DATE_ONLY_RE.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    if (!y || !m || !d) return null;
    const local = new Date(y, m - 1, d);
    if (Number.isNaN(local.getTime())) return null;
    return local;
  }
  const dt = new Date(t);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatStoryCalendarDate(d: Date, timeZone?: string): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatStoryClockIst(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    timeZone: STORY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatStoryDate(d: string): string {
  const dt = parseStoryInstant(d);
  if (!dt) return '';
  return formatStoryCalendarDate(dt);
}

/**
 * Date plus clock time, e.g. `07 Sept 2026 · 2:32 pm`.
 * Date-only strings stay date-only so UTC midnight is not shown as 5:30 AM.
 */
export function formatStoryDateTime(d: string): string {
  const raw = (d ?? '').trim();
  if (!raw) return '';
  if (DATE_ONLY_RE.test(raw)) return formatStoryDate(raw);
  const dt = parseStoryInstant(raw);
  if (!dt) return '';
  const date = formatStoryCalendarDate(dt, STORY_TZ);
  if (!date) return '';
  return `${date} · ${formatStoryClockIst(dt)}`;
}

/**
 * Pickup/load date with a real clock time when one exists.
 * If `dateIso` is date-only, appends the clock from `timeIso` (`shared_at` /
 * `created_at`) so cards never invent midnight UTC as 5:30 AM.
 */
export function formatStoryDateTimeWithFallback(
  dateIso: string | null | undefined,
  timeIso?: string | null,
): string {
  const primary = (dateIso ?? '').trim();
  if (!primary) return '';
  if (!DATE_ONLY_RE.test(primary)) return formatStoryDateTime(primary);

  const dateLabel = formatStoryDate(primary);
  const fallback = (timeIso ?? '').trim();
  if (!fallback || DATE_ONLY_RE.test(fallback) || !dateLabel) return dateLabel;

  const timeD = parseStoryInstant(fallback);
  if (!timeD) return dateLabel;
  return `${dateLabel} · ${formatStoryClockIst(timeD)}`;
}

/** True for Fleet Owner organic capacity posts (null org, VEHICLE_AVAILABILITY). */
export function isFleetOwnerCapacityPost(post: {
  type?: string | null;
  organization_id?: string | null;
}): boolean {
  return (
    (post.type ?? '').toUpperCase() === 'VEHICLE_AVAILABILITY' &&
    (post.organization_id == null || String(post.organization_id).trim() === '')
  );
}

/** Capacity chip: "16" → "16T"; leave non-numeric material unchanged. */
export function formatCapacityMaterial(material: string | null | undefined): string | null {
  const raw = (material ?? '').trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return `${raw}T`;
  if (/^\d+(\.\d+)?\s*t(onnes?)?$/i.test(raw)) {
    return `${raw.match(/^\d+(\.\d+)?/)?.[0] ?? raw}T`;
  }
  return raw;
}

export function storyHeadline(fields: StoryContentFields, isLoad: boolean, isVehicle: boolean): string {
  const t = fields.content?.trim();
  if (t) return t;
  if (isLoad && fields.origin && fields.destination) {
    const mat = fields.material?.trim();
    if (mat) return `${mat} · ${fields.origin} → ${fields.destination}`;
    return `${fields.origin} → ${fields.destination}`;
  }
  if (isVehicle && fields.origin) return `Available @ ${fields.origin}`;
  return 'Active broadcast';
}

export function storyTypeLabel(type: StoryPostType): string {
  if (type === 'LOAD') return 'LOAD BROADCAST';
  if (type === 'VEHICLE_AVAILABILITY') return 'CAPACITY ALERT';
  return 'NETWORK UPDATE';
}

export function splitLocationParts(value: string | null | undefined): {
  city: string;
  state: string;
} {
  const raw = (value ?? '').trim();
  if (!raw) return { city: '—', state: '' };

  // Split on the first top-level comma only — one outside any parentheses.
  // Merged-plan summary strings like "2 pickups (Pickup A, Pickup B)" carry
  // their only comma inside the parenthesized list, so they render as one
  // clean label instead of being cut mid-list.
  let depth = 0;
  let splitAt = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) { splitAt = i; break; }
  }
  if (splitAt === -1) return { city: raw, state: '' };

  const city = raw.slice(0, splitAt).trim();
  const state = raw.slice(splitAt + 1).trim();
  return { city: city || raw, state };
}

/** Planner labels written onto indents before address summaries existed. */
export function looksLikePlannerStopSummary(
  value: string | null | undefined,
): boolean {
  const raw = (value ?? "").trim();
  if (!raw) return false;
  return (
    /^(pickup|drop)\s+[a-z0-9]+$/i.test(raw) ||
    /^\d+\s+(pickups?|drops?)\s*\(/i.test(raw)
  );
}

/**
 * Lines for pickup/drop columns. Multi-stop summaries use ` · ` between stops
 * so each location can wrap instead of one truncated "2 drops (…)" string.
 */
export function routeEndpointLines(value: string | null | undefined): string[] {
  const raw = (value ?? "").trim();
  if (!raw) return ["—"];
  if (raw.includes(" · ")) {
    return raw
      .split(" · ")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const counted = raw.match(/^\d+\s+(?:pickups?|drops?)\s*\((.*)\)\s*$/i);
  if (counted?.[1]) {
    return [counted[1].trim()].filter(Boolean);
  }
  const { city, state } = splitLocationParts(raw);
  return state ? [city, state] : [city];
}

/** City for a story ring. First place name only — "Bengaluru, Bangalore" is one city. */
export function storyCityLabel(value: string | null | undefined): string {
  const city = splitLocationParts(value).city;
  if (!city || city === '—') return '';
  return city;
}

export function loadMaterialLabel(fields: Pick<StoryContentFields, 'material'>, fallbackHeadline: string): string {
  const material = fields.material?.trim();
  if (material) return material;
  const beforeRoute = fallbackHeadline.split('→')[0]?.split('•')[0]?.split('·')[0]?.trim();
  return beforeRoute || 'Load';
}
