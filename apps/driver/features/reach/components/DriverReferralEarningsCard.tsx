/**
 * Referral earnings green card — Stories tab counterpart of the Salary tab's
 * emerald "TO COLLECT" card (DriverWalletScreen). Shows what the driver has
 * earned from converted recommendations and drives the withdrawal flow:
 * WITHDRAW opens a sheet listing per-fleet balances; each request creates a
 * driver_salary_requests row (request_type='reward') that the fleet owner
 * approves & pays through the existing salary request pipeline.
 */
import Layout from '@pulse/core/constants/Layout';
import Theme from '@pulse/core/constants/Theme';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import type { DriverReferralEarningsData } from '@pulse/domain/features/reach/services/driverReferrals.service';
import {
  buildReferralEarningsSummary,
  type ReferralEarningsOrgBalance,
} from '../utils/referralEarnings';
import { useRequestRewardWithdrawalMutation } from '@pulse/domain/lib/queries/useReachCampaignsQuery';
import { formatINR } from '@pulse/core/lib/format';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BadgeCheck, Clock3, Gift, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EMERALD_950 = '#022c22';
const EMERALD_400 = '#059669';
const EMERALD_200_90 = 'rgba(167,243,208,0.88)';

interface Props {
  userId: string;
  earnings: DriverReferralEarningsData;
}

export function DriverReferralEarningsCard({ userId, earnings }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useDriverTheme();
  const colors = useDriverThemeColors();
  const isDark = theme === 'dark';

  const summary = useMemo(() => buildReferralEarningsSummary(earnings), [earnings]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const withdrawMutation = useRequestRewardWithdrawalMutation();

  if (summary.totalEarned <= 0) return null;

  const requestWithdrawal = async (balance: ReferralEarningsOrgBalance) => {
    if (balance.available <= 0 || !balance.driverId) return;
    try {
      await withdrawMutation.mutateAsync({
        driverId: balance.driverId,
        orgId: balance.orgId,
        amount: balance.available,
        userId,
      });
      setSheetOpen(false);
      Alert.alert(
        'Withdrawal requested',
        `${formatINR(balance.available)} sent to ${balance.orgName} for payout. Track it under Salary requests in your wallet.`,
      );
    } catch (e) {
      Alert.alert("Couldn't request withdrawal", e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const cardBg = isDark ? colors.surface : Theme.cardWhite;

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/(driver)/wallet')}>
        <LinearGradient
          colors={
            isDark
              ? [EMERALD_950, Theme.driverEmeraldDark]
              : [Theme.driverEmeraldDark, Theme.driverEmerald]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.card,
            {
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
              shadowColor: isDark ? 'rgba(2,44,34,0.85)' : 'rgba(6,95,70,0.38)',
            },
          ]}
        >
          <View style={styles.watermarkWrap} pointerEvents="none">
            <Gift size={96} color={EMERALD_400} strokeWidth={1.4} />
          </View>

          <View style={styles.content}>
            <View style={styles.labelRow}>
              <BadgeCheck size={15} color="rgba(236,253,245,0.95)" strokeWidth={2.5} />
              <Text style={styles.label}>REFERRAL EARNINGS</Text>
            </View>

            <View style={styles.balanceRow}>
              <Text style={styles.balanceRupee}>₹</Text>
              <Text style={styles.balanceNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {summary.totalAvailable.toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={styles.subLabel}>available to withdraw</Text>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Earned {formatINR(summary.totalEarned)}</Text>
              {summary.totalWithdrawn > 0 ? (
                <Text style={styles.metaText}>· Withdrawn {formatINR(summary.totalWithdrawn)}</Text>
              ) : null}
            </View>

            {summary.totalRequested > 0 ? (
              <View style={styles.pendingChip}>
                <Clock3 size={11} color={EMERALD_200_90} />
                <Text style={styles.pendingChipText}>
                  {formatINR(summary.totalRequested)} withdrawal pending with your fleet
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.withdrawBtn, summary.totalAvailable <= 0 && styles.withdrawBtnDisabled]}
              activeOpacity={0.85}
              disabled={summary.totalAvailable <= 0}
              onPress={() => setSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Withdraw referral earnings"
              accessibilityHint="Request payout of your referral rewards from your fleet"
            >
              <Text style={styles.withdrawBtnText}>WITHDRAW</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Withdraw sheet ── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Withdraw referral earnings</Text>
              <Pressable onPress={() => setSheetOpen(false)} hitSlop={10}>
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.sheetBody, { color: colors.textMuted }]}>
              Your fleet owner pays referral rewards the same way as salary. Sending a request
              notifies them to approve and pay out.
            </Text>

            {summary.orgBalances.map((bal) => (
              <View
                key={bal.orgId}
                style={[styles.orgRow, { borderColor: colors.border }]}
              >
                <View style={styles.orgTextWrap}>
                  <Text style={[styles.orgName, { color: colors.text }]} numberOfLines={1}>
                    {bal.orgName}
                  </Text>
                  <Text style={[styles.orgMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    Earned {formatINR(bal.earned)}
                    {bal.requested > 0 ? ` · ${formatINR(bal.requested)} pending` : ''}
                    {bal.withdrawn > 0 ? ` · ${formatINR(bal.withdrawn)} paid` : ''}
                  </Text>
                </View>
                {bal.available > 0 ? (
                  <TouchableOpacity
                    style={[styles.orgWithdrawBtn, withdrawMutation.isPending && styles.withdrawBtnDisabled]}
                    disabled={withdrawMutation.isPending}
                    activeOpacity={0.88}
                    onPress={() => void requestWithdrawal(bal)}
                  >
                    {withdrawMutation.isPending ? (
                      <ActivityIndicator size="small" color={Theme.buttonPrimaryText} />
                    ) : (
                      <Text style={styles.orgWithdrawBtnText}>Request {formatINR(bal.available)}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.orgDonePill, { borderColor: colors.border }]}>
                    <Text style={[styles.orgDonePillText, { color: colors.textMuted }]}>
                      {bal.requested > 0 ? 'Requested' : 'Settled'}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={styles.sheetWalletLink}
              activeOpacity={0.8}
              onPress={() => {
                setSheetOpen(false);
                router.push('/(driver)/wallet');
              }}
            >
              <Text style={[styles.sheetWalletLinkText, { color: colors.emerald }]}>
                Track requests in wallet
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  watermarkWrap: {
    position: 'absolute',
    right: -14,
    bottom: -18,
    opacity: 0.35,
  },
  content: { gap: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: EMERALD_200_90 },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  balanceRupee: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 3 },
  balanceNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
  subLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(167,243,208,0.7)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 11, fontWeight: '700', color: 'rgba(236,253,245,0.82)' },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(167,243,208,0.25)',
  },
  pendingChipText: { fontSize: 10, fontWeight: '700', color: EMERALD_200_90 },
  withdrawBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  withdrawBtnDisabled: { opacity: 0.55 },
  withdrawBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: Theme.textPrimaryDark,
  },

  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Theme.overlayBackdrop },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 10,
    gap: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.borderMedium,
    alignSelf: 'center',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 15, fontWeight: '800' },
  sheetBody: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  orgTextWrap: { flex: 1, minWidth: 0, gap: 2 },
  orgName: { fontSize: 13, fontWeight: '800' },
  orgMeta: { fontSize: 11, fontWeight: '600' },
  orgWithdrawBtn: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Theme.buttonPrimary,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    borderColor: Theme.buttonPrimaryBorder,
  },
  orgWithdrawBtnText: { fontSize: 12, fontWeight: '800', color: Theme.buttonPrimaryText },
  orgDonePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  orgDonePillText: { fontSize: 11, fontWeight: '700' },
  sheetWalletLink: { alignItems: 'center', paddingVertical: 10 },
  sheetWalletLinkText: { fontSize: 12, fontWeight: '800' },
});
