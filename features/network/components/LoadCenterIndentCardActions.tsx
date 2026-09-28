/**
 * Footer actions for Load Center hub indent cards (desktop grid).
 *
 * Dense / grid: single row — [status] [share] [primary] [marketplace?] [pulse?]
 * Commerce row: [share] [marketplace] [pulse] [Review]
 */
import {
  HUB_GRID_TOOLBAR_PULSE_SLOT_W,
  HUB_GRID_TOOLBAR_ROW_HEIGHT,
} from "@/components/hub/hubGridCardLayout";
import {
  HubGridCardFooter,
  HubGridPrimaryButton,
  HubGridShareButton,
  HubGridStatusChip,
  HubGridToolbarPlaceholder,
  HubGridToolbarRow,
} from "@/components/hub/HubGridCardToolbar";
import { FontAwesome } from "@expo/vector-icons";
import Theme from "@/constants/Theme";
import { formatINRChip } from "@/lib/format";
import type { IndentRow } from "@/features/indents";
import { BidReceivedHammer } from "@/features/indents";
import { ArrowRight, Package, Share2, Zap } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const FOOTER_BORDER = "rgba(15, 23, 42, 0.06)";
const ROW_HEIGHT = HUB_GRID_TOOLBAR_ROW_HEIGHT;
const LINK = "#2874F0";
const BORDER_SOFT = "#EEEEEE";
/** Expand 32px controls to a ~44pt touch target without growing the row. */
const TOOLBAR_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 } as const;

export type LoadCenterIndentCardActionsLayout = {
  dense?: boolean;
  /**
   * Sit in the card’s Offer / Your bid row (reference: amount left, CTA right).
   * Default true for list cards.
   */
  commerceRow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Card footer wrapper — dense mode uses shared hub grid footer. */
export function LoadCenterIndentCardFooter({
  dense,
  style,
  children,
}: LoadCenterIndentCardActionsLayout & { children: ReactNode }) {
  if (dense) {
    return (
      <HubGridCardFooter dense style={style}>
        {children}
      </HubGridCardFooter>
    );
  }
  return (
    <View style={[styles.footer, style]}>
      {children}
    </View>
  );
}

function PrimaryToolbarPlaceholder({ dense }: { dense?: boolean }) {
  if (dense) {
    return <HubGridToolbarPlaceholder />;
  }
  return <View style={styles.primaryToolbarPlaceholder} />;
}

function InlineActionRow({ children }: { children: ReactNode }) {
  return <View style={styles.inlineRow}>{children}</View>;
}

function InlineLeadingCluster({ children }: { children: ReactNode }) {
  return <View style={styles.leadingCluster}>{children}</View>;
}

function ShareIconButton({
  dense,
  onPress,
  label,
}: {
  dense?: boolean;
  onPress: () => void;
  label: string;
}) {
  if (dense) {
    return (
      <HubGridShareButton
        onPress={onPress}
        label={label}
        icon={
          <Share2 size={14} color={Theme.textMuted} strokeWidth={2.2} />
        }
      />
    );
  }
  return (
    <TouchableOpacity
      style={styles.shareBtn}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityLabel={label}
      hitSlop={TOOLBAR_HIT_SLOP}
    >
      <Share2 size={15} color={Theme.textMuted} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

function PrimaryButton({
  dense,
  label,
  onPress,
  disabled,
  inline,
}: {
  dense?: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Flex within a single toolbar row (grid). */
  inline?: boolean;
}) {
  if (dense && inline) {
    return (
      <HubGridPrimaryButton
        label={label}
        onPress={onPress}
        disabled={disabled}
      />
    );
  }
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        dense && styles.primaryBtnDense,
        inline && styles.primaryBtnInline,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      hitSlop={TOOLBAR_HIT_SLOP}
    >
      <Text
        style={[styles.primaryBtnText, dense && styles.primaryBtnTextDense]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PulseButton({
  dense,
  live,
  busy,
  onPress,
}: {
  dense?: boolean;
  live: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const color = live ? Theme.positive : Theme.destructive;
  return (
    <TouchableOpacity
      style={[
        styles.pulseBtn,
        dense && styles.pulseBtnDense,
        live ? styles.pulseBtnLive : styles.pulseBtnExpired,
        busy && { opacity: 0.7 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={busy}
      accessibilityLabel={
        live
          ? "Pulse story is live"
          : "Reboost indent as a 24 hour Pulse story"
      }
      accessibilityState={{ disabled: busy, selected: live }}
      hitSlop={TOOLBAR_HIT_SLOP}
    >
      <Zap size={dense ? 11 : 12} color={color} strokeWidth={2.2} />
      <Text
        style={[
          styles.pulseBtnText,
          dense && styles.pulseBtnTextDense,
          { color },
        ]}
        numberOfLines={1}
      >
        Pulse
      </Text>
    </TouchableOpacity>
  );
}

/** A2 — contextual Marketplace distribution toggle for an existing indent.
 * Modifies the existing circulation_target (integrated_supplier <-> both) —
 * no new Marketplace entity. Mirrors PulseButton's live/inactive visual
 * language for consistency with the adjacent Reach control. */
function MarketplaceShareButton({
  isShared,
  busy,
  onPress,
}: {
  isShared: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  const color = isShared ? Theme.textOnPrimary : Theme.textMuted;
  return (
    <TouchableOpacity
      style={[
        styles.marketplaceBtn,
        isShared ? styles.marketplaceBtnLive : styles.marketplaceBtnInactive,
        busy && { opacity: 0.7 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={busy}
      accessibilityLabel={
        isShared
          ? "Shared to Marketplace — tap to stop sharing"
          : "Share this load to Marketplace"
      }
      accessibilityState={{ disabled: busy, selected: isShared }}
      hitSlop={TOOLBAR_HIT_SLOP}
    >
      <Package size={11} color={color} strokeWidth={2.2} />
      <Text
        style={[
          styles.marketplaceBtnText,
          isShared && styles.marketplaceBtnTextLive,
          !isShared && { color },
        ]}
        numberOfLines={1}
      >
        {isShared ? "Marketplace · Live" : "Share to Marketplace"}
      </Text>
    </TouchableOpacity>
  );
}

function CommerceLinkCta({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.commerceCta, disabled && styles.commerceCtaDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
      hitSlop={TOOLBAR_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.commerceCtaText} numberOfLines={1}>
        {label}
      </Text>
      <ArrowRight size={11} color={LINK} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

function CommerceActionRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.commerceRow, style]}>{children}</View>;
}

function marketplaceToggleLabel(isShared: boolean): string {
  return isShared
    ? "Shared to Marketplace — tap to stop sharing"
    : "Share this load to Marketplace";
}

function CommerceIconButton({
  onPress,
  label,
  children,
  tone,
  disabled,
}: {
  onPress: () => void;
  label: string;
  children: ReactNode;
  tone?: "live" | "expired" | "default";
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.commerceIconBtn,
        tone === "live" && styles.commerceIconBtnLive,
        tone === "expired" && styles.commerceIconBtnExpired,
        disabled && { opacity: 0.7 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={TOOLBAR_HIT_SLOP}
    >
      {children}
    </TouchableOpacity>
  );
}

function MarketplaceIconButton({
  isShared,
  busy,
  onPress,
  dense,
}: {
  isShared: boolean;
  busy?: boolean;
  onPress: () => void;
  dense?: boolean;
}) {
  const color = isShared ? Theme.positive : Theme.textMuted;
  const icon = (
    <Package size={dense ? 14 : 13} color={color} strokeWidth={2.2} />
  );
  const label = marketplaceToggleLabel(isShared);
  if (dense) {
    return (
      <View
        pointerEvents={busy ? "none" : "auto"}
        style={busy ? { opacity: 0.7 } : undefined}
      >
        <HubGridShareButton onPress={onPress} label={label} icon={icon} />
      </View>
    );
  }
  return (
    <CommerceIconButton
      label={label}
      onPress={onPress}
      tone={isShared ? "live" : "default"}
      disabled={busy}
    >
      {icon}
    </CommerceIconButton>
  );
}

function compactCommerceCtaLabel(label: string): string {
  switch (label) {
    case "View trip":
      return "View trip";
    case "Review Hub":
    case "Review":
      return "Review";
    case "Broadcast":
      return "Broadcast";
    case "Update quote":
    case "Update bid":
    case "Update":
      return "Update bid";
    case "View details":
    case "Details":
      return "View";
    case "Allocate":
      return "Allocate";
    case "New quote":
    case "Rebid":
      return "Rebid";
    case "Respond to counter":
      return "Respond";
    case "Bid now":
    case "View & bid":
      return "Bid";
    default:
      return label;
  }
}

function PendingChip({ dense }: { dense?: boolean }) {
  if (dense) {
    return (
      <View style={styles.pendingChipDenseBtn}>
        <Text style={styles.pendingTextDense} numberOfLines={1}>
          Pending
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.pendingChip}>
      <Text style={styles.pendingText} numberOfLines={1}>
        Pending
      </Text>
    </View>
  );
}

/** Compact bids / status chip for the toolbar row. */
export function GiveLoadBidChip({
  bidCount,
  isDone,
  isAwardedPendingTrip,
  awardedAmountLabel,
  awardedAmount,
  dense,
}: {
  bidCount: number;
  isDone: boolean;
  isAwardedPendingTrip: boolean;
  awardedAmountLabel?: string | null;
  awardedAmount?: number | null;
  dense?: boolean;
}) {
  let icon: ReactNode;
  let line1: string;
  let line2: string;

  if (isDone) {
    icon = (
      <FontAwesome name="check-circle" size={dense ? 10 : 12} color={Theme.positive} />
    );
    line1 = "Done";
    line2 = "";
  } else if (isAwardedPendingTrip) {
    icon = (
      <FontAwesome name="trophy" size={dense ? 10 : 12} color={Theme.driverGold} />
    );
    line1 = "Claimed";
    line2 = awardedAmountLabel ? awardedAmountLabel.replace(/\s/g, "") : "";
  } else {
    icon =
      bidCount > 0 ? (
        <BidReceivedHammer visible size={dense ? 10 : 12} />
      ) : (
        <FontAwesome name="gavel" size={dense ? 10 : 12} color={Theme.textMuted} />
      );
    line1 = String(bidCount);
    line2 = bidCount === 1 ? "bid" : "bids";
  }

  if (dense && isAwardedPendingTrip) {
    const amountText =
      awardedAmount != null && Number.isFinite(awardedAmount)
        ? formatINRChip(awardedAmount)
        : (awardedAmountLabel?.replace(/\s/g, "") ?? "—");
    return (
      <HubGridStatusChip
        amount
        amountLine
        compact
        icon={
          <FontAwesome name="trophy" size={9} color={Theme.driverGold} />
        }
        line1={amountText}
        line2="awarded"
        accessibilityLabel={`Awarded ${amountText}`}
      />
    );
  }

  if (dense) {
    return (
      <HubGridStatusChip
        wide={false}
        icon={icon}
        line1={line1}
        line2={line2 || undefined}
        accessibilityLabel={
          isDone
            ? "Completed"
            : `${bidCount} bids`
        }
      />
    );
  }

  return (
    <View
      style={styles.statusChip}
      accessibilityLabel={
        isDone
          ? "Completed"
          : isAwardedPendingTrip
            ? "Supplier awarded"
            : `${bidCount} bids`
      }
    >
      <View style={styles.statusChipIcon}>
        {icon}
      </View>
      <View style={styles.statusChipTextWrap}>
        <Text style={styles.statusChipLine1} numberOfLines={1}>
          {line1}
        </Text>
        {line2 ? (
          <Text style={styles.statusChipLine2} numberOfLines={1}>
            {line2}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export type GetLoadQuoteChipVariant =
  | "open"
  | "pending"
  | "rejected"
  | "accepted"
  | "done";

export function GetLoadQuoteChip({
  variant,
  quoteAmount,
  dense,
}: {
  variant: GetLoadQuoteChipVariant;
  quoteAmount?: number;
  dense?: boolean;
}) {
  const hasQuote =
    variant === "pending" || variant === "accepted" || variant === "done";
  let line1 = "Open";
  let line2 = "";
  let amountLine = false;

  switch (variant) {
    case "pending":
      line1 = formatINRChip(Number(quoteAmount ?? 0));
      line2 = "bid";
      amountLine = true;
      break;
    case "rejected":
      line1 = "No";
      line2 = "bid";
      break;
    case "accepted":
      line1 = "Won";
      line2 = quoteAmount != null ? formatINRChip(quoteAmount) : "";
      amountLine = Boolean(line2);
      break;
    case "done":
      line1 = "Done";
      break;
    default:
      line1 = "Open";
      line2 = "bid";
      break;
  }

  const icon = (
    <Package
      size={dense ? 10 : 12}
      color={hasQuote ? Theme.textPrimaryDark : Theme.textMuted}
      strokeWidth={2.2}
    />
  );

  if (dense) {
    return (
      <HubGridStatusChip
        icon={icon}
        line1={line1}
        line2={line2 || undefined}
        amountLine={amountLine}
      />
    );
  }

  return (
    <View style={[styles.statusChip, styles.statusChipQuote]}>
      <View style={styles.statusChipIcon}>{icon}</View>
      <View style={styles.statusChipTextWrap}>
        <Text
          style={[
            styles.statusChipLine1,
            amountLine && styles.statusChipAmount,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {line1}
        </Text>
        {line2 ? (
          <Text style={styles.statusChipLine2} numberOfLines={1}>
            {line2}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export type GiveLoadIndentCardActionsProps = LoadCenterIndentCardActionsLayout & {
  load: IndentRow;
  bidCount: number;
  isDone: boolean;
  isDraft: boolean;
  isAwardedPendingTrip: boolean;
  isAwaitingSupplierDeploy: boolean;
  showPulseToNetwork: boolean;
  /** True while the linked LOAD story is inside its 24h window. */
  pulseStoryLive?: boolean;
  pulseBusy?: boolean;
  onPulseStory?: (load: IndentRow) => void;
  /** @deprecated Use onPulseStory — kept so older call sites still compile. */
  onShareToNetwork?: (load: IndentRow) => void;
  onIndentPress: (load: IndentRow) => void;
  onShareIndent: (load: IndentRow) => void;
  onBroadcastDraft: (load: IndentRow) => void;
  onOpenAwardModal: (load: IndentRow) => void;
  awardedAmountLabel?: string | null;
  awardedAmount?: number | null;
  /** A2: toggle this indent's Marketplace distribution. Omit to hide the control entirely. */
  onToggleMarketplace?: (load: IndentRow) => void;
  marketplaceBusy?: boolean;
  /** Linked trip exists — primary CTA opens trip detail (bootstrap seed + bundle prefetch). */
  onViewTrip?: (load: IndentRow) => void;
};

export function GiveLoadIndentCardActions({
  load,
  bidCount,
  isDone,
  isDraft,
  isAwardedPendingTrip,
  isAwaitingSupplierDeploy,
  showPulseToNetwork,
  pulseStoryLive = false,
  pulseBusy = false,
  onPulseStory,
  onShareToNetwork,
  onIndentPress,
  onShareIndent,
  onBroadcastDraft,
  onOpenAwardModal,
  awardedAmountLabel,
  awardedAmount,
  dense,
  commerceRow = true,
  style,
  onToggleMarketplace,
  marketplaceBusy = false,
  onViewTrip,
}: GiveLoadIndentCardActionsProps) {
  const shareOpensDetail = isDone || isAwardedPendingTrip;
  const pulseHandler = onPulseStory ?? onShareToNetwork;
  const showPulse = showPulseToNetwork && Boolean(pulseHandler);
  const circulationTarget = load.circulation_target ?? "integrated_supplier";
  const isMarketplaceShared =
    circulationTarget === "marketplace" || circulationTarget === "both";
  // Distribution only matters while the load can still gain new offers.
  const showMarketplaceToggle =
    Boolean(onToggleMarketplace) && !isDraft && !isDone && !isAwardedPendingTrip;

  const onReviewOrBroadcast = () => {
    if (isDraft) {
      onBroadcastDraft(load);
      return;
    }
    onOpenAwardModal(load);
  };

  const reviewLabel = isDraft ? "Broadcast" : "Review";
  const reviewCta = commerceRow ? (
    <CommerceLinkCta
      label={compactCommerceCtaLabel(reviewLabel === "Broadcast" ? "Broadcast" : "Review Hub")}
      onPress={onReviewOrBroadcast}
    />
  ) : (
    <PrimaryButton
      dense={dense}
      inline={dense}
      label={compactGiveLoadCtaLabel(
        reviewLabel === "Broadcast" ? "Broadcast" : "Review Hub",
        dense,
      )}
      onPress={onReviewOrBroadcast}
    />
  );

  const tripCta =
    onViewTrip && !isDraft ? (
      commerceRow ? (
        <CommerceLinkCta
          label={compactCommerceCtaLabel("View trip")}
          onPress={() => onViewTrip(load)}
        />
      ) : (
        <PrimaryButton
          dense={dense}
          inline={dense}
          label={compactGiveLoadCtaLabel("View trip", dense)}
          onPress={() => onViewTrip(load)}
        />
      )
    ) : null;

  const pendingChip =
    isAwaitingSupplierDeploy && !onViewTrip ? (
      commerceRow ? (
        <Text style={styles.commercePending} numberOfLines={1}>
          Pending
        </Text>
      ) : (
        <PendingChip dense={dense} />
      )
    ) : null;

  const primaryCta = (
    <>
      {pendingChip}
      {reviewCta}
      {tripCta}
    </>
  );

  if (commerceRow) {
    return (
      <View style={style}>
        <CommerceActionRow>
        <CommerceIconButton
          label={shareOpensDetail ? "View detail" : "Share indent"}
          onPress={() =>
            shareOpensDetail ? onIndentPress(load) : onShareIndent(load)
          }
        >
          <Share2 size={13} color={Theme.textMuted} strokeWidth={2.2} />
        </CommerceIconButton>
        {showMarketplaceToggle ? (
          <MarketplaceIconButton
            isShared={isMarketplaceShared}
            busy={marketplaceBusy}
            onPress={() => onToggleMarketplace!(load)}
          />
        ) : null}
        {showPulse ? (
          <CommerceIconButton
            label={
              pulseStoryLive
                ? "Pulse story is live"
                : "Pulse indent as a 24 hour story"
            }
            onPress={() => pulseHandler!(load)}
            tone={pulseStoryLive ? "live" : "expired"}
          >
            <Zap
              size={12}
              color={pulseStoryLive ? Theme.positive : Theme.destructive}
              strokeWidth={2.2}
            />
          </CommerceIconButton>
        ) : null}
        {primaryCta}
        </CommerceActionRow>
      </View>
    );
  }

  const statusChip = (
    <GiveLoadBidChip
      bidCount={bidCount}
      isDone={isDone}
      isAwardedPendingTrip={isAwardedPendingTrip}
      awardedAmountLabel={awardedAmountLabel}
      awardedAmount={awardedAmount}
      dense={dense}
    />
  );

  const share = (
    <ShareIconButton
      dense={dense}
      label={shareOpensDetail ? "View detail" : "Share indent"}
      onPress={() =>
        shareOpensDetail ? onIndentPress(load) : onShareIndent(load)
      }
    />
  );

  const primary = commerceRow ? null : (
    <>
      {pendingChip}
      {reviewCta}
      {tripCta}
    </>
  );

  const pulse = showPulse ? (
    <PulseButton
      dense={dense}
      live={pulseStoryLive}
      busy={pulseBusy}
      onPress={() => pulseHandler!(load)}
    />
  ) : null;

  const marketplace = showMarketplaceToggle ? (
    dense ? (
      <MarketplaceIconButton
        dense
        isShared={isMarketplaceShared}
        busy={marketplaceBusy}
        onPress={() => onToggleMarketplace!(load)}
      />
    ) : (
      <MarketplaceShareButton
        isShared={isMarketplaceShared}
        busy={marketplaceBusy}
        onPress={() => onToggleMarketplace!(load)}
      />
    )
  ) : null;

  const primarySlot =
    primary ?? (dense ? <PrimaryToolbarPlaceholder dense /> : null);

  const trailing =
    dense && (marketplace || pulse) ? (
      <View style={styles.trailingCluster}>
        {marketplace}
        {pulse}
      </View>
    ) : (
      pulse
    );

  if (dense) {
    return (
      <View style={style}>
        <HubGridToolbarRow
          statusSlot={isAwardedPendingTrip ? "amount" : "default"}
          status={statusChip}
          share={share}
          primary={primarySlot}
          trailing={trailing}
        />
      </View>
    );
  }

  return (
    <View style={style}>
      {marketplace ? (
        <View style={styles.marketplaceRow}>{marketplace}</View>
      ) : null}
      <InlineActionRow>
        <InlineLeadingCluster>
          {statusChip}
          {share}
        </InlineLeadingCluster>
        {primary ? <View style={styles.primaryGrow}>{primary}</View> : null}
        {pulse}
      </InlineActionRow>
    </View>
  );
}

function compactGiveLoadCtaLabel(label: string, dense?: boolean): string {
  if (!dense) return label;
  if (label === "Review Hub") return "Review";
  if (label === "Broadcast") return "Broadcast";
  if (label === "View trip") return "View trip";
  return label;
}

export type GetLoadIndentCardActionsProps = LoadCenterIndentCardActionsLayout & {
  load: IndentRow;
  isAccepted: boolean;
  isDoneOutcome: boolean;
  ctaLabel: string;
  /** False for LOST / CANCELLED / EXPIRED — share only, no Rebid. */
  showPrimaryCta?: boolean;
  quoteVariant: GetLoadQuoteChipVariant;
  quoteAmount?: number;
  onIndentPress: (load: IndentRow) => void;
  onShareIndent: (load: IndentRow) => void;
  onOpenBidModal: (load: IndentRow) => void;
  /** Bids Won (accepted, not yet done): open allocate vehicle/driver. */
  onAllocate: (load: IndentRow) => void;
};

function compactGetLoadCtaLabel(label: string, dense?: boolean): string {
  if (label === "Update quote" || label === "Update" || label === "Update bid") {
    return "Update bid";
  }
  if (!dense) return label;
  switch (label) {
    case "View details":
      return "Details";
    case "Allocate":
      return "Allocate";
    case "New quote":
      return "Rebid";
    default:
      return label;
  }
}

export function GetLoadIndentCardActions({
  load,
  isAccepted,
  isDoneOutcome,
  ctaLabel,
  showPrimaryCta = true,
  quoteVariant: _quoteVariant,
  quoteAmount: _quoteAmount,
  onIndentPress,
  onShareIndent,
  onOpenBidModal,
  onAllocate,
  dense,
  commerceRow = true,
  style,
}: GetLoadIndentCardActionsProps) {
  const onPrimary = () => {
    if (!showPrimaryCta) return;
    if (isAccepted) {
      if (isDoneOutcome) {
        onIndentPress(load);
        return;
      }
      onAllocate(load);
      return;
    }
    onOpenBidModal(load);
  };

  const linkLabel = compactCommerceCtaLabel(ctaLabel);

  if (commerceRow) {
    return (
      <CommerceActionRow style={style}>
        <CommerceIconButton
          label="Share load"
          onPress={() => onShareIndent(load)}
        >
          <Share2 size={13} color={Theme.textMuted} strokeWidth={2.2} />
        </CommerceIconButton>
        {showPrimaryCta ? (
          <CommerceLinkCta label={linkLabel} onPress={onPrimary} />
        ) : null}
      </CommerceActionRow>
    );
  }

  const share = (
    <ShareIconButton
      dense={dense}
      label="Share load"
      onPress={() => onShareIndent(load)}
    />
  );
  const primary = showPrimaryCta ? (
    <PrimaryButton
      dense={dense}
      inline={dense}
      label={compactGetLoadCtaLabel(ctaLabel, dense)}
      onPress={onPrimary}
    />
  ) : null;

  if (dense) {
    return (
      <View style={style}>
        <InlineActionRow>
          {share}
          {primary ? <View style={styles.primaryGrow}>{primary}</View> : null}
        </InlineActionRow>
      </View>
    );
  }

  return (
    <View style={style}>
      <InlineActionRow>
        {share}
        {primary ? <View style={styles.primaryGrow}>{primary}</View> : null}
      </InlineActionRow>
    </View>
  );
}

export type ClaimedIndentCardActionsProps = LoadCenterIndentCardActionsLayout & {
  load: IndentRow;
  isDone: boolean;
  assigning: boolean;
  onIndentPress: (load: IndentRow) => void;
  onShareIndent: (load: IndentRow) => void;
  onAssignDeploy: (load: IndentRow) => void;
};

export function ClaimedIndentCardActions({
  load,
  isDone,
  assigning,
  onIndentPress,
  onShareIndent,
  onAssignDeploy,
  dense,
  commerceRow = true,
  style,
}: ClaimedIndentCardActionsProps) {
  if (commerceRow) {
    return (
      <CommerceActionRow style={style}>
        <CommerceIconButton
          label="Share load"
          onPress={() => onShareIndent(load)}
        >
          <Share2 size={13} color={Theme.textMuted} strokeWidth={2.2} />
        </CommerceIconButton>
        <CommerceLinkCta
          label={isDone ? "View" : assigning ? "…" : "Allocate"}
          onPress={() =>
            isDone ? onIndentPress(load) : onAssignDeploy(load)
          }
          disabled={assigning}
        />
      </CommerceActionRow>
    );
  }

  const statusChip = dense ? (
    <HubGridStatusChip
      icon={
        <FontAwesome
          name={isDone ? "check-circle" : "truck"}
          size={9}
          color={isDone ? Theme.positive : Theme.textMuted}
        />
      }
      line1={isDone ? "Done" : "Allocate"}
      accessibilityLabel={isDone ? "Completed" : "Action required — allocate vehicle"}
    />
  ) : (
    <View style={styles.statusChip}>
      <View style={styles.statusChipIcon}>
        <FontAwesome
          name={isDone ? "check-circle" : "truck"}
          size={12}
          color={isDone ? Theme.positive : Theme.textMuted}
        />
      </View>
      <View style={styles.statusChipTextWrap}>
        <Text style={styles.statusChipLine1} numberOfLines={1}>
          {isDone ? "Done" : "Allocate"}
        </Text>
      </View>
    </View>
  );

  const share = (
    <ShareIconButton
      dense={dense}
      label="Share load"
      onPress={() => onShareIndent(load)}
    />
  );
  const primary = dense ? (
    <HubGridPrimaryButton
      label={isDone ? "View" : assigning ? "…" : "Allocate"}
      onPress={() => (isDone ? onIndentPress(load) : onAssignDeploy(load))}
      disabled={assigning}
    />
  ) : (
    <PrimaryButton
      dense={false}
      inline={false}
      label={isDone ? "View details" : assigning ? "…" : "Allocate"}
      onPress={() => (isDone ? onIndentPress(load) : onAssignDeploy(load))}
      disabled={assigning}
    />
  );

  if (dense) {
    return (
      <View style={style}>
        <HubGridToolbarRow
          status={statusChip}
          share={share}
          primary={primary}
        />
      </View>
    );
  }

  return (
    <View style={style}>
      <InlineActionRow>
        <InlineLeadingCluster>
          {statusChip}
          {share}
        </InlineLeadingCluster>
        <View style={styles.primaryGrow}>{primary}</View>
      </InlineActionRow>
    </View>
  );
}

/** @deprecated Use GiveLoadBidChip inside GiveLoadIndentCardActions */
export function GiveLoadBidMeta(props: Parameters<typeof GiveLoadBidChip>[0]) {
  return <GiveLoadBidChip {...props} />;
}


const styles = StyleSheet.create({
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FOOTER_BORDER,
    backgroundColor: Theme.surface,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    width: "100%",
    minWidth: 0,
    justifyContent: "center",
  },
  primaryToolbarPlaceholder: {
    width: "100%",
    minHeight: ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderRadius: 8,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    minWidth: 0,
    height: ROW_HEIGHT,
    ...Platform.select({
      web: { columnGap: 8, rowGap: 0 } as ViewStyle,
      default: {},
    }),
  },
  leadingCluster: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 6,
    height: ROW_HEIGHT,
    ...Platform.select({
      web: { columnGap: 6 } as ViewStyle,
      default: {},
    }),
  },
  primaryGrow: {
    flex: 1,
    minWidth: 0,
    height: ROW_HEIGHT,
    justifyContent: "center",
    alignSelf: "stretch",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexShrink: 0,
    maxWidth: 72,
    minWidth: 48,
    height: ROW_HEIGHT,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    overflow: "hidden",
  },
  statusChipQuote: {
    minWidth: 52,
    maxWidth: 76,
  },
  statusChipAmount: {
    textTransform: "none",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
  },
  statusChipIcon: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statusChipTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  statusChipLine1: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.1,
    lineHeight: 12,
    includeFontPadding: false,
  },
  statusChipLine2: {
    fontSize: 9,
    fontWeight: "600",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.25,
    lineHeight: 11,
    includeFontPadding: false,
  },
  shareBtn: {
    width: ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: 0,
  },
  commerceRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    minHeight: 28,
    overflow: "hidden",
  },
  commerceIconBtn: {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  commerceIconBtnLive: {
    borderColor: "rgba(21, 128, 61, 0.35)",
    backgroundColor: "#E8F7F0",
  },
  commerceIconBtnExpired: {
    borderColor: "rgba(185, 28, 28, 0.28)",
    backgroundColor: "#FEF2F2",
  },
  commerceCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    height: 28,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: "#EFF6FF",
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 88,
    overflow: "hidden",
  },
  commerceCtaDisabled: {
    opacity: 0.55,
  },
  commerceCtaText: {
    fontSize: 12,
    fontWeight: "600",
    color: LINK,
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  commercePending: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textMuted,
  },
  trailingCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  marketplaceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 6,
  },
  marketplaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  marketplaceBtnInactive: {
    backgroundColor: Theme.surface,
    borderColor: Theme.borderMedium,
  },
  marketplaceBtnLive: {
    backgroundColor: Theme.positive,
    borderColor: Theme.positive,
    borderWidth: 0,
  },
  marketplaceBtnText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  marketplaceBtnTextLive: {
    color: Theme.textOnPrimary,
  },
  pulseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 56,
    height: ROW_HEIGHT,
    maxHeight: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    backgroundColor: Theme.pulseIndigoWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.pulseIndigoRing,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 0,
    overflow: "hidden",
    ...Platform.select({
      web: { boxSizing: "border-box" } as ViewStyle,
      default: {},
    }),
  },
  pulseBtnLive: {
    backgroundColor: Theme.positiveMuted,
    borderColor: Theme.positive,
  },
  pulseBtnExpired: {
    backgroundColor: Theme.negativeMuted,
    borderColor: Theme.destructive,
  },
  pulseBtnDense: {
    minWidth: HUB_GRID_TOOLBAR_PULSE_SLOT_W,
    height: ROW_HEIGHT,
    paddingHorizontal: 8,
    gap: 4,
  },
  pulseBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.pulseIndigo,
    letterSpacing: 0.1,
    includeFontPadding: false,
    lineHeight: 13,
  },
  pulseBtnTextDense: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.05,
  },
  primaryBtn: {
    backgroundColor: Theme.accentBrown,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 8,
    height: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    maxHeight: ROW_HEIGHT,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    ...Platform.select({
      web: { boxSizing: "border-box" } as ViewStyle,
      default: {},
    }),
  },
  primaryBtnDense: {
    minHeight: ROW_HEIGHT,
    height: ROW_HEIGHT,
    maxHeight: ROW_HEIGHT,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderRadius: 8,
  },
  primaryBtnInline: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    alignSelf: "stretch",
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textOnPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.35,
    textAlign: "center",
    includeFontPadding: false,
  },
  primaryBtnTextDense: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  pendingChip: {
    height: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    maxHeight: ROW_HEIGHT,
    width: "100%",
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingChipDenseBtn: {
    width: "100%",
    minHeight: HUB_GRID_TOOLBAR_ROW_HEIGHT,
    height: HUB_GRID_TOOLBAR_ROW_HEIGHT,
    maxHeight: HUB_GRID_TOOLBAR_ROW_HEIGHT,
    borderRadius: 8,
    backgroundColor: Theme.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.borderLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    includeFontPadding: false,
  },
  pendingTextDense: {
    fontSize: 8,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
});
