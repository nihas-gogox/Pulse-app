import { pipelineStageById } from "./buildFinanceProModel";
import {
  canvasSelectionIsActive,
  formatCanvasContextLabel,
} from "./canvasContext.util";
import { ratioPct } from "./collectionMath.util";
import {
  formatCount,
  formatFinanceInr,
  formatPct,
} from "../components/financeProFormat";
import {
  OBLIGATION_AGE_BUCKETS,
  OBLIGATION_AGE_LABELS,
  PIPELINE_STAGE_LABELS,
  type CanvasSelection,
  type ClientCollectionRow,
  type FinanceProModel,
  type PipelineStageId,
} from "./financeProTypes";

export type InvestigationBrief = {
  active: boolean;
  label: string | null;
  outstanding: number;
  billed: number;
  attributedReceipts: number;
  clientCount: number;
  tripCount: number;
  openTripCount: number;
  largestName: string | null;
  largestAmount: number;
  oldestDays: number | null;
  podBlockedValue: number;
  readyValue: number;
};

export type AttentionStory = {
  id: string;
  badge: string;
  title: string;
  amount: number;
  facts: string[];
  clientId: string | null;
  pipelineStage: PipelineStageId | null;
};

export function buildInvestigationBrief(
  filtered: FinanceProModel,
  selection: CanvasSelection,
): InvestigationBrief {
  const oldestDays = filtered.openTrips.reduce<number | null>((acc, trip) => {
    if (trip.daysOld == null) return acc;
    return acc == null ? trip.daysOld : Math.max(acc, trip.daysOld);
  }, null);
  const top = [...filtered.clientRows]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)[0];
  const clients = new Set(filtered.tripFacts.map((t) => t.clientId));
  return {
    active: canvasSelectionIsActive(selection),
    label: formatCanvasContextLabel(selection),
    outstanding: filtered.outstanding,
    billed: filtered.billed,
    attributedReceipts: filtered.attributedReceipts,
    clientCount: clients.size || filtered.clientsWithBalance,
    tripCount: filtered.tripFacts.length,
    openTripCount: filtered.openTrips.length,
    largestName: top?.name ?? null,
    largestAmount: top?.outstanding ?? 0,
    oldestDays,
    podBlockedValue: pipelineStageById(filtered.pipeline, "pod_pending").value,
    readyValue: pipelineStageById(filtered.pipeline, "ready_to_invoice").value,
  };
}

export function compactInvestigationLine(brief: InvestigationBrief): string {
  const parts = [
    brief.label,
    formatFinanceInr(brief.outstanding),
    `${formatCount(brief.clientCount)} customers`,
    `${formatCount(brief.openTripCount)} open trips`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildAttentionStories(model: FinanceProModel): AttentionStory[] {
  const stories: AttentionStory[] = [];
  const withBalance = [...model.clientRows]
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
  const highest = withBalance[0];
  if (highest) {
    const facts = [
      `${formatPct(highest.shareOfOutstanding)} of open exposure`,
      `${formatCount(highest.openTrips)} open trips`,
    ];
    if (highest.oldestObligationDays != null) {
      facts.push(`oldest ${highest.oldestObligationDays}d`);
    }
    stories.push({
      id: `highest-${highest.id}`,
      badge: "Highest exposure",
      title: highest.name,
      amount: highest.outstanding,
      facts,
      clientId: highest.isLedgerOnly ? null : highest.id,
      pipelineStage: null,
    });
  }

  const oldest = [...withBalance]
    .filter((row) => row.oldestObligationDays != null)
    .sort(
      (a, b) => (b.oldestObligationDays ?? 0) - (a.oldestObligationDays ?? 0),
    )[0];
  if (
    oldest &&
    oldest.oldestObligationDays != null &&
    oldest.id !== highest?.id
  ) {
    stories.push({
      id: `oldest-${oldest.id}`,
      badge: "Oldest exposure",
      title: oldest.name,
      amount: oldest.outstanding,
      facts: [
        `oldest open trip ${oldest.oldestObligationDays}d`,
        `${formatCount(oldest.openTrips)} open trips`,
      ],
      clientId: oldest.isLedgerOnly ? null : oldest.id,
      pipelineStage: null,
    });
  }

  if (highest && highest.shareOfOutstanding >= 40 && highest.openTrips > 1) {
    stories.push({
      id: `conc-${highest.id}`,
      badge: "Largest concentration",
      title: highest.name,
      amount: highest.outstanding,
      facts: [
        `${formatPct(highest.shareOfOutstanding)} of the open book sits with one customer`,
      ],
      clientId: highest.isLedgerOnly ? null : highest.id,
      pipelineStage: null,
    });
  }

  const blocked = pipelineStageById(model.pipeline, "pod_pending");
  if (blocked.value > 0) {
    stories.push({
      id: "billing-blocked",
      badge: "Billing blocked",
      title: "POD pending",
      amount: blocked.value,
      facts: [
        `${formatCount(blocked.count)} trips`,
        `${formatCount(blocked.customerCount)} customers`,
      ],
      clientId: null,
      pipelineStage: "pod_pending",
    });
  }

  if (model.issuedLast30Count > 0) {
    stories.push({
      id: "recently-billed",
      badge: "Recently billed",
      title: "Issued in last 30 days",
      amount: model.issuedLast30Value,
      facts: [`${formatCount(model.issuedLast30Count)} documents`],
      clientId: null,
      pipelineStage: "invoiced",
    });
  }

  return stories.slice(0, 4);
}

export function pipelineStageStory(
  stage: PipelineStageId | null,
  model: FinanceProModel,
): string | null {
  if (!stage) return null;
  const data = pipelineStageById(model.pipeline, stage);
  const label = PIPELINE_STAGE_LABELS[stage];
  if (stage === "ready_to_invoice" && data.count === 0) {
    return "No trips currently satisfy the physical-POD billing readiness condition.";
  }
  if (data.count === 0 && data.value === 0) {
    return `No trips currently sit in ${label}.`;
  }
  return `${label}: ${formatFinanceInr(data.value)} across ${formatCount(data.count)} trips and ${formatCount(data.customerCount)} customers.`;
}

export function clientAgeMixLines(row: ClientCollectionRow): string[] {
  return OBLIGATION_AGE_BUCKETS.filter((key) => row.ageMix[key] > 0).map(
    (key) => `${OBLIGATION_AGE_LABELS[key]}: ${formatFinanceInr(row.ageMix[key])}`,
  );
}

export function intelligenceStoryLines(
  filtered: FinanceProModel,
  selection: CanvasSelection,
  workspaceOutstanding: number,
): string[] {
  const lines: string[] = [];
  const row = selection.clientId
    ? filtered.clientRows.find((r) => r.id === selection.clientId)
    : null;
  if (row && row.outstanding > 0) {
    lines.push(
      `${row.name} · ${formatFinanceInr(row.outstanding)} open exposure`,
    );
    if (workspaceOutstanding > 0) {
      lines.push(
        `${formatPct(ratioPct(row.outstanding, workspaceOutstanding))} of total exposure`,
      );
    }
    lines.push(`${formatCount(row.openTrips)} open trips`);
    const top = filtered.concentration[0];
    if (top?.id === row.id && workspaceOutstanding > 0) {
      lines.push("Largest exposure in this workspace");
    }
    lines.push(...clientAgeMixLines(row));
  } else if (selection.ageBucket) {
    lines.push(
      `${formatFinanceInr(filtered.outstanding)} sits in this age band across ${formatCount(filtered.clientsWithBalance)} customers.`,
    );
  } else if (selection.pipelineStage) {
    const copy = pipelineStageStory(selection.pipelineStage, filtered);
    if (copy) lines.push(copy);
  } else if (selection.vintageMonthLabel) {
    lines.push(
      `${selection.vintageMonthLabel}: ${formatFinanceInr(filtered.billed)} commercial value, ${formatFinanceInr(filtered.attributedReceipts)} attributed receipts, ${formatFinanceInr(filtered.outstanding)} open.`,
    );
  }
  return lines;
}

export function client360StoryLines(
  client: ClientCollectionRow,
  workspaceOutstanding: number,
): string[] {
  const lines: string[] = [];
  if (client.outstanding > 0) {
    lines.push(
      `${formatCount(client.openTrips)} open trips contribute ${formatFinanceInr(client.outstanding)} of exposure.`,
    );
  }
  if (workspaceOutstanding > 0 && client.outstanding > 0) {
    const share = ratioPct(client.outstanding, workspaceOutstanding);
    if (share >= 10) {
      lines.push(
        `${formatPct(share)} of workspace exposure is concentrated with ${client.name}.`,
      );
    }
  }
  if (client.oldestObligationDays != null) {
    lines.push(
      `Oldest open obligation is ${client.oldestObligationDays} days.`,
    );
  }
  return lines;
}
