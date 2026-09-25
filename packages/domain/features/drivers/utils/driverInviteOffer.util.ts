import type { DriverInviteCompensation } from './driverInviteCompensation.util';
import type { DriverInviteRow } from '../services/drivers.service';
import { normalizeDriverInviteCompensation } from './driverInviteCompensation.util';

export type DriverInviteSalaryLine = {
  label: string;
  value: string;
  hint: string;
};

/** Pay-term preview lines from dispatcher-entered compensation (fleet invite modal). */
export function buildCompensationSalaryLines(
  compensation: DriverInviteCompensation,
): DriverInviteSalaryLine[] {
  const offer = normalizeDriverInviteCompensation(compensation);
  const lines: DriverInviteSalaryLine[] = [];

  if (offer.payableAmount != null) {
    lines.push({
      label: 'Fixed salary',
      value: `₹${offer.payableAmount.toLocaleString('en-IN')}`,
      hint: 'Agreed fixed pay from this fleet (e.g. monthly salary)',
    });
  }
  if (offer.commissionPercent != null) {
    lines.push({
      label: 'Trip commission',
      value: `${offer.commissionPercent}%`,
      hint: 'Driver share of trip earnings on each completed trip',
    });
  }
  if (offer.commissionPerKm != null) {
    lines.push({
      label: 'Per km rate',
      value: `₹${offer.commissionPerKm.toLocaleString('en-IN')}/km`,
      hint: 'Paid per kilometre driven on assigned trips',
    });
  }

  return lines;
}

/** Structured salary / pay terms for invite preview UI. */
export function buildDriverInviteSalaryLines(inv: DriverInviteRow): DriverInviteSalaryLine[] {
  const lines: DriverInviteSalaryLine[] = [];

  if (inv.payable_amount != null && Number(inv.payable_amount) > 0) {
    lines.push({
      label: 'Fixed salary',
      value: `₹${Number(inv.payable_amount).toLocaleString('en-IN')}`,
      hint: 'Agreed fixed pay from this fleet (e.g. monthly salary)',
    });
  }
  if (inv.commission_percent != null && Number(inv.commission_percent) > 0) {
    lines.push({
      label: 'Trip commission',
      value: `${inv.commission_percent}%`,
      hint: 'Your share of trip earnings on each completed trip',
    });
  }
  if (inv.commission_per_km != null && Number(inv.commission_per_km) > 0) {
    lines.push({
      label: 'Per km rate',
      value: `₹${Number(inv.commission_per_km).toLocaleString('en-IN')}/km`,
      hint: 'Paid per kilometre driven on assigned trips',
    });
  }

  return lines;
}

export function hasDriverInviteSalaryTerms(inv: DriverInviteRow): boolean {
  return buildDriverInviteSalaryLines(inv).length > 0;
}
