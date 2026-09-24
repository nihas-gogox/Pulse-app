/**
 * Google Pay–style transaction list helpers for driver wallet / passbook.
 * Typography and grouping only; amounts/credits use Theme.gpayAmountReceived in light mode.
 */
import Theme from '@pulse/core/constants/Theme';

const GPAY_AVATAR_BG = [
  '#1a73e8',
  '#5f6368',
  '#9333ea',
  '#ea4335',
  '#f9ab00',
  '#188038',
  '#1967d2',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** e.g. "March 9, 2023 at 10:15 AM" */
export function gpayFormatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const minStr = String(m).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h}:${minStr} ${ampm}`;
}

export function gpayInitialFromLabel(label: string): string {
  const t = label.trim();
  if (!t) return '?';
  return t[0]!.toUpperCase();
}

export function gpayAvatarColors(seed: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % GPAY_AVATAR_BG.length;
  return { background: GPAY_AVATAR_BG[idx]!, color: Theme.textOnPrimary };
}

/** PhonePe-style footer date: "Today", "1 day ago", or "30 Mar 2023". */
export function phonePeMetaDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTrip = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTrip) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
