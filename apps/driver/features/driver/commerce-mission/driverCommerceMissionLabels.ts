/** Presentation labels only. Does not invent order-level delivery. */

export function stopKindLabel(stopType: string | null | undefined): string {
  const t = (stopType ?? '').trim().toLowerCase();
  if (t === 'pickup') return 'Pickup';
  if (t === 'drop') return 'Drop';
  return t ? t : 'Stop';
}

/** SES status at the stop — never mapped to sales_orders.status. */
export function stopExecutionLabel(status: string | null | undefined): string {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'pending') return 'Awaiting';
  if (s === 'arrived') return 'Arrived';
  if (s === 'completed') return 'Stop completed';
  if (s === 'failed') return 'Failed';
  if (s === 'skipped') return 'Skipped';
  return s || 'Awaiting';
}

export function formatStopAddress(stop: {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}): string | null {
  const parts = [stop.addressLine, stop.city, stop.state, stop.pincode]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function formatDeliveryWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start && !end) return null;
  try {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${fmt(end!)}`;
  } catch {
    return [start, end].filter(Boolean).join(' – ') || null;
  }
}
