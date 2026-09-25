/**
 * Typography tokens aligned with FinanceKanbanTab / ledger transaction cards.
 * Use for ledger sync full page + reconciliation summary modal.
 */
import Theme from "./Theme";

export const FinanceTxnTypography = {
  /** Column headers (CUSTOMERS, SUPPLIERS, …). */
  columnTitle: {
    fontSize: 10,
    fontWeight: "400" as const,
    fontStyle: "normal" as const,
    color: Theme.textMuted,
    letterSpacing: 0.2,
    textTransform: "uppercase" as const,
  },
  /** Party / org name on transaction card. */
  partyTitle: {
    fontSize: 11,
    fontWeight: "500" as const,
    fontStyle: "italic" as const,
    color: Theme.textPrimaryDark,
    textTransform: "uppercase" as const,
  },
  /** Date · vehicle line. */
  dateLine: {
    fontSize: 8,
    fontWeight: "400" as const,
    fontStyle: "normal" as const,
    color: Theme.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  /** Route / description / meta. */
  routeWhy: {
    fontSize: 8,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    color: Theme.textMuted,
  },
  /** Trip id pill (TRP015). */
  tripId: {
    fontSize: 8,
    fontWeight: "500" as const,
    fontStyle: "italic" as const,
    color: Theme.primary,
    letterSpacing: 0.2,
    textTransform: "uppercase" as const,
  },
  /** Cash in / out amount on card. */
  amount: {
    fontSize: 11,
    fontWeight: "400" as const,
    fontStyle: "normal" as const,
  },
  amountIn: {
    color: Theme.darkGreen,
  },
  amountOut: {
    color: Theme.teslaRed,
  },
  /** Section labels (SYNC MODE, recon field names). */
  fieldLabel: {
    fontSize: 9,
    fontWeight: "400" as const,
    fontStyle: "normal" as const,
    color: Theme.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  /** Field values in summary rows. */
  fieldValue: {
    fontSize: 9,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    color: Theme.textPrimaryDark,
    lineHeight: 13,
  },
  /** Protocol tile / chip label. */
  chipLabel: {
    fontSize: 8,
    fontWeight: "500" as const,
    fontStyle: "normal" as const,
    color: Theme.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  /** Neutral status chip (e.g. no pending due on trip). */
  noDueChip: {
    fontSize: 8,
    fontWeight: "400" as const,
    fontStyle: "italic" as const,
    color: Theme.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  /** Secondary action / button label. */
  buttonLabel: {
    fontSize: 10,
    fontWeight: "400" as const,
    fontStyle: "normal" as const,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  /** Chat scope pills — ACTIVE / HISTORY / MANUAL tabs (`ChatScreen` tripChatScopePill). */
  chatFilterPill: {
    fontSize: 8,
    fontWeight: "600" as const,
    fontStyle: "normal" as const,
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  chatFilterPillOn: {
    color: "#ffffff",
  },
  chatFilterGroupLabel: {
    fontSize: 8,
    fontWeight: "600" as const,
    fontStyle: "normal" as const,
    color: "#64748b",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
} as const;
