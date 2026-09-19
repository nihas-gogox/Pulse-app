/**
 * Network feed post card.
 * UPDATE = white card with left color bar, org avatar, social actions.
 * LOAD = dark trip-style card (aligns with Trips hub / ledger bar).
 *
 * LOAD commercial truth (price, bid CTA, boost) comes from
 * resolveCommercialOpportunity() — do not re-derive here.
 */
import Layout from '@/constants/Layout';
import Theme from '@/constants/Theme';
import Typography from '@/constants/Typography';
import {
  resolveCommercialOpportunity,
  type CommercialAction,
} from '@/features/marketplace/domain';
import { type PostRow } from '@/features/network/services/posts.service';
import { formatWeightChip } from '@/features/network/utils/bidding/perMtBidPresentation.util';
import { formatINR } from '@/lib/format';
import { PartyAvatar } from '@/components/PartyAvatar';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Clock3,
  MessageSquare,
  Package,
  Rocket,
  ThumbsUp,
  Truck,
} from 'lucide-react-native';
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface PostCardProps {
  post: PostRow;
  orgId: string;
  onBid?: (post: PostRow) => void;
  onDetail?: (post: PostRow) => void;
  /** Owner-only — opens the Boost picker for this (not-yet-boosted) post. */
  onBoost?: (post: PostRow) => void;
}

/** Tesla theme accents — no arbitrary neon; cycles through brand palette. */
const ACCENT_TOKENS = [
  Theme.teslaRed,
  Theme.darkGreen,
  Theme.primary,
  Theme.textPrimaryDark,
] as const;

function seedColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % ACCENT_TOKENS.length;
  return ACCENT_TOKENS[h];
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Update Card ─────────────────────────────────────────────────────────────

function UpdateCard({ post, color, onPress }: { post: PostRow; color: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
      <Animated.View style={[styles.updateCard, { transform: [{ scale }] }]}>
        <View style={[styles.colorBar, { backgroundColor: color }]} />
        <View style={styles.updateInner}>
          {/* Header */}
          <View style={styles.postHeader}>
            <PartyAvatar
              name={post.org_name}
              initialsColorSeed={post.organization_id}
              avatarSeed={post.org_avatar_seed}
              entityType="supplier"
              size={40}
              style={styles.orgAvatar}
            />
            <View style={styles.postMeta}>
              <Text style={styles.orgName}>{post.org_name.toUpperCase()}</Text>
              <View style={styles.metaRow}>
                <Clock3 size={10} color={Theme.textSecondary} />
                <Text style={styles.timeText}>{timeAgo(post.created_at)}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>UPDATE</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Content */}
          {post.content ? (
            <Text style={styles.updateContent} numberOfLines={4}>{post.content}</Text>
          ) : null}

          {/* Social actions */}
          <View style={styles.socialRow}>
            <Pressable style={styles.socialBtn} hitSlop={8}>
              <ThumbsUp size={14} color={Theme.textSecondary} />
              <Text style={styles.socialBtnText}>Acknowledge</Text>
            </Pressable>
            <Pressable style={styles.socialBtn} onPress={onPress} hitSlop={8}>
              <MessageSquare size={14} color={Theme.textSecondary} />
              <Text style={styles.socialBtnText}>Briefing</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Load Card ────────────────────────────────────────────────────────────────

function LoadCard({
  post,
  isOwner,
  displayPrice,
  primaryAction,
  onPrimaryAction,
  onPress,
}: {
  post: PostRow;
  color: string;
  isOwner: boolean;
  displayPrice: number | null;
  primaryAction: CommercialAction | null;
  onPrimaryAction?: () => void;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
      <Animated.View style={[styles.loadCard, { transform: [{ scale }] }]}>
        {/* Dark header */}
        <View style={styles.loadHeader}>
          <View style={styles.loadHeaderLeft}>
            <PartyAvatar
              name={post.org_name}
              initialsColorSeed={post.organization_id}
              avatarSeed={post.org_avatar_seed}
              entityType="supplier"
              size={40}
              style={styles.orgAvatarDark}
            />
            <View>
              <Text style={styles.orgNameDark}>{post.org_name.toUpperCase()}</Text>
              <View style={styles.metaRowDark}>
                <Clock3 size={9} color="rgba(255,255,255,0.35)" />
                <Text style={styles.timeTextDark}>{timeAgo(post.created_at)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.loadBadgeGroup}>
            {post.is_sponsored ? (
              <View style={styles.sponsoredBadge}>
                <Rocket size={9} color={Theme.accentGold} />
                <Text style={styles.sponsoredBadgeText}>SPONSORED</Text>
              </View>
            ) : null}
            <View style={styles.loadBadge}>
              <Truck size={9} color={Theme.teslaRed} />
              <Text style={styles.loadBadgeText}>LOAD</Text>
            </View>
          </View>
        </View>

        {/* Route */}
        {post.origin && post.destination && (
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, styles.routeDotOrigin]} />
              <Text style={styles.routeCity} numberOfLines={4}>{post.origin}</Text>
            </View>
            <View style={styles.routeLine}>
              <View style={styles.routeLineBar} />
              <ArrowRight size={14} color={Theme.textMuted} />
            </View>
            <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
              <View style={[styles.routeDot, styles.routeDotDest]} />
              <Text style={styles.routeCity} numberOfLines={4}>{post.destination}</Text>
            </View>
          </View>
        )}

        {/* Chips row */}
        <View style={styles.chipsRow}>
          {post.vehicle_type && (
            <View style={styles.darkChip}>
              <Truck size={9} color="rgba(255,255,255,0.45)" />
              <Text style={styles.darkChipText}>{post.vehicle_type}</Text>
            </View>
          )}
          {formatWeightChip(post.weight_tonnes) ? (
            <View style={styles.darkChip}>
              <Package size={9} color="rgba(255,255,255,0.45)" />
              <Text style={styles.darkChipText}>
                {formatWeightChip(post.weight_tonnes)}
              </Text>
            </View>
          ) : null}
          {post.material && (
            <View style={styles.darkChip}>
              <Text style={styles.darkChipText}>{post.material}</Text>
            </View>
          )}
        </View>

        {/* Rate + action — from CommercialOpportunity */}
        <View style={styles.loadFooter}>
          {displayPrice != null ? (
            <View>
              <Text style={styles.rateLabel}>TARGET RATE</Text>
              <Text style={styles.rateValue}>{formatINR(displayPrice)}</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.rateLabel}>RATE</Text>
              <Text style={styles.rateOpen}>Open for bids</Text>
            </View>
          )}

          {primaryAction?.kind === "bid" || primaryAction?.kind === "edit_bid" || primaryAction?.kind === "respond_counter" ? (
            <Pressable style={styles.bidBtn} onPress={onPrimaryAction}>
              <ThumbsUp size={13} color={Theme.textOnPrimary} />
              <Text style={styles.bidBtnText}>{primaryAction.label}</Text>
            </Pressable>
          ) : primaryAction?.kind === "boost" ? (
            <Pressable style={styles.boostBtn} onPress={onPrimaryAction}>
              <Rocket size={13} color={Theme.textPrimaryDark} />
              <Text style={styles.boostBtnText}>{primaryAction.label}</Text>
            </Pressable>
          ) : primaryAction?.kind === "view_bids" || primaryAction?.kind === "award" ? (
            <Pressable style={styles.viewBidsBtn} onPress={onPress}>
              <Text style={styles.viewBidsBtnText}>{primaryAction.label}</Text>
            </Pressable>
          ) : isOwner && post.bid_count > 0 ? (
            <Pressable style={styles.viewBidsBtn} onPress={onPress}>
              <Text style={styles.viewBidsBtnText}>
                {post.bid_count} Bid{post.bid_count !== 1 ? "s" : ""}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function PostCard({ post, orgId, onBid, onDetail, onBoost }: PostCardProps) {
  const router = useRouter();
  const color = seedColor(post.organization_id ?? "");
  const isOwner = post.organization_id === orgId;

  const opportunity = useMemo(
    () =>
      resolveCommercialOpportunity({
        viewerOrgId: orgId || null,
        ownerOrgId: post.organization_id ?? "",
        isLoad: post.type === "LOAD",
        postIsActive: post.is_active,
        bidCount: post.bid_count ?? 0,
        rateOffer: post.rate_offer,
        isSponsored: post.is_sponsored,
        reachCampaignId: post.reach_campaign_id,
      }),
    [
      orgId,
      post.organization_id,
      post.type,
      post.is_active,
      post.bid_count,
      post.rate_offer,
      post.is_sponsored,
      post.reach_campaign_id,
    ],
  );

  const handlePress = () => {
    if (onDetail) onDetail(post);
    else router.push({ pathname: '/(modals)/post-detail', params: { postId: post.id } });
  };

  const handlePrimary = () => {
    const kind = opportunity.actions.primary?.kind;
    if (kind === "bid" || kind === "edit_bid" || kind === "respond_counter") {
      onBid?.(post);
      return;
    }
    if (kind === "boost") {
      onBoost?.(post);
      return;
    }
    handlePress();
  };

  if (post.type === 'LOAD') {
    return (
      <LoadCard
        post={post}
        color={color}
        isOwner={isOwner}
        displayPrice={opportunity.pricing.displayPrice}
        primaryAction={opportunity.actions.primary}
        onPrimaryAction={handlePrimary}
        onPress={handlePress}
      />
    );
  }

  return <UpdateCard post={post} color={color} onPress={handlePress} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Update card
  updateCard: {
    flexDirection: 'row',
    backgroundColor: Theme.screenBackground,
    borderRadius: 16,
    marginHorizontal: Layout.screenPaddingHorizontal,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.surfaceBorder,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  colorBar: { width: 4 },
  updateInner: { flex: 1, padding: 14, gap: 10 },

  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orgAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgAvatarText: { fontSize: 13, fontWeight: '900', letterSpacing: -0.5 },
  postMeta: { flex: 1 },
  orgName: {
    fontSize: 11,
    fontWeight: '900',
    color: Theme.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 10, color: Theme.textSecondary, fontWeight: '600' },
  typePill: {
    backgroundColor: Theme.fiscalTabActiveBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderMedium,
  },
  typePillText: {
    ...Typography.subTabLabel,
    fontSize: 7,
    color: Theme.primary,
  },

  updateContent: {
    fontSize: 14,
    fontWeight: '500',
    color: Theme.textPrimary,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  socialRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.surfaceBorder,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderMedium,
  },
  socialBtnText: { fontSize: 10, fontWeight: '700', color: Theme.textSecondary },

  // Load card
  loadCard: {
    backgroundColor: Theme.ledgerNetBarBg,
    borderRadius: 16,
    marginHorizontal: Layout.screenPaddingHorizontal,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.separatorDark,
    shadowColor: Theme.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  loadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 10,
  },
  loadHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orgAvatarDark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgNameDark: {
    fontSize: 10,
    fontWeight: '800',
    color: Theme.textOnDark,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaRowDark: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeTextDark: { fontSize: 9, color: Theme.textOnDarkMuted, fontWeight: '600' },
  loadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232, 33, 39, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(232, 33, 39, 0.35)',
  },
  loadBadgeText: { ...Typography.subTabLabel, fontSize: 7, color: Theme.teslaRed },
  loadBadgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  sponsoredBadgeText: { ...Typography.subTabLabel, fontSize: 7, color: Theme.accentGold },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  routePoint: { flex: 1, gap: 5 },
  routeDot: { width: 6, height: 6, borderRadius: 3 },
  routeDotOrigin: { backgroundColor: Theme.textOnDark, opacity: 0.5 },
  routeDotDest: { backgroundColor: Theme.positive, opacity: 1 },
  routeCity: { ...Typography.networkLoadRouteCity, color: Theme.textOnDark, fontSize: 13, lineHeight: 17 },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 6 },
  routeLineBar: { width: 18, height: 1, backgroundColor: Theme.separatorDark },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  darkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  darkChipText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },

  loadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  rateLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  rateValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, color: Theme.gpayAmountReceived },
  rateOpen: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },

  bidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Theme.teslaRed,
  },
  bidBtnText: { fontSize: 11, fontWeight: '800', color: Theme.buttonPrimaryText, letterSpacing: 0.2 },

  viewBidsBtn: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  viewBidsBtnText: { fontSize: 12, fontWeight: '900', color: '#fff' },

  boostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Theme.accentGold,
  },
  boostBtnText: { fontSize: 11, fontWeight: '800', color: Theme.textPrimaryDark, letterSpacing: 0.2 },
});
