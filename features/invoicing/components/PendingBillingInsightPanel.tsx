/**
 * Pending Billing right rail — summary metrics, interpretation, issued invoices.
 * Visual language inspired by finance dashboard scorecards (colored headers, grid metrics).
 * Create Invoice stays in the trip-list header — not duplicated here.
 */
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { IssuedInvoiceCard } from "@/features/invoicing/components/IssuedInvoiceCard";
import type { IssuedInvoiceListRow } from "@/features/invoicing/services/invoiceList.service";
import { issuedInvoicesForPodToggle } from "@/features/invoicing/utils/invoicePodRequired.util";
import { FileText } from "lucide-react-native";
import { issuedInvoicesForClient } from "@/features/invoicing/utils/issuedInvoiceMatch.util";
import { ScrollView, StyleSheet, Text, View } from "react-native";

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function PendingBillingInsightPanel({
  partnerLabel,
  partnerClientId,
  tripCount,
  unbilledTripCount,
  eligibleCount,
  selectedCount,
  selectedFreight,
  pendingFreight,
  completedTripCount,
  notCompletedTripCount,
  invoicedTripCount,
  podPendingTripCount = 0,
  draftTripCount = 0,
  podRequired,
  blockedReason,
  invoices,
}: {
  partnerLabel?: string | null;
  partnerClientId?: string | null;
  tripCount: number;
  unbilledTripCount: number;
  eligibleCount: number;
  selectedCount: number;
  selectedFreight: number;
  pendingFreight: number;
  completedTripCount: number;
  notCompletedTripCount: number;
  invoicedTripCount: number;
  podPendingTripCount?: number;
  draftTripCount?: number;
  podRequired: boolean;
  blockedReason?: string | null;
  invoices: IssuedInvoiceListRow[];
}) {
  const visible = issuedInvoicesForPodToggle(invoices, podRequired);
  const partnerInvoices = partnerLabel || partnerClientId
    ? issuedInvoicesForClient(visible, {
        clientId: partnerClientId,
        clientName: partnerLabel,
      })
    : visible;
  const issuedTotal = partnerInvoices.reduce(
    (sum, row) => sum + (Number.isFinite(row.total_amount) ? row.total_amount : 0),
    0,
  );

  const interpretationLines = buildInterpretationLines({
    partnerLabel,
    tripCount,
    unbilledTripCount,
    eligibleCount,
    selectedCount,
    completedTripCount,
    notCompletedTripCount,
    invoicedTripCount,
    podRequired,
    blockedReason,
    issuedCount: partnerInvoices.length,
  });

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Summary — colored header + metric grid */}
      <View style={styles.panel}>
        <View style={[styles.panelHeader, styles.panelHeaderSummary]}>
          <Text style={styles.panelHeaderLabel}>Summary</Text>
          <Text style={styles.panelHeaderTitle} numberOfLines={1}>
            {partnerLabel || "Select a partner"}
          </Text>
        </View>
        <View style={styles.panelBody}>
          {!partnerLabel ? (
            <Text style={styles.body}>
              Choose a strategic partner to see ready-to-invoice volume,
              selection, and issued billing for that client.
            </Text>
          ) : (
            <>
              <View style={styles.metricGrid}>
                <Metric label="Completed" value={String(completedTripCount)} tone="neutral" />
                <Metric label="Blocked — POD pending" value={String(podPendingTripCount)} tone="neutral" />
                <Metric label="Eligible" value={String(eligibleCount)} tone="positive" />
                <Metric label="In draft" value={String(draftTripCount)} tone="neutral" />
                <Metric label="Already invoiced" value={String(invoicedTripCount)} tone="neutral" />
                <Metric label="Selected" value={String(selectedCount)} tone="accent" />
                <Metric
                  label="Selected freight"
                  value={formatInr(selectedFreight)}
                  tone="accent"
                />
              </View>
              <View style={styles.footerStats}>
                <View style={styles.footerStatRow}>
                  <Text style={styles.footerStatLabel}>Pending freight (listed)</Text>
                  <Text style={styles.footerStatValue}>
                    {formatInr(pendingFreight)}
                  </Text>
                </View>
                <View style={styles.footerStatRow}>
                  <Text style={styles.footerStatLabel}>Issued to this partner</Text>
                  <Text style={styles.footerStatValue}>
                    {partnerInvoices.length} · {formatInr(issuedTotal)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Interpretation */}
      <View style={styles.panel}>
        <View style={[styles.panelHeader, styles.panelHeaderInterpret]}>
          <Text style={styles.panelHeaderLabelOnDark}>Interpretation</Text>
          <View
            style={[
              styles.podPill,
              podRequired ? styles.podPillOn : styles.podPillOff,
            ]}
          >
            <Text
              style={[
                styles.podPillText,
                podRequired ? styles.podPillTextOn : styles.podPillTextOff,
              ]}
            >
              POD {podRequired ? "ON" : "OFF"}
            </Text>
          </View>
        </View>
        <View style={styles.panelBody}>
          {interpretationLines.map((line) => (
            <View key={line} style={styles.interpretRow}>
              <View style={styles.interpretDot} />
              <Text style={styles.interpretText}>{line}</Text>
            </View>
          ))}
          {blockedReason ? (
            <View style={styles.blockedBox}>
              <Text style={styles.blocked}>{blockedReason}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Issued invoices list */}
      <View style={styles.panel}>
        <View style={[styles.panelHeader, styles.panelHeaderIssued]}>
          <Text style={styles.panelHeaderLabelOnDark}>
            {partnerLabel ? "Issued invoices" : "Recent issued"}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{partnerInvoices.length}</Text>
          </View>
        </View>
        <View style={styles.panelBodyTight}>
          {partnerInvoices.length === 0 ? (
            <View style={styles.emptyIssued}>
              <View style={styles.emptyIconWrap}>
                <FileText
                  size={20}
                  color={Theme.darkGreen}
                  strokeWidth={2}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {partnerLabel
                  ? "No issued invoices for this partner"
                  : "No issued invoices yet"}
              </Text>
              <Text style={styles.emptySub}>
                Use Create Invoice above once eligible trips are selected.
                Issued documents stay visible here regardless of POD Required.
              </Text>
            </View>
          ) : (
            partnerInvoices.map((item) => (
              <IssuedInvoiceCard key={item.id} item={item} compact />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "accent";
}) {
  const valueStyle =
    tone === "positive"
      ? styles.metricValuePositive
      : tone === "accent"
        ? styles.metricValueAccent
        : styles.metricValue;
  return (
    <View style={styles.metricCell}>
      <Text style={valueStyle} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function buildInterpretationLines({
  partnerLabel,
  tripCount,
  unbilledTripCount,
  eligibleCount,
  selectedCount,
  completedTripCount,
  notCompletedTripCount,
  invoicedTripCount,
  podRequired,
  blockedReason,
  issuedCount,
}: {
  partnerLabel?: string | null;
  tripCount: number;
  unbilledTripCount: number;
  eligibleCount: number;
  selectedCount: number;
  completedTripCount: number;
  notCompletedTripCount: number;
  invoicedTripCount: number;
  podRequired: boolean;
  blockedReason?: string | null;
  issuedCount: number;
}): string[] {
  if (!partnerLabel) {
    return [
      "Select a partner to review eligibility against their invoicing POD policy.",
      "Create Invoice stays in the trip list header once trips are selected.",
    ];
  }
  if (blockedReason) {
    return [
      "Invoice creation is currently gated for this workspace.",
      "Keep preparing selection in the trip list; Create Invoice unlocks when the gate clears.",
    ];
  }
  const podLine = podRequired
    ? "POD Required is ON — issue stays blocked for trips missing the client's required proof of delivery."
    : "POD Required is OFF — eligibility still follows each client's invoicing POD policy.";
  const lines: string[] = [
    `${selectedCount} of ${eligibleCount} eligible trips selected (${unbilledTripCount} unbilled of ${tripCount} listed).`,
    `Completion: ${completedTripCount} completed · ${notCompletedTripCount} not completed.`,
    `${invoicedTripCount} trip${invoicedTripCount === 1 ? "" : "s"} already allocated to issued invoices.`,
    podLine,
  ];
  if (issuedCount > 0) {
    lines.push(
      `${issuedCount} prior invoice${issuedCount === 1 ? "" : "s"} on file below.`,
    );
  } else {
    lines.push("No prior invoices for this partner yet.");
  }
  return lines;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Theme.analyticsCanvas,
  },
  content: {
    padding: 14,
    paddingBottom: 28,
    gap: 12,
  },
  panel: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  panelHeaderSummary: {
    backgroundColor: Theme.accentBrownWash,
    borderBottomWidth: 1,
    borderBottomColor: Theme.accentBrownBorder,
  },
  panelHeaderInterpret: {
    backgroundColor: Theme.analyticsHeroBg,
  },
  panelHeaderIssued: {
    backgroundColor: Theme.darkGreen,
  },
  panelHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.accentBrown,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  panelHeaderLabelOnDark: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textOnDark,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  panelHeaderTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "800",
    color: Theme.accentBrownDeep,
    letterSpacing: -0.2,
  },
  panelBody: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  panelBodyTight: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 0,
  },
  body: {
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textSecondary,
    lineHeight: 19,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCell: {
    width: "47%",
    flexGrow: 1,
    minWidth: 0,
    backgroundColor: Theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.3,
  },
  metricValuePositive: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.darkGreen,
    letterSpacing: -0.3,
  },
  metricValueAccent: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.analyticsHeroBg,
    letterSpacing: -0.3,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    lineHeight: 13,
  },
  footerStats: {
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.borderLight,
    paddingTop: 10,
    gap: 8,
  },
  footerStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  footerStatLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textSecondary,
  },
  footerStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
  },
  podPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  podPillOn: {
    backgroundColor: Theme.warningMuted,
    borderColor: Theme.warning,
  },
  podPillOff: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.35)",
  },
  podPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  podPillTextOn: {
    color: Theme.warning,
  },
  podPillTextOff: {
    color: Theme.textOnDark,
  },
  interpretRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  interpretDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: Theme.analyticsHeroBg,
  },
  interpretText: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textPrimary,
    lineHeight: 19,
  },
  blockedBox: {
    marginTop: 4,
    backgroundColor: Theme.warningMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.warning,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  blocked: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.warning,
    lineHeight: 17,
  },
  countBadge: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.textOnDark,
  },
  emptyIssued: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  emptyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.positiveMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emptySub: {
    marginTop: Layout.spacingSmall,
    fontSize: 12,
    fontWeight: "500",
    color: Theme.textMuted,
    textAlign: "center",
    lineHeight: 17,
  },
});
