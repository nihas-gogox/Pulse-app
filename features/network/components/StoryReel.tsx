/**
 * Network stories row — circular avatars with gradient rings (unseen / seen).
 */
import { PartyAvatar } from "@/components/PartyAvatar";
import { PulseBrandMark } from '@/components/brand/PulseBrandMark';
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { type PostRow } from "@/features/network/services/posts.service";
import { isIndentStoryLive } from "@/features/network/utils/indentStoryWindow.util";
import { splitLocationParts } from "@/features/network/utils/storyDisplay";
import { recordReachEvent } from "@/features/reach/services/events.service";
import { useLiveOwnLoadStoriesQuery } from "@/lib/queries/usePostsQuery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface StoryReelProps {
  posts: PostRow[];
  orgId?: string;
  orgName?: string;
  onCreatePost: () => void;
  headerActions?: React.ReactNode;
  /** Inside desktop 80% story column — trim outer horizontal padding. */
  embedded?: boolean;
  /**
   * Whether this org may post/broadcast load stories. Asset-only orgs can
   * view stories but never create them (they cannot give load). Default true.
   */
  canCreatePost?: boolean;
  /**
   * @deprecated No longer read. This used to duplicate a connected org's
   * sponsored post into an organic twin + an Ad bubble, which made one indent
   * look like two loads. Sponsored posts now render once. Kept so existing
   * call sites keep compiling; safe to drop from callers.
   */
  networkPartnerOrgIds?: ReadonlySet<string>;
  /**
   * When false, skip the live-own-LOAD stories query (e.g. trip/chat embeds that
   * already pass partner posts). Default true for Network / Load Center.
   */
  fetchLiveOwnLoads?: boolean;
}

type StoryMetrics = {
  avatar: number;
  ring: number;
  itemWidth: number;
  labelSize: number;
  labelLineHeight: number;
  addBadge: number;
  plusSize: number;
};

/** Mobile / stacked layout — compact story bubbles. */
const STORY_METRICS_DEFAULT: StoryMetrics = {
  avatar: 56,
  ring: 64,
  itemWidth: 72,
  labelSize: 10,
  labelLineHeight: 13,
  addBadge: 24,
  plusSize: 14,
};

/** Desktop story strip — slightly larger avatars and labels. */
const STORY_METRICS_EMBEDDED: StoryMetrics = {
  avatar: 72,
  ring: 84,
  itemWidth: 92,
  labelSize: 12,
  labelLineHeight: 15,
  addBadge: 28,
  plusSize: 16,
};

function storyMetricsFor(embedded: boolean): StoryMetrics {
  return embedded ? STORY_METRICS_EMBEDDED : STORY_METRICS_DEFAULT;
}

const RING_UNSEEN = ["#f43f5e", "#f59e0b", Theme.brandBluePressed, Theme.brandBlueInk] as const;
const RING_SEEN = ["#cbd5e1", "#94a3b8"] as const;
const RING_MINE_ACTIVE = ["#4D3636", "#22d3ee", "#10b981"] as const;
const RING_MINE_IDLE = ["#e2e8f0", "#cbd5e1"] as const;
/** Sponsored Reach stories — warm brown ring so they read apart from connection stories. */
const RING_SPONSORED = [Theme.accentBrown, Theme.accentBrownDeep] as const;
const RING_SPONSORED_SEEN = ["#c4b5a5", "#a89080"] as const;

const ACCENT_TOKENS = [Theme.accentGold, Theme.darkGreen, Theme.primary, Theme.brandBluePressed] as const;

function seedColor(id: string | null | undefined): string {
  const key = (id ?? "").trim() || "fleet";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i)) % ACCENT_TOKENS.length;
  return ACCENT_TOKENS[h];
}

function storyLane(post: PostRow): "ad" | "organic" {
  return post.is_sponsored ? "ad" : "organic";
}

function storySeenKey(post: PostRow): string {
  return `${post.organization_id ?? "fleet"}:${post.type}:${storyLane(post)}`;
}

function storyDedupeKey(post: PostRow): string {
  return `${post.organization_id}:${post.type}:${storyLane(post)}`;
}

function storyBubbleKey(post: PostRow): string {
  return `${post.id}:${storyLane(post)}`;
}

/**
 * One indent = one bubble. A boosted post from a connected org previously
 * rendered twice here (an organic twin with the Ad chrome stripped, plus the
 * sponsored original), so the same load read as two separate loads in the
 * strip. Sponsored posts now show once, with their Ad badge, whether or not
 * the poster is already a connection.
 */

function StoryAvatar({
  name,
  avatarUrl,
  avatarSeed,
  organizationImageUrl,
  organizationAvatarSeed,
  initialsColorSeed,
  entityType = "supplier" as const,
  size,
}: {
  name: string;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  organizationImageUrl?: string | null;
  organizationAvatarSeed?: string | null;
  initialsColorSeed?: string | null;
  entityType?: "client" | "supplier" | "driver";
  size: number;
}) {
  return (
    <PartyAvatar
      name={name}
      avatarUrl={avatarUrl}
      avatarSeed={avatarSeed}
      organizationImageUrl={organizationImageUrl}
      organizationAvatarSeed={organizationAvatarSeed}
      initialsColorSeed={initialsColorSeed}
      entityType={entityType}
      size={size}
      style={styles.avatarPlain}
      borderStyle={styles.avatarPlain}
    />
  );
}

/** Tiny vehicle + route preview inside the story ring (replaces org initials). */
function StoryLoadPreview({
  post,
  size,
}: {
  post: PostRow;
  size: number;
}) {
  const isLoad = post.type === "LOAD";
  const vehicleRaw = post.vehicle_type?.trim() || (isLoad ? "Load" : "Vehicle");
  const vehicle =
    vehicleRaw.length > 14 ? `${vehicleRaw.slice(0, 13)}…` : vehicleRaw;
  const origin = splitLocationParts(post.origin).city;
  const drop = isLoad
    ? splitLocationParts(post.destination).city
    : splitLocationParts(post.destination).city || "Anywhere";
  const originShort = origin.length > 8 ? `${origin.slice(0, 7)}…` : origin || "—";
  const dropShort = drop.length > 8 ? `${drop.slice(0, 7)}…` : drop || "—";
  const pad = Math.max(4, Math.round(size * 0.08));
  const vehicleSize = size >= 68 ? 8 : 7;
  const routeSize = size >= 68 ? 7 : 6;

  return (
    <View
      style={[
        styles.loadPreview,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          paddingHorizontal: pad,
        },
      ]}
    >
      <Text
        style={[styles.loadPreviewVehicle, { fontSize: vehicleSize, lineHeight: vehicleSize + 1 }]}
        numberOfLines={2}
      >
        {vehicle}
      </Text>
      <Text
        style={[styles.loadPreviewRoute, { fontSize: routeSize, lineHeight: routeSize + 1 }]}
        numberOfLines={1}
      >
        {originShort}
      </Text>
      <Text
        style={[styles.loadPreviewArrow, { fontSize: routeSize, lineHeight: routeSize + 1 }]}
        numberOfLines={1}
      >
        →
      </Text>
      <Text
        style={[styles.loadPreviewRoute, { fontSize: routeSize, lineHeight: routeSize + 1 }]}
        numberOfLines={1}
      >
        {dropShort}
      </Text>
    </View>
  );
}

function StoryGradientRingSized({
  colors,
  ringSize,
  gapSize,
  children,
}: {
  colors: readonly string[];
  ringSize: number;
  gapSize: number;
  children: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={[colors[0], colors[1]] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.ringGradientBase,
        { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
      ]}
    >
      <View
        style={[
          styles.ringGapBase,
          {
            width: gapSize,
            height: gapSize,
            borderRadius: gapSize / 2,
          },
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

function StoryBubble({
  label,
  ringColors,
  metrics,
  onPress,
  onPressIn,
  onPressOut,
  scale,
  children,
  badge,
  caption,
  accessibilityLabel,
}: {
  label: string;
  ringColors: readonly string[];
  metrics: StoryMetrics;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  scale?: Animated.Value;
  children: React.ReactNode;
  badge?: React.ReactNode;
  /** Tiny line under the name (e.g. sponsored “Ad”). */
  caption?: string;
  accessibilityLabel?: string;
}) {
  const gapSize = metrics.avatar + 3;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        styles.storyItem,
        { width: metrics.itemWidth },
        pressed && styles.storyItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Animated.View
        style={[
          styles.bubbleScale,
          scale ? { transform: [{ scale }] } : undefined,
        ]}
      >
        <View
          style={[
            styles.ringStack,
            { width: metrics.ring, height: metrics.ring },
          ]}
        >
          <StoryGradientRingSized
            colors={ringColors}
            ringSize={metrics.ring}
            gapSize={gapSize}
          >
            {children}
          </StoryGradientRingSized>
          {badge}
        </View>
      </Animated.View>
      <Text
        style={[
          styles.storyName,
          { fontSize: metrics.labelSize, lineHeight: metrics.labelLineHeight },
          caption ? styles.storyNameWithCaption : null,
        ]}
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

function BroadcastStory({
  post,
  seen,
  onPress,
  metrics,
}: {
  post: PostRow;
  seen: boolean;
  onPress: () => void;
  metrics: StoryMetrics;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const accent = seedColor(post.organization_id);
  const isSponsored = !!post.is_sponsored;
  const ringColors = isSponsored
    ? seen
      ? RING_SPONSORED_SEEN
      : RING_SPONSORED
    : seen
      ? RING_SEEN
      : ([accent, RING_UNSEEN[1], RING_UNSEEN[2]] as const);

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }).start();

  const shortName = post.org_name.trim().split(/\s+/)[0] ?? post.org_name;
  const origin = splitLocationParts(post.origin).city;
  const drop =
    post.type === "LOAD"
      ? splitLocationParts(post.destination).city
      : splitLocationParts(post.destination).city || "Anywhere";
  const a11yDetail = [
    post.vehicle_type?.trim(),
    origin && drop ? `${origin} to ${drop}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <StoryBubble
      label={shortName}
      ringColors={ringColors}
      metrics={metrics}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      scale={scale}
      accessibilityLabel={
        isSponsored
          ? `${shortName}, sponsored ad${a11yDetail ? `, ${a11yDetail}` : ""}`
          : `${shortName}${a11yDetail ? `, ${a11yDetail}` : ""}`
      }
      caption={isSponsored ? "Ad" : undefined}
      badge={
        isSponsored ? (
          <View style={styles.adsBadge} pointerEvents="none">
            <View style={styles.adsBadgeInner}>
              <Text style={styles.adsBadgeText}>Ad</Text>
            </View>
          </View>
        ) : undefined
      }
    >
      <StoryLoadPreview post={post} size={metrics.avatar} />
    </StoryBubble>
  );
}

export function StoryReel({
  posts,
  orgId,
  orgName,
  onCreatePost,
  embedded = false,
  canCreatePost = true,
  fetchLiveOwnLoads = true,
}: StoryReelProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const { currentOrganization } = useOrganization();
  /** Same source as Load Center green Pulse — not limited to network-feed rows. */
  const liveOwnLoadsQ = useLiveOwnLoadStoriesQuery(orgId ?? null, {
    enabled: fetchLiveOwnLoads,
  });
  const [seenKeys, setSeenKeys] = useState<Record<string, true>>({});
  const seenStorageKey = `q:stories:seen:${orgId ?? "global"}`;
  /** Impression (v1): sponsored story rendered into this strip — NOT "seen
   * by the user". This ScrollView isn't virtualized, so every story mounts
   * immediately on render; a 5-story strip records 5 impressions even if
   * the user only ever looks at the first one. That's an intentional,
   * documented proxy (see docs/REACH_DELIVERY_ENGINE_DESIGN.md, "Current
   * instrumentation gap") — Impression (v2), viewport-based visibility, is
   * a later refinement if the pilot's Views/Impressions ratio shows this
   * proxy inflating impressions materially. Deduped per campaign per
   * session. */
  const recordedImpressionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(seenStorageKey)
      .then((raw) => {
        if (!mounted) return;
        if (!raw) {
          setSeenKeys({});
          return;
        }
        const parsed = JSON.parse(raw) as Record<string, true>;
        setSeenKeys(parsed && typeof parsed === "object" ? parsed : {});
      })
      .catch(() => {
        if (mounted) setSeenKeys({});
      });
    return () => {
      mounted = false;
    };
  }, [seenStorageKey]);

  const markStorySeen = useCallback(
    (post: PostRow) => {
      const key = storySeenKey(post);
      setSeenKeys((prev) => {
        if (prev[key]) return prev;
        const next = { ...prev, [key]: true as const };
        AsyncStorage.setItem(seenStorageKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [seenStorageKey],
  );

  const businessOnly = [...posts]
    .filter((p) => p.type === "LOAD" || p.type === "VEHICLE_AVAILABILITY")
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    );
  const seenStoryKeys = new Set<string>();
  const stories: PostRow[] = [];
  const ownStories: PostRow[] = [];
  const otherStories: PostRow[] = [];
  for (const p of businessOnly) {
    if (p.organization_id === orgId) {
      // Network feed still returns own awarded LOADs for shipper history —
      // never put those in the Mine story queue.
      if (p.type === "LOAD" && p.source_indent_id && !isIndentStoryLive(p)) {
        continue;
      }
      if (p.type === "LOAD" && p.source_indent_id && p.is_active === false) {
        continue;
      }
      ownStories.push(p);
    } else otherStories.push(p);
  }
  const ordered = [...otherStories];
  for (const p of ordered) {
    const storyKey = storyDedupeKey(p);
    if (!seenStoryKeys.has(storyKey)) {
      seenStoryKeys.add(storyKey);
      stories.push(p);
    }
    if (stories.length >= 24) break;
  }
  /**
   * Mine queue = every live indent LOAD (green Pulse) + own capacity stories from
   * the feed. Do not drop sponsored loads — a boosted indent is still a live story.
   * Prefer `listLiveOwnLoadStories` over feed rows so missing feed entries still
   * produce multiple progress segments in story preview.
   */
  const ownStoryQueueResolved = useMemo(() => {
    const byId = new Map<string, PostRow>();
    for (const p of liveOwnLoadsQ.data ?? []) {
      byId.set(p.id, p);
    }
    for (const p of ownStories) {
      if (p.type === "LOAD" && p.source_indent_id) {
        // Live query is authoritative for indent LOADs; skip stale feed-only rows.
        if ((liveOwnLoadsQ.data?.length ?? 0) > 0) continue;
      }
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return [...byId.values()].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    );
  }, [liveOwnLoadsQ.data, ownStories]);
  const latestOwnStory = ownStoryQueueResolved[0];
  const storyQueueIds = stories.map((s) => s.id).join(",");
  const ownStoryQueueIds = ownStoryQueueResolved.map((s) => s.id).join(",");
  const hasOwnStories = ownStoryQueueResolved.length > 0;

  /** Mine bubble is the org brand (logo), not the signed-in user's personal avatar. */
  const mineAvatar = useMemo(() => {
    const orgLogo =
      (currentOrganization?.id === orgId
        ? currentOrganization?.logo_url
        : null
      )?.trim() ||
      (latestOwnStory?.org_avatar_url ?? "").trim() ||
      null;
    const orgSeed =
      (latestOwnStory?.org_avatar_seed ?? "").trim() || null;
    const name =
      (orgName ?? "").trim() ||
      (currentOrganization?.id === orgId
        ? currentOrganization?.name
        : null
      )?.trim() ||
      (latestOwnStory?.org_name ?? "").trim() ||
      profile?.displayName?.trim() ||
      profile?.full_name?.trim() ||
      "Mine";
    return {
      name,
      organizationImageUrl: orgLogo,
      organizationAvatarSeed: orgSeed,
      /** Personal photo only when the org has no logo yet. */
      avatarUrl: orgLogo ? null : (profile?.avatar_url ?? null),
      avatarSeed: orgLogo || orgSeed ? null : (profile?.avatar_seed ?? null),
      initialsColorSeed: orgId ?? currentOrganization?.id ?? null,
    };
  }, [
    currentOrganization?.id,
    currentOrganization?.logo_url,
    currentOrganization?.name,
    latestOwnStory?.org_avatar_seed,
    latestOwnStory?.org_avatar_url,
    latestOwnStory?.org_name,
    orgId,
    orgName,
    profile?.avatar_seed,
    profile?.avatar_url,
    profile?.displayName,
    profile?.full_name,
  ]);

  useEffect(() => {
    if (!orgId) return;
    for (const post of stories) {
      if (!post.is_sponsored || !post.reach_campaign_id) continue;
      if (recordedImpressionsRef.current.has(post.reach_campaign_id)) continue;
      recordedImpressionsRef.current.add(post.reach_campaign_id);
      recordReachEvent(post.reach_campaign_id, "impression", orgId);
    }
    // storyQueueIds (not `stories`, a fresh array every render) is the stable
    // signal for "the set of rendered story ids changed".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyQueueIds, orgId]);

  const mineRing = hasOwnStories ? RING_MINE_ACTIVE : RING_MINE_IDLE;
  const metrics = storyMetricsFor(embedded);

  return (
    <View style={[styles.wrap, embedded && styles.wrapEmbedded]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          embedded && styles.scrollEmbedded,
          embedded && styles.scrollEmbeddedDesktop,
        ]}
      >
        <View style={[styles.mineCluster, embedded && styles.mineClusterEmbedded]}>
          <StoryBubble
            label="Mine"
            ringColors={mineRing}
            metrics={metrics}
            onPress={() => {
            if (!latestOwnStory) {
              // Asset-only orgs can't post loads — the empty bubble is a no-op.
              if (canCreatePost) onCreatePost();
              return;
            }
            markStorySeen(latestOwnStory);
            router.push({
              pathname: "/(modals)/story-detail",
              params: {
                postId: latestOwnStory.id,
                orgId: latestOwnStory.organization_id,
                storyType: latestOwnStory.type,
                queue: ownStoryQueueIds,
              },
            });
          }}
          badge={
            canCreatePost ? (
            <View
              style={[
                styles.addBadge,
                {
                  width: metrics.addBadge,
                  height: metrics.addBadge,
                  borderRadius: metrics.addBadge / 2,
                },
              ]}
              {...(Platform.OS === "web"
                ? {
                    onClick: (e: { stopPropagation: () => void }) => {
                      e.stopPropagation();
                      router.push("/(modals)/create-post");
                    },
                  }
                : {
                    onStartShouldSetResponder: () => true,
                    onResponderRelease: () => router.push("/(modals)/create-post"),
                  })}
              hitSlop={8}
              {...(Platform.OS !== "web" && { accessibilityRole: "button" as const })}
              accessibilityLabel="Add story"
            >
              <Plus size={metrics.plusSize} color={Theme.textPrimaryDark} strokeWidth={2.6} />
            </View>
            ) : undefined
          }
        >
          <StoryAvatar
            name={mineAvatar.name}
            organizationImageUrl={mineAvatar.organizationImageUrl}
            organizationAvatarSeed={mineAvatar.organizationAvatarSeed}
            avatarUrl={mineAvatar.avatarUrl}
            avatarSeed={mineAvatar.avatarSeed}
            initialsColorSeed={mineAvatar.initialsColorSeed}
            entityType="supplier"
            size={metrics.avatar}
          />
          </StoryBubble>
          <View
            style={[
              styles.pulseStoryWatermark,
              embedded && styles.pulseStoryWatermarkEmbedded,
              { marginTop: Math.max(0, (metrics.ring - (embedded ? 48 : 38)) / 2) },
            ]}
            pointerEvents="none"
          >
            <PulseBrandMark
              size="lg"
              textStyle={[styles.watermarkPulse, embedded && styles.watermarkPulseEmbedded]}
            />
            <Text style={[styles.watermarkStory, embedded && styles.watermarkStoryEmbedded]}>
              story
            </Text>
          </View>
        </View>

        {stories.map((post) => (
          <BroadcastStory
            key={storyBubbleKey(post)}
            post={post}
            metrics={metrics}
            seen={!!seenKeys[storySeenKey(post)]}
            onPress={() => {
              markStorySeen(post);
              router.push({
                pathname: "/(modals)/story-detail",
                params: {
                  postId: post.id,
                  orgId: post.organization_id,
                  storyType: post.type,
                  queue: storyQueueIds,
                },
              });
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingBottom: 12,
    overflow: "visible",
  },
  wrapEmbedded: {
    paddingTop: 10,
    paddingBottom: 12,
    minWidth: 0,
    overflow: "visible",
  },
  scroll: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    gap: 10,
    alignItems: "flex-start",
    paddingRight: 12,
    paddingTop: 2,
    // Room for the floating Ad chip that hangs below the ring.
    paddingBottom: 8,
    overflow: "visible",
  },
  scrollEmbedded: {
    // Parent (Network top cluster) already applies screen horizontal inset.
    paddingHorizontal: 0,
    paddingRight: 4,
  },
  scrollEmbeddedDesktop: {
    gap: 12,
    paddingTop: 2,
    paddingBottom: 8,
  },
  mineCluster: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginRight: 4,
    flexShrink: 0,
    paddingVertical: 2,
  },
  mineClusterEmbedded: {
    gap: 12,
    marginRight: 8,
    paddingVertical: 4,
  },
  pulseStoryWatermark: {
    justifyContent: "center",
    opacity: 0.14,
    minWidth: 52,
  },
  pulseStoryWatermarkEmbedded: {
    opacity: 0.14,
    minWidth: 64,
  },
  watermarkPulse: {
    fontWeight: '700',
  },
  watermarkPulseEmbedded: {
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1,
  },
  watermarkStory: {
    fontSize: 16,
    fontWeight: "600",
    fontStyle: "italic",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.4,
    lineHeight: 19,
    alignSelf: "flex-end",
    marginTop: -2,
  },
  watermarkStoryEmbedded: {
    fontSize: 20,
    lineHeight: 23,
  },
  storyItem: {
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
  },
  storyItemPressed: {
    opacity: 0.92,
  },
  bubbleScale: {
    overflow: "visible",
  },
  ringStack: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  ringGradientBase: {
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringGapBase: {
    backgroundColor: Theme.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    padding: 1.5,
  },
  avatarPlain: {
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
  },
  loadPreview: {
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  loadPreviewVehicle: {
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textAlign: "center",
    letterSpacing: -0.2,
    width: "100%",
  },
  loadPreviewRoute: {
    fontWeight: "600",
    color: Theme.textPrimary,
    textAlign: "center",
    letterSpacing: -0.1,
    width: "100%",
  },
  loadPreviewArrow: {
    fontWeight: "700",
    color: Theme.accentBrown,
    textAlign: "center",
    marginVertical: -1,
  },
  addBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: Theme.loadMainTabBg,
    borderWidth: 2,
    borderColor: Theme.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Theme.loadMainTabBg,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 3,
  },
  /** Floating Ad chip — centered under the ring, not clipped by ring height. */
  adsBadge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  adsBadgeInner: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Theme.accentBrown,
    borderWidth: 1.5,
    borderColor: Theme.screenBackground,
    shadowColor: Theme.accentBrownDeep,
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  adsBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: Theme.textOnPrimary,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    lineHeight: 10,
  },
  storyName: {
    marginTop: 6,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.1,
    textAlign: "center",
    width: "100%",
  },
  storyNameWithCaption: {
    marginTop: 8,
    marginBottom: 0,
  },
  storyCaption: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "800",
    color: Theme.accentBrown,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
    width: "100%",
  },
});
