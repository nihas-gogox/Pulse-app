/**
 * Format estimated trip ETA for UI.
 *
 * - If backend stores Postgres interval as "HH:MM:SS", convert to "XH YM".
 * - If backend already stores human strings like "14H 22M" / "24h" / "45M", return trimmed value.
 * - Returns "—" for empty values.
 */
export function formatEstimatedDuration(estimatedDuration: string | null | undefined): string {
  const raw = estimatedDuration?.trim();
  if (!raw) return '—';

  // Postgres interval serialization: "HH:MM:SS" (often "00:14:00").
  const m = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) {
    const hours = Number(m[1]);
    const minutes = Number(m[2]);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '—';
    if (hours <= 0 && minutes <= 0) return '—';
    if (hours <= 0) return `${minutes}M`;
    if (minutes <= 0) return `${hours}H`;
    return `${hours}H ${minutes}M`;
  }

  // Already-human formats.
  if (/(?:\d+\s*h\b)/i.test(raw) || /(?:\d+\s*m\b)/i.test(raw) || /H\s*\d+/i.test(raw)) {
    return raw;
  }

  // If it still looks numeric-only (e.g. "120"), keep as-is (caller may add units).
  return raw;
}

