/**
 * Referral earnings math for the driver Stories green card.
 *
 * Rewards land in driver_ledger (INR, owed by the fleet org) when a
 * recommendation converts; withdrawals ride driver_salary_requests with
 * request_type='reward'. Per fleet org:
 *
 *   available = earned − (pending + approved + paid withdrawal requests)
 *
 * Pending/approved requests reserve the amount so the driver can't
 * double-request while the fleet owner is reviewing; rejected requests
 * release it back.
 */
import type {
  DriverReferralEarningsData,
  DriverRewardWithdrawalRow,
} from '@pulse/domain/features/reach/services/driverReferrals.service';

export interface ReferralEarningsOrgBalance {
  orgId: string;
  /** drivers.id in this org — target for the withdrawal request. */
  driverId: string;
  orgName: string;
  earned: number;
  /** Amount tied up in pending/approved withdrawal requests. */
  requested: number;
  /** Amount already marked paid by the fleet. */
  withdrawn: number;
  available: number;
}

export interface ReferralEarningsSummary {
  totalEarned: number;
  totalAvailable: number;
  totalRequested: number;
  totalWithdrawn: number;
  /** Orgs with any reward history, largest available first. */
  orgBalances: ReferralEarningsOrgBalance[];
  /** Newest withdrawal request still awaiting the fleet owner, if any. */
  latestPendingWithdrawal: DriverRewardWithdrawalRow | null;
}

const FALLBACK_ORG_NAME = 'Your fleet';

export function buildReferralEarningsSummary(
  data: DriverReferralEarningsData,
): ReferralEarningsSummary {
  const byOrg = new Map<string, ReferralEarningsOrgBalance>();

  const ensureOrg = (orgId: string): ReferralEarningsOrgBalance => {
    let bal = byOrg.get(orgId);
    if (!bal) {
      bal = {
        orgId,
        driverId: data.driverIdByOrgId[orgId] ?? '',
        orgName: data.orgNameById[orgId] ?? FALLBACK_ORG_NAME,
        earned: 0,
        requested: 0,
        withdrawn: 0,
        available: 0,
      };
      byOrg.set(orgId, bal);
    }
    return bal;
  };

  for (const entry of data.entries) {
    ensureOrg(entry.organization_id).earned += Number(entry.amount) || 0;
  }

  let latestPendingWithdrawal: DriverRewardWithdrawalRow | null = null;
  for (const w of data.withdrawals) {
    const status = String(w.status || '').toLowerCase();
    const amount = Number(w.amount) || 0;
    const bal = ensureOrg(w.organization_id);
    if (status === 'paid') {
      bal.withdrawn += amount;
    } else if (status === 'pending' || status === 'approved') {
      bal.requested += amount;
      // data.withdrawals is newest-first, so the first hit is the latest.
      if (!latestPendingWithdrawal) latestPendingWithdrawal = w;
    }
    // rejected → amount released back to available
  }

  let totalEarned = 0;
  let totalAvailable = 0;
  let totalRequested = 0;
  let totalWithdrawn = 0;
  const orgBalances: ReferralEarningsOrgBalance[] = [];
  for (const bal of byOrg.values()) {
    bal.available = Math.max(0, bal.earned - bal.requested - bal.withdrawn);
    totalEarned += bal.earned;
    totalAvailable += bal.available;
    totalRequested += bal.requested;
    totalWithdrawn += bal.withdrawn;
    orgBalances.push(bal);
  }
  orgBalances.sort((a, b) => b.available - a.available);

  return {
    totalEarned,
    totalAvailable,
    totalRequested,
    totalWithdrawn,
    orgBalances,
    latestPendingWithdrawal,
  };
}
