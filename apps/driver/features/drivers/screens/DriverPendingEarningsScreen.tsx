import { CenteredLoadingView } from '@pulse/ui/components/CenteredLoadingView';
import { PendingEarningsTripCard } from '../../driver/components/PendingEarningsTripCard';
import { PendingSalaryRequestCard } from '../../driver/components/PendingSalaryRequestCard';
import { useDriverPendingEarnings } from '../../driver/hooks/useDriverPendingEarnings';
import { groupTripsByDateSection } from '../../driver/utils/pendingEarningsSections.util';
import Layout from '@pulse/core/constants/Layout';
import Theme from '@pulse/core/constants/Theme';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_BG = '#eef2f6';
const HERO_FROM = '#022c22';
const HERO_TO = '#064e3b';

type PendingView = 'trips' | 'salary';

export default function PendingEarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useDriverTheme();
  const colors = useDriverThemeColors();
  const isDark = theme === 'dark';
  const listBg = isDark ? colors.background : LIST_BG;
  const cardBg = isDark ? colors.surface : Theme.cardWhite;
  const [view, setView] = useState<PendingView>('trips');

  const {
    loading,
    refreshing,
    refresh,
    pendingItems,
    pendingTotal,
    tripCount,
    employerDetails,
    salaryRequestItems,
    salaryRequestSections,
    salaryRequestCount,
  } = useDriverPendingEarnings();

  const sections = useMemo(
    () => groupTripsByDateSection(pendingItems),
    [pendingItems],
  );

  if (loading && pendingItems.length === 0 && salaryRequestCount === 0) {
    return <CenteredLoadingView message="Loading pending earnings…" />;
  }

  return (
    <View style={[styles.root, { backgroundColor: listBg }]}>
      <LinearGradient
        colors={[HERO_FROM, HERO_TO]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.heroTopRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#fff" strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Pending Earnings</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>

        <View style={styles.heroSummary}>
          <View style={styles.heroIconWrap}>
            <Wallet size={28} color="rgba(167,243,208,0.95)" strokeWidth={2} />
          </View>
          <View style={styles.heroSummaryText}>
            <Text style={styles.heroEyebrow}>TO COLLECT</Text>
            <View style={styles.heroAmountRow}>
              <Text style={styles.heroRupee}>₹</Text>
              <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>
                {pendingTotal.toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={styles.heroSub}>
              {tripCount} trip{tripCount !== 1 ? 's' : ''} awaiting settlement
            </Text>
          </View>
        </View>

        {employerDetails.length > 0 ? (
          <View style={styles.employerWrap}>
            {employerDetails.map((employer) => (
              <View key={employer.orgId} style={styles.employerCard}>
                <Text style={styles.employerName} numberOfLines={1}>
                  {employer.orgName}
                </Text>
                <View style={styles.employerTermsRow}>
                  {employer.salaryLines.map((line) => (
                    <Text key={`${employer.orgId}-${line.label}`} style={styles.employerTermPill}>
                      {line.label}: {line.value}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.salaryCta}
          activeOpacity={0.88}
          onPress={() => router.push('/(driver)/salary-request')}
        >
          <Text style={styles.salaryCtaText}>Salary request</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={[styles.segmentRow, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            view === 'trips' && [styles.segmentBtnActive, { backgroundColor: isDark ? 'rgba(4,120,87,0.18)' : 'rgba(4,120,87,0.10)' }],
          ]}
          onPress={() => setView('trips')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, { color: view === 'trips' ? colors.emerald : colors.textMuted }]}>
            Pending trips
          </Text>
          <Text style={[styles.segmentCount, { color: view === 'trips' ? colors.emerald : colors.textMuted }]}>
            {tripCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            view === 'salary' && [styles.segmentBtnActive, { backgroundColor: isDark ? 'rgba(4,120,87,0.18)' : 'rgba(4,120,87,0.10)' }],
          ]}
          onPress={() => setView('salary')}
          activeOpacity={0.85}
        >
          <Text style={[styles.segmentText, { color: view === 'salary' ? colors.emerald : colors.textMuted }]}>
            Salary requests
          </Text>
          <Text style={[styles.segmentCount, { color: view === 'salary' ? colors.emerald : colors.textMuted }]}>
            {salaryRequestCount}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Layout.fabBottomOffset + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.emerald} />
        }
      >
        {view === 'trips' ? (
          pendingItems.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <FontAwesome name="check-circle" size={36} color={colors.emerald} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>All earnings settled</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Completed trips with verified payments appear in your transaction history.
              </Text>
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.dateKey || section.sectionLabel} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: colors.emerald }]} />
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                    {section.sectionLabel}
                  </Text>
                </View>
                <View style={styles.sectionList}>
                  {section.items.map((item) => (
                    <PendingEarningsTripCard
                      key={item.trip.id}
                      item={item}
                      colors={colors}
                      cardBg={cardBg}
                      isDark={isDark}
                      onPress={() =>
                        router.push(`/driver-trip/${item.trip.id}` as import('expo-router').Href)
                      }
                    />
                  ))}
                </View>
              </View>
            ))
          )
        ) : salaryRequestItems.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <FontAwesome name="file-text-o" size={34} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No salary requests yet</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Submit monthly salary, trip commission, or advance requests for fleet review.
            </Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: Theme.driverEmeraldDark }]}
              onPress={() => router.push('/(driver)/salary-request')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyCtaText}>New salary request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          salaryRequestSections.map((section) => (
            <View key={section.dateKey || section.sectionLabel} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: colors.emerald }]} />
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  {section.sectionLabel}
                </Text>
              </View>
              <View style={styles.sectionList}>
                {section.items.map((item) => (
                  <PendingSalaryRequestCard
                    key={item.request.id}
                    item={item}
                    colors={colors}
                    cardBg={cardBg}
                    isDark={isDark}
                    onPress={() =>
                      router.push(`/(driver)/salary-request/${item.request.id}` as import('expo-router').Href)
                    }
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  heroSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSummaryText: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(167,243,208,0.88)',
    marginBottom: 4,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: 4,
  },
  heroRupee: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    paddingBottom: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(167,243,208,0.75)',
    fontWeight: '500',
  },
  employerWrap: {
    gap: 8,
    marginBottom: 14,
  },
  employerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  employerName: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: 'rgba(236,253,245,0.95)',
  },
  employerTermsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  employerTermPill: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(167,243,208,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  salaryCta: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(248,250,252,0.96)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  salaryCtaText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Theme.textPrimaryDark,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Layout.screenPaddingHorizontal,
    marginTop: -8,
    marginBottom: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {},
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionList: {
    gap: 10,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
