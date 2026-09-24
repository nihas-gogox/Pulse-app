/**
 * Driver Home "at a glance" strip — today's earnings (every driver_ledger
 * type: settlement, reward, incentive, adjustment — drivers don't care where
 * it came from), reward money already earned but not yet withdrawn/settled,
 * potential earnings from recommendations still in flight, today's trips,
 * and recommendations sent. Pure aggregation over existing data — no new
 * backend.
 */
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { getDriverLedgerByDriverIds } from '@pulse/domain/features/drivers/services/drivers.service';
import {
  getDriverReferralEarnings,
  getDriverReferralsForCurrentUser,
} from '@pulse/domain/features/reach/services/driverReferrals.service';
import { buildReferralEarningsSummary } from '../../reach/utils/referralEarnings';
import { getTripsByDriverIds } from '@pulse/domain/features/trips/services/trips.service';
import { useDriverHomeDriversQuery } from '@pulse/domain/lib/queries/useDriverHomeDriversQuery';
import { formatINR } from '@pulse/core/lib/format';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isToday(iso: string | null | undefined, cutoff: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && d >= cutoff;
}

/** Not yet converted — a recommendation can still be rejected, so this is
 * potential, not owed. Kept distinct from "Pending Rewards" below. */
const POTENTIAL_REFERRAL_STATUSES = new Set(['recommended', 'approved', 'bid_submitted']);

export function DriverDailySummaryCard({ uid }: { uid: string | null }) {
  const colors = useDriverThemeColors();
  const linkedDriversQuery = useDriverHomeDriversQuery(uid);
  const driverIds = useMemo(
    () => linkedDriversQuery.activeLinkedDrivers.map((d) => d.id),
    [linkedDriversQuery.activeLinkedDrivers],
  );
  const driverIdsKey = useMemo(() => [...driverIds].sort().join(','), [driverIds]);

  const summaryQ = useQuery({
    queryKey: queryKeys.driverApp.dailySummary(driverIdsKey || (uid ?? '')),
    queryFn: async () => {
      const cutoff = startOfToday();
      const [ledgerRes, tripsRes, referralsRes, earningsRes] = await Promise.all([
        driverIds.length > 0
          ? getDriverLedgerByDriverIds(driverIds)
          : Promise.resolve({ error: null, entries: [] }),
        driverIds.length > 0
          ? getTripsByDriverIds(driverIds, { limit: 50, offset: 0 })
          : Promise.resolve({ error: null, trips: [] }),
        getDriverReferralsForCurrentUser(),
        getDriverReferralEarnings(),
      ]);

      // Today's Earnings: every ledger type (settlement, reward, incentive,
      // adjustment, ...) — the driver only cares "how much did I make today."
      const todaysEarnings = (ledgerRes.entries ?? [])
        .filter((e) => isToday(e.created_at, cutoff))
        .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

      const tripsToday = (tripsRes.trips ?? []).filter(
        (t) => isToday(t.created_at, cutoff) || isToday(t.started_at, cutoff),
      ).length;

      const potentialEarnings = (referralsRes.referrals ?? [])
        .filter((r) => POTENTIAL_REFERRAL_STATUSES.has(r.status))
        .reduce((sum, r) => sum + Number(r.reward_amount ?? 0), 0);

      const recommendationsToday = (referralsRes.referrals ?? []).filter((r) =>
        isToday(r.created_at, cutoff),
      ).length;

      // Pending Rewards: money already converted into driver_ledger (reward
      // type) that hasn't been withdrawn or settled yet — same math as the
      // Stories-tab earnings card (buildReferralEarningsSummary), reused
      // rather than re-derived so the two surfaces can never disagree.
      const earningsSummary = buildReferralEarningsSummary(earningsRes.data);
      const pendingRewards = earningsSummary.totalAvailable + earningsSummary.totalRequested;

      return {
        todaysEarnings,
        pendingRewards,
        potentialEarnings,
        tripsToday,
        recommendationsToday,
      };
    },
    enabled: !!uid,
    staleTime: 30_000,
  });

  const data = summaryQ.data;
  // Nothing to show yet (still loading, or a brand-new driver with zero
  // activity anywhere) — avoid a card full of zeroes on first run.
  if (!data) return null;
  const hasAnything =
    data.todaysEarnings > 0 ||
    data.pendingRewards > 0 ||
    data.potentialEarnings > 0 ||
    data.tripsToday > 0 ||
    data.recommendationsToday > 0;
  if (!hasAnything) return null;

  const statRows: Array<{ label: string; value: string }> = [
    { label: 'Pending Rewards', value: formatINR(data.pendingRewards) },
    { label: 'Potential Earnings', value: formatINR(data.potentialEarnings) },
    { label: 'Trips', value: String(data.tripsToday) },
    { label: 'Recommendations', value: String(data.recommendationsToday) },
  ];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.heroRow}>
        <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Today's Earnings</Text>
        <Text style={[styles.heroValue, { color: colors.text }]} numberOfLines={1}>
          {formatINR(data.todaysEarnings)}
        </Text>
      </View>
      <View style={[styles.statRow, { borderTopColor: colors.border }]}>
        {statRows.map((stat, idx) => (
          <View
            key={stat.label}
            style={[
              styles.cell,
              idx > 0 && { borderLeftColor: colors.border, borderLeftWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
              {stat.value}
            </Text>
            <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  heroRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 2,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
});
