/**
 * Driver signup confirmation — Pilot-style ready card.
 * Hero avatar, emerald accents, clean checklist (not the business workspace card).
 */
import { memo, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clock, ShieldCheck, Sparkles } from 'lucide-react-native';

import Theme from '@pulse/core/constants/Theme';
import { PULSE_PILOT_BRAND_WORD } from '@pulse/core/lib/brand/pulseBrandMark.tokens';

export type DriverReadyCheckpoint = {
  id: string;
  label: string;
  detail?: string;
  status: 'complete' | 'in_progress';
};

export interface DriverSignupReadyCardProps {
  displayName: string;
  profilePreviewUri?: string | null;
  profileImage?: ImageSourcePropType;
  checkpoints: readonly DriverReadyCheckpoint[];
}

const AVATAR = 104;

function DriverSignupReadyCardInner({
  displayName,
  profilePreviewUri,
  profileImage,
  checkpoints,
}: DriverSignupReadyCardProps) {
  const name = displayName.trim() || 'Driver';
  const completed = checkpoints.filter((c) => c.status === 'complete').length;
  const progress = checkpoints.length > 0 ? completed / checkpoints.length : 1;

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const ring = useRef(new Animated.Value(0.92)).current;
  const ringOpacity = useRef(new Animated.Value(0.4)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(rise, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(bar, {
        toValue: progress,
        duration: 900,
        delay: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring, {
            toValue: 1.12,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ring, { toValue: 0.92, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.35, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    ).start();
  }, [bar, fade, progress, rise, ring, ringOpacity]);

  const barWidth = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity: fade, transform: [{ translateY: rise }] },
      ]}
    >
      <LinearGradient
        colors={[Theme.driverEmeraldMuted, '#ecfdf5', Theme.cardWhite]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barWidth }]}>
            <LinearGradient
              colors={[Theme.driverEmerald, Theme.driverPrimary]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <View style={styles.brandRow}>
          <Text style={styles.brandWord}>{PULSE_PILOT_BRAND_WORD}</Text>
          <View style={styles.readyPill}>
            <Sparkles size={11} color={Theme.driverEmeraldDark} strokeWidth={2.5} />
            <Text style={styles.readyPillText}>Ready</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatarOuter}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                { opacity: ringOpacity, transform: [{ scale: ring }] },
              ]}
            />
            <View style={styles.avatarRing}>
              {profilePreviewUri ? (
                <Image
                  source={{ uri: profilePreviewUri }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : profileImage ? (
                <Image
                  source={profileImage}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.checkBadge} accessibilityLabel="Account ready">
              <Check size={14} color={Theme.textOnPrimary} strokeWidth={3} />
            </View>
          </View>

          <Text style={styles.hello} numberOfLines={1}>
            Welcome, {name}
          </Text>
          <Text style={styles.tagline}>
            {`You're cleared for the ${PULSE_PILOT_BRAND_WORD} grid`}
          </Text>
        </View>

        <View style={styles.summaryHeader}>
          <ShieldCheck size={14} color={Theme.driverEmerald} strokeWidth={2.5} />
          <Text style={styles.summaryLabel}>Activation</Text>
          <Text style={styles.summaryCount}>
            {completed}/{checkpoints.length}
          </Text>
        </View>

        <View style={styles.checklist}>
          {checkpoints.map((cp) => {
            const done = cp.status === 'complete';
            return (
              <View
                key={cp.id}
                style={[styles.checkRow, done ? styles.checkRowDone : styles.checkRowActive]}
              >
                <View
                  style={[
                    styles.checkIcon,
                    done ? styles.checkIconDone : styles.checkIconActive,
                  ]}
                >
                  {done ? (
                    <Check size={12} color={Theme.textOnPrimary} strokeWidth={3} />
                  ) : (
                    <Clock size={12} color={Theme.driverGold} strokeWidth={2.5} />
                  )}
                </View>
                <View style={styles.checkTextCol}>
                  <Text
                    style={[styles.checkLabel, !done && styles.checkLabelActive]}
                    numberOfLines={1}
                  >
                    {cp.label}
                  </Text>
                  {cp.detail ? (
                    <Text style={styles.checkDetail} numberOfLines={2}>
                      {cp.detail}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export const DriverSignupReadyCard = memo(DriverSignupReadyCardInner);

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.driverEmeraldBorderSoft,
    backgroundColor: Theme.cardWhite,
    ...Platform.select({
      ios: {
        shadowColor: Theme.driverEmerald,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 5 },
      web: {
        boxShadow: `0 18px 40px ${Theme.driverEmeraldMuted}`,
      } as object,
    }),
  },
  gradient: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  progressTrack: {
    height: 3,
    marginHorizontal: -20,
    marginBottom: 16,
    backgroundColor: Theme.driverEmeraldMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brandWord: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Theme.driverEmeraldMutedText2,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Theme.driverEmeraldMuted,
    borderWidth: 1,
    borderColor: Theme.driverEmeraldBorderSoft,
  },
  readyPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Theme.driverEmeraldDark,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarOuter: {
    width: AVATAR + 28,
    height: AVATAR + 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pulseRing: {
    position: 'absolute',
    width: AVATAR + 28,
    height: AVATAR + 28,
    borderRadius: (AVATAR + 28) / 2,
    backgroundColor: Theme.driverEmeraldMuted,
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    borderColor: Theme.driverEmerald,
    overflow: 'hidden',
    backgroundColor: Theme.surfaceGray,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.driverEmeraldMuted,
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
    color: Theme.driverEmeraldDark,
  },
  checkBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.driverEmerald,
    borderWidth: 2,
    borderColor: Theme.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hello: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Theme.textPrimaryDark,
    textAlign: 'center',
    maxWidth: '100%',
    paddingHorizontal: 8,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: Theme.textRouteCard,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Theme.textMuted,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: Theme.driverEmeraldDark,
  },
  checklist: {
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 52,
  },
  checkRowDone: {
    backgroundColor: Theme.cardWhite,
    borderColor: Theme.borderLight,
  },
  checkRowActive: {
    backgroundColor: Theme.accentGoldMuted,
    borderColor: Theme.accentGoldBorder,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkIconDone: {
    backgroundColor: Theme.driverEmerald,
  },
  checkIconActive: {
    backgroundColor: Theme.accentGoldMuted,
  },
  checkTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Theme.textPrimaryDark,
  },
  checkLabelActive: {
    color: Theme.textPrimaryDark,
  },
  checkDetail: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: Theme.textMuted,
  },
});
