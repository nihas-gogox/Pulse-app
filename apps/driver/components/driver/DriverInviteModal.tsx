import Theme from '@pulse/core/constants/Theme';
import { useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import type { DriverInviteRow } from '@pulse/domain/features/drivers/services/drivers.service';
import { buildDriverInviteSalaryLines } from '@pulse/domain/features/drivers/utils/driverInviteOffer.util';
import { resolveDriverOrgAvatarUri } from '../../features/drivers/utils/resolveDriverOrgAvatar.util';
import { useOrgBrandingByIds } from '../../lib/hooks/useOrgBrandingByIds';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowRight,
    Briefcase,
    Check,
    MapPin,
    Percent,
    Sparkles,
    Wallet,
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  invite: DriverInviteRow;
  queueIndex?: number;
  queueTotal?: number;
  busy?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onLater: () => void;
};

function salaryLineIcon(label: string, size = 18) {
  const key = label.toLowerCase();
  if (key.includes('salary') || key.includes('fixed')) {
    return <Wallet size={size} color={Theme.driverEmerald} strokeWidth={2.2} />;
  }
  if (key.includes('commission') || key.includes('%')) {
    return <Percent size={size} color={Theme.driverEmerald} strokeWidth={2.2} />;
  }
  return <MapPin size={size} color={Theme.driverEmerald} strokeWidth={2.2} />;
}

const EMERALD = Theme.driverEmerald;
const EMERALD_DARK = Theme.driverEmeraldDark;
const MINT = 'rgba(167,243,208,0.92)';

export function DriverInviteModal({
  visible,
  invite,
  queueIndex = 1,
  queueTotal = 1,
  busy = false,
  onAccept,
  onDecline,
  onLater,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useDriverThemeColors();
  const orgId = invite.from_organization_id ?? '';
  const brandingById = useOrgBrandingByIds([orgId]);

  const orgLogoUri = useMemo(
    () =>
      resolveDriverOrgAvatarUri({
        orgId,
        orgName: invite.from_org_name,
        branding: brandingById[orgId],
        logoUrl: invite.from_org_logo_url,
        avatarSeed: invite.from_org_avatar_seed,
        avatarUrl: invite.from_org_avatar_url,
      }),
    [invite, orgId, brandingById],
  );

  const salaryLines = buildDriverInviteSalaryLines(invite);
  const orgName = invite.from_org_name?.trim() || 'Fleet organisation';

  const inviteDateLabel = useMemo(() => {
    const raw = invite.created_at;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [invite.created_at]);

  const nextSteps = useMemo(
    () => [
      'You will receive trip assignments from this fleet',
      'Your earnings will be tracked in your passbook',
      `Pay is settled by ${orgName}`,
    ],
    [orgName],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onLater}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, Platform.OS === 'web' ? styles.backdropWeb : null]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16) + 4,
            },
          ]}
        >
          {/* ── Hero band ─────────────────────────────── */}
          <LinearGradient
            colors={[EMERALD_DARK, EMERALD]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {/* Top row: eyebrow + queue badge */}
            <View style={styles.heroTopRow}>
              <View style={styles.heroEyebrowRow}>
                <Sparkles size={12} color={MINT} strokeWidth={2.5} />
                <Text style={styles.heroEyebrow}>FLEET INVITATION</Text>
              </View>
              {queueTotal > 1 && (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueText}>{queueIndex}/{queueTotal}</Text>
                </View>
              )}
            </View>

            {/* Org logo + title row */}
            <View style={styles.heroBody}>
              {/* Org Logo */}
              <View style={styles.heroLogoWrap}>
                <Image
                  source={{ uri: orgLogoUri }}
                  style={styles.heroLogo}
                  resizeMode="cover"
                />
                <View style={styles.heroLogoBadge}>
                  <Briefcase size={9} color="#fff" strokeWidth={2.5} />
                </View>
              </View>

              {/* Title block */}
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  Join {orgName}
                </Text>
                <View style={styles.heroPillRow}>
                  <View style={styles.heroPill}>
                    <Text style={styles.heroPillText}>Fleet Driver</Text>
                  </View>
                  {inviteDateLabel && (
                    <Text style={styles.heroDate}>Sent {inviteDateLabel}</Text>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>

          <ScrollView
            style={styles.body}
            contentContainerStyle={[styles.bodyContent, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* ── Pay package ─────────────────────────── */}
            {salaryLines.length > 0 ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                    YOUR OFFER
                  </Text>
                  <View style={[styles.offerPill, { backgroundColor: colors.emeraldMuted }]}>
                    <Text style={[styles.offerPillText, { color: EMERALD }]}>
                      {salaryLines.length} benefit{salaryLines.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.payGrid}>
                  {salaryLines.map((line, i) => (
                    <View
                      key={line.label}
                      style={[
                        styles.payTile,
                        {
                          backgroundColor: i === 0 ? colors.emeraldMuted : colors.surfaceElevated,
                          borderColor: i === 0
                            ? Theme.driverEmeraldBorderSoft ?? `${EMERALD}30`
                            : colors.border,
                          flex: salaryLines.length === 1 ? 1 : undefined,
                          width: salaryLines.length > 1 ? '48%' : undefined,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.payTileIconWrap,
                          { backgroundColor: i === 0 ? '#fff' : colors.surface },
                        ]}
                      >
                        {salaryLineIcon(line.label, 16)}
                      </View>
                      <Text style={[styles.payTileAmount, { color: colors.text }]}>
                        {line.value}
                      </Text>
                      <Text style={[styles.payTileLabel, { color: EMERALD }]}>
                        {line.label}
                      </Text>
                      <Text
                        style={[styles.payTileHint, { color: colors.textMuted }]}
                        numberOfLines={2}
                      >
                        {line.hint}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.emptyTerms,
                  { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                ]}
              >
                <FontAwesome name="info-circle" size={15} color={colors.textMuted} />
                <Text style={[styles.emptyTermsText, { color: colors.textMuted }]}>
                  Pay terms will be confirmed when you accept. View details in Requests after connecting.
                </Text>
              </View>
            )}

            {/* ── What happens next ───────────────────── */}
            <View
              style={[
                styles.nextCard,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.nextTitle, { color: colors.text }]}>What happens next</Text>
              {nextSteps.map((item) => (
                <View key={item} style={styles.nextRow}>
                  <ArrowRight size={13} color={EMERALD} strokeWidth={2.4} />
                  <Text style={[styles.nextText, { color: colors.textMuted }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* ── Reminder banner ─────────────────────── */}
            <View
              style={[
                styles.reminderBanner,
                {
                  backgroundColor: colors.emeraldMuted,
                  borderColor: colors.emeraldBorderSoft,
                },
              ]}
            >
              <FontAwesome name="bell" size={12} color={EMERALD} />
              <Text style={[styles.reminderText, { color: colors.textMuted }]}>
                This invitation stays active until you accept or decline.
              </Text>
            </View>
          </ScrollView>

          {/* ── Footer ──────────────────────────────── */}
          <View
            style={[styles.footer, { borderTopColor: colors.border }]}
          >
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.declineBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                ]}
                onPress={onDecline}
                disabled={busy}
                activeOpacity={0.82}
              >
                <Text style={[styles.declineText, { color: colors.textMuted }]}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptBtn, busy && styles.disabled]}
                onPress={onAccept}
                disabled={busy}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[EMERALD, EMERALD_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.acceptGradient}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={15} color="#fff" strokeWidth={3} />
                      <Text style={styles.acceptText}>Accept & connect</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={onLater}
              disabled={busy}
              style={styles.laterBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.laterText, { color: colors.textMuted }]}>Remind me later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.75)',
    justifyContent: 'flex-end',
  },
  backdropWeb: {
    position: 'fixed' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { width: '100%', maxWidth: 440, borderRadius: 28, maxHeight: '92%' }
      : {}),
  },

  // ── Hero ─────────────────────────────────────────────
  hero: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: MINT,
    textTransform: 'uppercase',
  },
  queueBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  queueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroLogoWrap: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
    flexShrink: 0,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroLogoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: EMERALD_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  heroPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  heroDate: {
    fontSize: 11,
    fontWeight: '500',
    color: MINT,
  },

  // ── Body ─────────────────────────────────────────────
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  offerPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  offerPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  payGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  payTile: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 5,
    minWidth: 140,
  },
  payTileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  payTileAmount: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  payTileLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  payTileHint: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
  },

  emptyTerms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  emptyTermsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },

  // ── What's next card ──────────────────────────────────
  nextCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  nextTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  nextText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
  },

  // ── Reminder ─────────────────────────────────────────
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reminderText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '400',
  },

  // ── Footer ───────────────────────────────────────────
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 1.6,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
  },
  acceptGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  laterBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  laterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.6,
  },
});
