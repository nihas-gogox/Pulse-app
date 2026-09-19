import Theme from "@/constants/Theme";
import { ROUTES } from "@/lib/routes";
import { FinanceProContextBar } from "./FinanceProContextBar";
import { FinanceProHandoffActions } from "./FinanceProHandoffActions";
import { FinanceProDetailFrame } from "./FinanceProDetailFrame";
import { FINANCE_PRO_LAUNCH } from "./financeProLaunch";
import {
  FinanceProAgeBoard,
  FinanceProDataTable,
  FinanceProMetric,
  FinanceProMetricRow,
  FinanceProPageHero,
  FinanceProPanel,
  FinanceProPipelineFlow,
  FinanceProPrimaryAction,
  FinanceProStack,
  FinanceProWidgetRow,
} from "./FinanceProCanvas";
import { formatCount, formatFinanceInr, formatPct } from "./financeProFormat";
import {
  EMPTY_CANVAS_SELECTION,
  type ObligationAgeBucket,
  type PipelineStageId,
  type TripFinancialFact,
} from "../model/financeProTypes";
import {
  formatCanvasContextLabel,
  tripMatchesPipelineStage,
} from "../model/canvasContext.util";
import { client360StoryLines } from "../model/investigation.util";
import { aggregatePipelineFromFacts } from "../model/pipelineAggregation.util";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { financeProRouteParam } from "./financeProRouteParam";

function blocker(t: TripFinancialFact): string {
  if (t.remainingDue <= 0) return "—";
  if (!t.completed) return "Not completed";
  if (!t.podReceived) return "POD pending";
  if (!t.invoiced) return "Not invoiced";
  return "Open";
}

export function FinanceProClient360Screen() {
  const router = useRouter();
  const id = financeProRouteParam(useLocalSearchParams().id);
  const [ageBucket, setAgeBucket] = useState<ObligationAgeBucket | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStageId | null>(null);

  return (
    <FinanceProDetailFrame title="Client 360" eyebrow="Collections">
      {(model) => {
        const client = model.clientRows.find((r) => r.id === id);
        if (!client) {
          return (
            <Text style={styles.note}>
              Client not found in the current ledger model.
            </Text>
          );
        }
        const allTrips = model.tripFacts.filter((t) => t.clientId === id);
        const filteredTrips = allTrips.filter((t) => {
          if (ageBucket && !(t.remainingDue > 0 && t.ageBucket === ageBucket)) {
            return false;
          }
          if (pipelineStage && !tripMatchesPipelineStage(t, pipelineStage)) {
            return false;
          }
          return true;
        });
        const open = filteredTrips.filter((t) => t.remainingDue > 0);
        const docs = model.issuedInvoiceDocuments.filter(
          (d) => d.clientName && d.clientName.trim() === client.name.trim(),
        );
        const context = formatCanvasContextLabel({
          ...EMPTY_CANVAS_SELECTION,
          clientId: client.id,
          clientName: client.name,
          ageBucket,
          pipelineStage,
        });
        const insights = client360StoryLines(client, model.outstanding);
        const clientPipeline = aggregatePipelineFromFacts(
          allTrips,
          client.attributedReceipts,
          [client],
        );

        return (
          <FinanceProStack>
            <FinanceProPageHero
              eyebrow={client.name}
              value={formatFinanceInr(client.outstanding)}
              caption={`${formatPct(client.shareOfOutstanding)} of workspace exposure`}
            />
            <FinanceProContextBar
              label={ageBucket || pipelineStage ? context : null}
              onClear={() => {
                setAgeBucket(null);
                setPipelineStage(null);
              }}
            />

            <FinanceProPanel title="Position">
              <FinanceProMetricRow>
                <FinanceProMetric label="Billed" value={formatFinanceInr(client.billed)} />
                <FinanceProMetric
                  label="Cash attributed"
                  value={formatFinanceInr(client.attributedReceipts)}
                />
                <FinanceProMetric
                  label="Outstanding"
                  value={formatFinanceInr(client.outstanding)}
                />
                <FinanceProMetric
                  label="Open trips"
                  value={formatCount(client.openTrips)}
                />
              </FinanceProMetricRow>
            </FinanceProPanel>

            <FinanceProWidgetRow columns="1-1">
              <FinanceProPanel title="Exposure profile">
                <FinanceProAgeBoard
                  totals={client.ageMix}
                  selected={ageBucket}
                  onSelect={(bucket) =>
                    setAgeBucket((cur) => (cur === bucket ? null : bucket))
                  }
                />
              </FinanceProPanel>
              <FinanceProPanel title="Billing pipeline">
                <FinanceProPipelineFlow
                  pipeline={clientPipeline}
                  selected={pipelineStage}
                  onSelect={(stageId) =>
                    setPipelineStage((cur) => (cur === stageId ? null : stageId))
                  }
                />
              </FinanceProPanel>
            </FinanceProWidgetRow>

            <FinanceProDataTable<TripFinancialFact>
              title="Open trips"
              searchPlaceholder="Search trips…"
              columns={[
                {
                  key: "trip",
                  label: "Trip",
                  flex: 1.1,
                  minWidth: 120,
                  render: (t) => t.tripLabel,
                },
                {
                  key: "val",
                  label: "Value",
                  flex: 0.8,
                  minWidth: 96,
                  align: "right",
                  render: (t) => formatFinanceInr(t.sales),
                },
                {
                  key: "age",
                  label: "Age",
                  flex: 0.5,
                  minWidth: 56,
                  align: "right",
                  render: (t) => (t.daysOld == null ? "—" : `${t.daysOld}d`),
                },
                {
                  key: "pod",
                  label: "POD",
                  flex: 0.7,
                  minWidth: 80,
                  render: (t) => (t.podReceived ? "Received" : "Pending"),
                },
                {
                  key: "inv",
                  label: "Invoice",
                  flex: 0.8,
                  minWidth: 88,
                  render: (t) => (t.invoiced ? "Issued" : "Not invoiced"),
                },
                {
                  key: "open",
                  label: "Open exposure",
                  flex: 1,
                  minWidth: 110,
                  align: "right",
                  render: (t) => formatFinanceInr(t.remainingDue),
                },
                {
                  key: "block",
                  label: "Blocker",
                  flex: 1,
                  minWidth: 110,
                  render: (t) => blocker(t),
                },
              ]}
              rows={open}
              keyExtractor={(t) => t.tripId}
              onRowPress={(t) => router.push(ROUTES.financeProTrip(t.tripId))}
              empty="No matching open trip obligations."
            />

            {insights.length ? (
              <FinanceProPanel title="Financial story">
                {insights.map((line) => (
                  <Text key={line} style={styles.insight}>
                    {line}
                  </Text>
                ))}
              </FinanceProPanel>
            ) : null}

            <FinanceProWidgetRow columns="1-1">
              <FinanceProPanel title="Documents">
                {docs.length === 0 ? (
                  <Text style={styles.note}>No issued documents matched by customer name.</Text>
                ) : (
                  docs.map((d) => (
                    <Pressable
                      key={d.id}
                      style={styles.row}
                      onPress={() => router.push(ROUTES.financeProInvoice(d.id))}
                    >
                      <Text style={styles.rowTitle}>{d.invoiceNumber}</Text>
                      <Text style={styles.note}>
                        {d.invoiceDate} · {formatFinanceInr(d.documentAmount)} · {d.status}
                      </Text>
                    </Pressable>
                  ))
                )}
              </FinanceProPanel>
              <FinanceProPanel title="Actions">
                <FinanceProPrimaryAction
                  label="Open customer operations"
                  onPress={() => router.push(FINANCE_PRO_LAUNCH.coreClient(id ?? ""))}
                />
                <View style={styles.pad}>
                  <FinanceProHandoffActions />
                </View>
              </FinanceProPanel>
            </FinanceProWidgetRow>
          </FinanceProStack>
        );
      }}
    </FinanceProDetailFrame>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, color: Theme.textSecondary, lineHeight: 18, marginTop: 6 },
  insight: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: Theme.textPrimary,
    lineHeight: 20,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.border,
  },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  pad: { marginTop: 12 },
});
