/**
 * Passbook history — full list of previously worked fleets (left_at set).
 * Accessible only via "View history" (e.g. from Requests). When no organisations:
 * shows "No History Found" empty state with Join Organization CTA and How it works.
 */
import Theme from '@pulse/core/constants/Theme';
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import { CenteredLoadingView } from '@pulse/ui/components/CenteredLoadingView';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import * as driversService from '@pulse/domain/features/drivers/services/drivers.service';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeBack } from '@pulse/core/lib/useSafeBack';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PassbookHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const safeBack = useSafeBack('/(driver)');
  const { theme } = useDriverTheme();
  const isDark = theme === 'dark';
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  const { profile } = useAuth();

  const [linkedDrivers, setLinkedDrivers] = useState<driversService.DriverRow[]>([]);
  const [invites, setInvites] = useState<driversService.DriverInviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      driversService.getLinkedDriversForCurrentUser(profile.uid),
      driversService.getDriverInvitesReceived(),
    ])
      .then(([driversRes, invitesRes]) => {
        setLinkedDrivers(driversRes.drivers ?? []);
        setInvites(invitesRes.invites ?? []);
      })
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  const historyDrivers = useMemo(
    () =>
      linkedDrivers
        .filter((d) => !!d.left_at)
        .sort((a, b) => new Date(b.left_at as string).getTime() - new Date(a.left_at as string).getTime()),
    [linkedDrivers]
  );

  const getOrgName = useCallback(
    (organizationId: string) => {
      const invite = invites.find((i) => i.from_organization_id === organizationId);
      return invite?.from_org_name && invite.from_org_name.trim() !== '' ? invite.from_org_name : 'Fleet';
    },
    [invites]
  );

  if (loading) {
    return <CenteredLoadingView message="Loading…" color={Theme.driverPrimary} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader
        title="Passbook history"
        subtitle="Previously worked fleets · tap to view passbook"
        onBack={safeBack}
        backIcon="arrow"
      />

      <ScrollView
        style={[styles.scroll, { backgroundColor: pageBg }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {historyDrivers.length === 0 ? (
          <View style={styles.noHistoryRoot}>
            <View
              style={[
                styles.noHistoryIconWrap,
                {
                  backgroundColor: colors.surface,
                  shadowColor: Theme.shadow,
                  ...(Platform.OS === 'ios'
                    ? { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 }
                    : { elevation: 6 }),
                },
              ]}
            >
              <FontAwesome name="book" size={56} color={colors.emerald} />
              <View
                style={[
                  styles.noHistoryIconBadge,
                  { backgroundColor: colors.emerald },
                ]}
              >
                <FontAwesome name="plus" size={14} color={Theme.textOnPrimary} />
              </View>
            </View>
            <Text style={[styles.noHistoryTitle, { color: colors.text }]}>
              No History Found
            </Text>
            <Text style={[styles.noHistoryBody, { color: colors.textMuted }]}>
              You aren't connected to any fleets yet. Join an organization to start tracking your trips and earnings in your passbook.
            </Text>
            <TouchableOpacity
              style={[styles.joinOrgBtn, { backgroundColor: colors.emerald }]}
              onPress={() => router.push('/(driver)')}
              activeOpacity={0.8}
            >
              <FontAwesome name="plus" size={20} color={Theme.textOnPrimary} />
              <Text style={[styles.joinOrgBtnText, { color: Theme.textOnPrimary }]}>
                Join Organization
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.howItWorksWrap}
              onPress={() =>
                Alert.alert(
                  'How it works',
                  'Accept an invitation from an organization on the Dashboard screen to connect. Once connected, you\'ll receive trips and your earnings will be tracked in your passbook. When you leave a fleet, it appears here in history.'
                )
              }
              activeOpacity={0.8}
            >
              <FontAwesome name="info-circle" size={16} color={colors.textMuted} />
              <Text style={[styles.howItWorksText, { color: colors.textMuted }]}>
                How it works
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            {historyDrivers.map((d) => {
              const orgId = d.organization_id;
              const orgName = getOrgName(orgId);
              return (
                <View
                  key={d.id}
                  style={[
                    styles.historyCardMinimal,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.historyCardName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {orgName}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.viewPassbookBtnSmall,
                      { backgroundColor: colors.emerald },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: `/(driver)/passbook/${orgId}` as const,
                        params: { orgName, from: 'history' },
                      } as Parameters<typeof router.push>[0])
                    }
                    activeOpacity={0.8}
                  >
                    <FontAwesome
                      name="book"
                      size={12}
                      color={Theme.textOnPrimary}
                    />
                    <Text style={styles.viewPassbookBtnText}>
                      View passbook
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16 },
  section: { marginBottom: 24 },
  historyCardMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 10,
  },
  historyCardName: { fontSize: 15, fontWeight: '700', flex: 1, minWidth: 0 },
  viewPassbookBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  viewPassbookBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Theme.buttonPrimaryText,
  },
  noHistoryRoot: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  noHistoryIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  noHistoryIconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noHistoryTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  noHistoryBody: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  joinOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
  },
  joinOrgBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  howItWorksWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
  },
  howItWorksText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
