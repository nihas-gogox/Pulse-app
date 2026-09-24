/**
 * Become a Fleet Owner — Phase 1 Step 1 (enable capability only).
 * @see docs/DRIVER_FLEET_OWNER_PHASE1.md
 */
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import Theme from '@pulse/core/constants/Theme';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { enableDriverFleetOwner } from '../services/driverFleetOwner.service';
import { useDriverFleetOwnerQuery } from '../../../lib/queries/useDriverFleetOwnerQuery';
import { ROUTES } from '@pulse/core/lib/routes';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  FileText,
  Gavel,
  LineChart,
  Truck,
  Wallet,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BENEFITS = [
  { icon: Truck, label: 'Manage your vehicles' },
  { icon: FileText, label: 'Track documents & expiry' },
  { icon: Gavel, label: 'Bid for loads' },
  { icon: Wallet, label: 'Track earnings' },
  { icon: LineChart, label: 'See vehicle-wise P&L' },
] as const;

export default function BecomeFleetOwnerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  const { isFleetOwner, invalidate } = useDriverFleetOwnerQuery(profile?.uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(driver)/profile');
  }, [router]);

  const handleEnable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { error: enableError } = await enableDriverFleetOwner();
      if (enableError) {
        setError(enableError.message);
        return;
      }
      invalidate();
    } finally {
      setBusy(false);
    }
  }, [invalidate]);

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader
        title="Become a Fleet Owner"
        subtitle="Same account · own your fleet"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
          paddingTop: 12,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.borderSubtle : 'rgba(226,232,240,0.95)',
            },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.emerald }]}>
            DRIVER + OWNER
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Operate loads. Own the fleet behind them.
          </Text>
          <Text style={[styles.heroBody, { color: colors.textMuted }]}>
            Work still comes from clients or the open market — you won&apos;t
            create trips or loads in the Driver App. You&apos;ll manage vehicles,
            documents, and earnings as an independent operator.
          </Text>
        </View>

        <View
          style={[
            styles.listCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.borderSubtle : 'rgba(226,232,240,0.95)',
            },
          ]}
        >
          {BENEFITS.map(({ icon: Icon, label }) => (
            <View key={label} style={styles.benefitRow}>
              <View
                style={[
                  styles.benefitIcon,
                  { backgroundColor: isDark ? colors.emeraldMuted : 'rgba(167,243,208,0.35)' },
                ]}
              >
                <Icon size={16} color={colors.emerald} strokeWidth={2.3} />
              </View>
              <Text style={[styles.benefitLabel, { color: colors.text }]}>{label}</Text>
            </View>
          ))}
        </View>

        {isFleetOwner ? (
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: isDark ? colors.emeraldMuted : 'rgba(220,252,231,0.9)',
                borderColor: isDark ? colors.borderSubtle : 'rgba(34,197,94,0.25)',
              },
            ]}
          >
            <CheckCircle2 size={22} color={colors.emerald} strokeWidth={2.4} />
            <View style={styles.successTextWrap}>
              <Text style={[styles.successTitle, { color: colors.text }]}>
                Fleet Owner enabled
              </Text>
              <Text style={[styles.successBody, { color: colors.textMuted }]}>
                Your account can now register personal vehicles in My Fleet.
              </Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {!isFleetOwner ? (
          <Pressable
            onPress={() => void handleEnable()}
            disabled={busy}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: colors.emerald,
                opacity: pressed || busy ? 0.88 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Set up my fleet"
          >
            {busy ? (
              <ActivityIndicator color={Theme.textOnPrimary} />
            ) : (
              <Text style={styles.ctaText}>Set up my fleet</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={() =>
              router.replace(
                ROUTES.driverMyFleet() as Parameters<typeof router.replace>[0],
              )
            }
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: colors.emerald,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open My Fleet"
          >
            <Text style={styles.ctaText}>Open My Fleet</Text>
          </Pressable>
        )}

        <Text style={[styles.footnote, { color: colors.textMuted }]}>
          Employment with a business stays separate. This does not create a
          Business organization or allow creating trips from the Driver App.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  listCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  successCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    alignItems: 'flex-start',
  },
  successTextWrap: { flex: 1, gap: 4, minWidth: 0 },
  successTitle: { fontSize: 15, fontWeight: '700' },
  successBody: { fontSize: 12, lineHeight: 17 },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Theme.negative,
  },
  cta: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.textOnPrimary,
  },
  secondaryCta: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
