type NullableString = string | null | undefined;

function clean(value: NullableString, fallback = '—'): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
}

function amountLabel(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function buildTripFollowUpWhatsappMessage(input: {
  fleetName: NullableString;
  tripId: NullableString;
  amount: number;
  from: NullableString;
  to: NullableString;
}): string {
  const fleetName = clean(input.fleetName, 'Fleet owner');
  const tripId = clean(input.tripId);
  const from = clean(input.from);
  const to = clean(input.to);
  return [
    `Hi ${fleetName},`,
    `Please review this pending trip settlement and release the balance if everything is correct.`,
    ``,
    `Trip: ${tripId}`,
    `Pending amount: ${amountLabel(input.amount)}`,
    `Route: ${from} → ${to}`,
    ``,
    `Shared from Pulse Driver app.`,
  ].join('\n');
}

export function buildTripClaimWhatsappMessage(input: {
  fleetName: NullableString;
  tripId: NullableString;
  amount: number;
  status: NullableString;
  from: NullableString;
  to: NullableString;
  tripDate: NullableString;
  driverName: NullableString;
  driverPhone: NullableString;
}): string {
  const fleetName = clean(input.fleetName, 'Fleet owner');
  const tripId = clean(input.tripId);
  const from = clean(input.from);
  const to = clean(input.to);
  const status = clean(input.status);
  const tripDate = clean(input.tripDate);
  const driverName = clean(input.driverName, 'Driver');
  const driverPhone = clean(input.driverPhone, '—');
  return [
    `Hi ${fleetName},`,
    `Please review and pay the pending balance for this trip claim.`,
    ``,
    `Trip: ${tripId}`,
    `Pending amount: ${amountLabel(input.amount)}`,
    `Status: ${status}`,
    `Trip date: ${tripDate}`,
    `Route: ${from} → ${to}`,
    `Driver: ${driverName} (${driverPhone})`,
    ``,
    `A PDF with full trip & amount details was generated on this device—please review it alongside this message.`,
    `Shared from Pulse Driver app.`,
  ].join('\n');
}

export function buildBulkTripClaimWhatsappMessage(input: {
  tripCount: number;
  totalAmount: number;
  driverName: NullableString;
  driverPhone: NullableString;
}): string {
  const driverName = clean(input.driverName, 'Driver');
  const driverPhone = clean(input.driverPhone, '—');
  return [
    `Hi,`,
    `Please review and pay the pending trip balances shared in the attached claim summary.`,
    ``,
    `Trips pending: ${input.tripCount}`,
    `Total pending amount: ${amountLabel(input.totalAmount)}`,
    `Driver: ${driverName} (${driverPhone})`,
    ``,
    `The PDF includes fleet-wise trip details for verification.`,
    `Shared from Pulse Driver app.`,
  ].join('\n');
}

export function buildSettlementShareMessage(input: {
  fleetName: NullableString;
  tripId: NullableString;
  amount: number;
  transactionId: NullableString;
  utr: NullableString;
}): string {
  const fleetName = clean(input.fleetName, 'Fleet');
  const tripId = clean(input.tripId);
  const transactionId = clean(input.transactionId);
  const utr = clean(input.utr);
  return [
    `Settlement received`,
    `${fleetName}`,
    ``,
    `Trip: ${tripId}`,
    `Amount: ${amountLabel(input.amount)}`,
    `Transaction ID: ${transactionId}`,
    `UTR: ${utr}`,
  ].join('\n');
}

