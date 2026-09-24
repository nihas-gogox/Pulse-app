import Layout from '@pulse/core/constants/Layout';
import Typography from '@pulse/core/constants/Typography';
import { DriverBrandMark } from './DriverBrandMark';
import { DriverHeaderTripOpsButtons } from './DriverHeaderTripOpsButtons';
import { DriverSelfAvatar } from './DriverSelfAvatar';
import { useOptionalLanguage } from '@pulse/core/contexts/LanguageContext';
import { ROUTES } from '@pulse/core/lib/routes';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AVATAR_SIZE = Layout.driverHeaderAvatarSize;
/** Ring sits outside the photo; blinks when the driver is online. */
const ONLINE_RING_SIZE = AVATAR_SIZE + 6;
const ONLINE_RING_WIDTH = 2.5;

type DriverHeaderColors = {
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  whiteMuted: string;
  emerald: string;
  emeraldMuted: string;
};

export type DriverHeaderVariant = 'default' | 'assigned';

type Props = {
  colors: DriverHeaderColors;
  avatarUri: string;
  driverName: string;
  isOnline: boolean;
  variant?: DriverHeaderVariant;
  onPressOtpClaim?: () => void;
  onPressNotifications?: () => void;
  onPressLanguage?: () => void;
  onPressChat?: () => void;
  /** Active trip for header expense / odometer shortcuts. */
  hasActiveTrip?: boolean;
  showExpenseOps?: boolean;
  showOdometerOps?: boolean;
  onPressExpense?: () => void;
  onPressOdometer?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function DriverHeader({
  colors,
  avatarUri,
  driverName,
  isOnline,
  variant = 'default',
  onPressNotifications,
  onPressLanguage,
  onPressChat,
  hasActiveTrip = false,
  showExpenseOps = true,
  showOdometerOps = true,
  onPressExpense,
  onPressOdometer,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { localeOptions, locale } = useOptionalLanguage();
  const languageCode = (localeOptions.find((o) => o.value === locale)?.label ?? 'EN')
    .slice(0, 2)
    .toUpperCase();

  const title =
    variant === 'assigned' ? driverName : `Welcome, ${driverName}`;

  const ringPulse = useSharedValue(1);

  useEffect(() => {
    if (!isOnline) {
      cancelAnimation(ringPulse);
      ringPulse.value = 1;
      return;
    }
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(ringPulse);
  }, [isOnline, ringPulse]);

  const onlineRingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringPulse.value,
  }));

  const showTripOps = Boolean(onPressExpense || onPressOdometer);

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + Layout.driverHeaderTopOffset,
          paddingBottom: Layout.driverHeaderBottomPadding,
          paddingHorizontal: Layout.driverHeaderHorizontalPadding,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      <View style={styles.headerLeft}>
        <TouchableOpacity
          onPress={() => router.push('/(driver)/profile')}
          style={styles.avatarBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isOnline ? 'Profile, online' : 'Profile'}
          accessibilityHint="Opens your driver profile"
        >
          <View style={styles.avatarStack}>
            {isOnline ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.onlinePresenceRing,
                  {
                    width: ONLINE_RING_SIZE,
                    height: ONLINE_RING_SIZE,
                    borderRadius: ONLINE_RING_SIZE / 2,
                    borderWidth: ONLINE_RING_WIDTH,
                    borderColor: colors.emerald,
                  },
                  onlineRingAnimatedStyle,
                ]}
              />
            ) : null}
            <DriverSelfAvatar
              size={Layout.driverHeaderAvatarSize}
              uri={avatarUri}
              borderColor={colors.emerald}
              backgroundColor={colors.emerald}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <DriverBrandMark color={colors.textMuted} />
          <Text style={[styles.welcomeTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={
            onPressLanguage ??
            (() =>
              router.push(
                ROUTES.MODALS.LANGUAGE_SETTINGS as Parameters<typeof router.push>[0],
              ))
          }
          style={[
            styles.languageBtn,
            { backgroundColor: colors.whiteMuted, borderColor: colors.border },
          ]}
          activeOpacity={0.8}
          accessibilityLabel="Language"
          accessibilityHint="Change app display language"
        >
          <FontAwesome
            name="globe"
            size={Layout.driverHeaderActionIconSize - 1}
            color={colors.text}
          />
          <Text style={[styles.languageCode, { color: colors.textMuted }]}>
            {languageCode}
          </Text>
        </TouchableOpacity>

        {showTripOps ? (
          <DriverHeaderTripOpsButtons
            hasActiveTrip={hasActiveTrip}
            showExpense={showExpenseOps}
            showOdometer={showOdometerOps}
            onPressExpense={onPressExpense ?? (() => {})}
            onPressOdometer={onPressOdometer ?? (() => {})}
            surfaceColor={colors.whiteMuted}
            borderColor={colors.border}
            textColor={colors.text}
            accentColor={colors.emerald}
          />
        ) : null}

        {/* Trip-message inbox. Only entry point for drivers with no active trip —
            the per-trip Chat buttons live on trip cards, which aren't rendered
            when the driver is idle. */}
        <TouchableOpacity
          onPress={onPressChat ?? (() => router.push('/(driver)/chat'))}
          style={[
            styles.notificationBtn,
            { backgroundColor: colors.whiteMuted, borderColor: colors.border },
          ]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Trip messages"
          accessibilityHint="Opens your trip conversations"
        >
          {/* lucide MessageSquare — matches DriverChatScreen's own icon and the
              stroke weight of the rest of the driver shell.

              No unread badge here on purpose: trip_conversations only tracks
              `unread_dispatcher_count`, which the DB increments for messages
              where sender_role NOT IN ('dispatcher','system') — i.e. the
              DISPATCHER's unread count, not the driver's. Showing it here read
              as "1 unread" while the driver had nothing new to open. A real
              driver-side badge needs a driver unread source first. */}
          <MessageSquare
            size={Layout.driverHeaderActionIconSize}
            color={colors.text}
            strokeWidth={2.25}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPressNotifications ?? (() => router.push('/(driver)/notifications'))}
          style={[
            styles.notificationBtn,
            { backgroundColor: colors.whiteMuted, borderColor: colors.border },
          ]}
          activeOpacity={0.8}
          accessibilityLabel="Notifications"
          accessibilityHint="View notifications"
        >
          <FontAwesome
            name="bell"
            size={Layout.driverHeaderActionIconSize}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.03,
          shadowRadius: 6,
        }
      : { elevation: 1 }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.driverHeaderGap,
    flex: 1,
    minWidth: 0,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  avatarBtn: {
    padding: 2,
    alignSelf: 'flex-start',
  },
  avatarStack: {
    width: ONLINE_RING_SIZE,
    height: ONLINE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlinePresenceRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  welcomeTitle: {
    ...Typography.headerTitle,
    textTransform: 'none',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageBtn: {
    minWidth: Layout.driverHeaderActionSize,
    height: Layout.driverHeaderActionSize,
    paddingHorizontal: 8,
    borderRadius: Layout.driverHeaderActionSize / 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  languageCode: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    lineHeight: 11,
  },
  notificationBtn: {
    width: Layout.driverHeaderActionSize,
    height: Layout.driverHeaderActionSize,
    borderRadius: Layout.driverHeaderActionSize / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

