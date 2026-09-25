/**
 * Driver / FO Stories strip — Network-style pulse story row.
 * Mine (+ capacity) → Fleet availability bubbles → Boosted LOAD bubbles.
 */
import { PartyAvatar } from '@pulse/features/components/PartyAvatar';
import Layout from '@pulse/core/constants/Layout';
import Theme from '@pulse/core/constants/Theme';
import type { FleetOwnerCapacityStory } from '../../driver/services/fleetOwnerCapacityStory.service';
import { storyCityLabel } from '@pulse/domain/features/network/utils/storyDisplay';
import type { DriverReachStoryRow } from '@pulse/domain/features/reach/services/driverReferrals.service';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const AVATAR = 52;
const RING = 58;
const ITEM_W = 66;
const ADD_BADGE = 22;

const RING_MINE_ACTIVE = ['#4D3636', '#22d3ee', '#10b981'] as const;
const RING_MINE_IDLE = ['#e2e8f0', '#cbd5e1'] as const;
const RING_FLEET = [Theme.darkGreen, Theme.accentGold] as const;
const RING_SPONSORED = [Theme.accentBrown, Theme.accentBrownDeep] as const;

type Props = {
  isFleetOwner: boolean;
  avatarUri?: string | null;
  displayName?: string | null;
  capacityStories: FleetOwnerCapacityStory[];
  loads: DriverReachStoryRow[];
  onAddCapacity: () => void;
  onPressCapacity: (story: FleetOwnerCapacityStory) => void;
  onPressLoad: (story: DriverReachStoryRow) => void;
};

function shortLoc(value: string | null | undefined, empty = '—'): string {
  return storyCityLabel(value) || empty;
}

function GradientRing({
  colors,
  children,
}: {
  colors: readonly string[];
  children: ReactNode;
}) {
  const gap = AVATAR + 3;
  return (
    <LinearGradient
      colors={[colors[0], colors[1]] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: RING, height: RING, borderRadius: RING / 2 }]}
    >
      <View style={[styles.ringGap, { width: gap, height: gap, borderRadius: gap / 2 }]}>
        {children}
      </View>
    </LinearGradient>
  );
}

function LoadPreview({
  vehicle,
  origin,
  destination,
}: {
  vehicle: string;
  origin: string;
  destination: string;
}) {
  return (
    <View style={[styles.loadPreview, { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 }]}>
      <Text
        style={styles.loadPreviewVehicle}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {vehicle}
      </Text>
      <Text
        style={styles.loadPreviewRoute}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {origin}
      </Text>
      <Text
        style={styles.loadPreviewRoute}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        → {destination}
      </Text>
    </View>
  );
}

function StoryBubble({
  label,
  ringColors,
  onPress,
  children,
  badge,
  caption,
  accessibilityLabel,
}: {
  label: string;
  ringColors: readonly string[];
  onPress: () => void;
  children: ReactNode;
  badge?: ReactNode;
  caption?: string;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }).start()
      }
      style={({ pressed }) => [styles.storyItem, pressed && styles.storyItemPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Animated.View style={[styles.bubbleScale, { transform: [{ scale }] }]}>
        <View style={[styles.ringStack, { width: RING, height: RING }]}>
          <GradientRing colors={ringColors}>{children}</GradientRing>
          {badge}
        </View>
      </Animated.View>
      <Text
        style={[styles.storyName, caption ? styles.storyNameWithCaption : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {caption ? (
        <Text style={styles.storyCaption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function DriverPulseStoryReel({
  isFleetOwner,
  avatarUri,
  displayName,
  capacityStories,
  loads,
  onAddCapacity,
  onPressCapacity,
  onPressLoad,
}: Props) {
  const hasCapacity = capacityStories.length > 0;
  const mineName = (displayName ?? '').trim().split(/\s+/)[0] || 'Mine';

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {isFleetOwner ? (
          <StoryBubble
            label="Mine"
            ringColors={hasCapacity ? RING_MINE_ACTIVE : RING_MINE_IDLE}
            onPress={() => {
              if (capacityStories[0]) {
                onPressCapacity(capacityStories[0]);
                return;
              }
              onAddCapacity();
            }}
            accessibilityLabel="My availability"
            badge={
              <View
                style={styles.addBadge}
                {...(Platform.OS === 'web'
                  ? {
                      onClick: (e: { stopPropagation: () => void }) => {
                        e.stopPropagation();
                        onAddCapacity();
                      },
                    }
                  : {
                      onStartShouldSetResponder: () => true,
                      onResponderRelease: () => onAddCapacity(),
                    })}
                hitSlop={8}
                {...(Platform.OS !== 'web' && { accessibilityRole: 'button' as const })}
                accessibilityLabel="Share capacity"
              >
                <Plus size={12} color={Theme.textPrimaryDark} strokeWidth={2.6} />
              </View>
            }
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.mineAvatarImg} />
            ) : (
              <PartyAvatar
                name={mineName}
                entityType="driver"
                size={AVATAR}
                style={styles.avatarPlain}
                borderStyle={styles.avatarPlain}
              />
            )}
          </StoryBubble>
        ) : null}

        {capacityStories.map((story) => (
          <StoryBubble
            key={story.id}
            label="Fleet"
            ringColors={RING_FLEET}
            onPress={() => onPressCapacity(story)}
            accessibilityLabel={`Fleet availability, ${story.vehicle_type ?? 'vehicle'}, ${shortLoc(story.origin)} to ${shortLoc(story.destination)}`}
          >
            <LoadPreview
              vehicle={(story.vehicle_type ?? '').trim() || 'Vehicle'}
              origin={shortLoc(story.origin)}
              destination={shortLoc(story.destination, 'Anywhere')}
            />
          </StoryBubble>
        ))}

        {loads.map((story) => {
          const shortName =
            (story.org_name ?? '').trim().split(/\s+/)[0] || 'Shipper';
          return (
            <StoryBubble
              key={story.campaign_id}
              label={shortName}
              ringColors={RING_SPONSORED}
              onPress={() => onPressLoad(story)}
              accessibilityLabel={`${shortName}, sponsored load, ${shortLoc(story.snapshot_origin)} to ${shortLoc(story.snapshot_destination)}`}
              badge={
                <View style={styles.adsBadge} pointerEvents="none">
                  <View style={styles.adsBadgeInner}>
                    <Text style={styles.adsBadgeText}>Ad</Text>
                  </View>
                </View>
              }
            >
              <LoadPreview
                vehicle={(story.snapshot_vehicle_type ?? '').trim() || 'Load'}
                origin={shortLoc(story.snapshot_origin)}
                destination={shortLoc(story.snapshot_destination)}
              />
            </StoryBubble>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Theme.surfaceGray,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  scroll: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    gap: 12,
    alignItems: 'flex-start',
    paddingTop: 4,
    paddingBottom: 6,
  },
  storyItem: {
    width: ITEM_W,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  storyItemPressed: { opacity: 0.92 },
  bubbleScale: { overflow: 'visible' },
  ringStack: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ring: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGap: {
    backgroundColor: Theme.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1.5,
  },
  avatarPlain: {
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  mineAvatarImg: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  loadPreview: {
    overflow: 'hidden',
    backgroundColor: Theme.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 5,
  },
  loadPreviewVehicle: {
    fontSize: 7,
    fontWeight: '800',
    color: Theme.textPrimaryDark,
    textAlign: 'center',
    lineHeight: 8,
    includeFontPadding: false,
  },
  loadPreviewRoute: {
    fontSize: 6,
    fontWeight: '600',
    color: Theme.textSecondary,
    textAlign: 'center',
    lineHeight: 7,
    includeFontPadding: false,
  },
  storyName: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: Theme.brandBlueInk,
    textAlign: 'center',
    width: '100%',
  },
  storyNameWithCaption: { marginTop: 3 },
  storyCaption: {
    marginTop: 0,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
    color: Theme.accentBrown,
    textAlign: 'center',
    width: '100%',
  },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: ADD_BADGE,
    height: ADD_BADGE,
    borderRadius: ADD_BADGE / 2,
    backgroundColor: Theme.accentGold,
    borderWidth: 2,
    borderColor: Theme.screenBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  adsBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -6,
    alignItems: 'center',
    zIndex: 2,
  },
  adsBadgeInner: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: Theme.accentBrownWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.accentBrownBorder,
  },
  adsBadgeText: {
    fontSize: 7,
    fontWeight: '800',
    color: Theme.accentBrown,
    letterSpacing: 0.2,
  },
});
