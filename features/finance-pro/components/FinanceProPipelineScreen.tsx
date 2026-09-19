import { ROUTES } from "@/lib/routes";
import {
  FinanceProDataTable,
  FinanceProKpiCard,
  FinanceProKpiRow,
  FinanceProPanel,
  FinanceProPipelineFlow,
  FinanceProQuietAction,
  FinanceProStack,
  type FinanceProTableColumn,
} from "./FinanceProCanvas";
import { FinanceProInvestigation } from "./FinanceProInvestigation";
import { FinanceProWorkspaceFrame } from "./FinanceProWorkspaceFrame";
import { FINANCE_PRO_LAUNCH } from "./financeProLaunch";
import { formatCount, formatFinanceInr } from "./financeProFormat";
import {
  EMPTY_CANVAS_SELECTION,
  type CanvasSelection,
  type TripFinancialFact,
} from "../model/financeProTypes";
import {
  clearCanvasSelection,
  filterModelByCanvas,
  togglePipelineStageSelection,
  tripMatchesPipelineStage,
} from "../model/canvasContext.util";
import { pipelineStageById } from "../model/buildFinanceProModel";
import {
  buildInvestigationBrief,
  pipelineStageStory,
} from "../model/investigation.util";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

function blocker(t: TripFinancialFact): string {
  if (t.invoiced) return "—";
  if (t.completed && !t.podReceived) return "POD pending";
  if (t.completed && t.podReceived) return "Not billed";
  return "Not completed";
}

export function FinanceProPipelineScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_CANVAS_SELECTION);

  return (
    <FinanceProWorkspaceFrame title="Pipeline" hideTitle>
      {(base) => {
        const model = filterModelByCanvas(base, selection);
        const brief = buildInvestigationBrief(model, selection);
        const rows = selection.pipelineStage
          ? model.tripFacts.filter((t) =>
              tripMatchesPipelineStage(t, selection.pipelineStage!),
            )
          : model.tripFacts.filter((t) => t.completed || t.remainingDue > 0);
        const columns: FinanceProTableColumn<TripFinancialFact>[] = [
          { key: "t", label: "Trip", flex: 1.1, minWidth: 120, render: (r) => r.tripLabel },
          { key: "c", label: "Customer", flex: 1.3, minWidth: 140, render: (r) => r.clientName },
          {
            key: "v",
            label: "Trip value",
            flex: 1,
            minWidth: 110,
            align: "right",
            render: (r) => formatFinanceInr(r.sales),
          },
          {
            key: "p",
            label: "POD",
            flex: 0.8,
            minWidth: 88,
            render: (r) => (r.podReceived ? "Received" : "Pending"),
          },
          {
            key: "i",
            label: "Invoice",
            flex: 0.9,
            minWidth: 96,
            render: (r) => (r.invoiced ? "Issued" : "Not billed"),
          },
          { key: "b", label: "Blocker", flex: 1.1, minWidth: 130, render: (r) => blocker(r) },
          {
            key: "a",
            label: "Age",
            flex: 0.6,
            minWidth: 72,
            align: "right",
            render: (r) => (r.daysOld == null ? "—" : `${r.daysOld}d`),
          },
        ];
        const story = pipelineStageStory(selection.pipelineStage, model);

        return (
          <FinanceProStack>
            <FinanceProKpiRow>
              <FinanceProKpiCard
                label="Completed"
                value={formatFinanceInr(pipelineStageById(model.pipeline, "completed").value)}
                sub={`${formatCount(pipelineStageById(model.pipeline, "completed").count)} trips`}
                onPress={() =>
                  setSelection((s) => togglePipelineStageSelection(s, "completed"))
                }
              />
              <FinanceProKpiCard
                label="POD blocked"
                value={formatFinanceInr(pipelineStageById(model.pipeline, "pod_pending").value)}
                sub={`${formatCount(pipelineStageById(model.pipeline, "pod_pending").count)} trips`}
                onPress={() =>
                  setSelection((s) => togglePipelineStageSelection(s, "pod_pending"))
                }
              />
              <FinanceProKpiCard
                label="Ready to bill"
                value={formatFinanceInr(pipelineStageById(model.pipeline, "ready_to_invoice").value)}
                sub={`${formatCount(pipelineStageById(model.pipeline, "ready_to_invoice").count)} trips`}
                onPress={() =>
                  setSelection((s) => togglePipelineStageSelection(s, "ready_to_invoice"))
                }
              />
              <FinanceProKpiCard
                label="Invoiced"
                value={formatFinanceInr(pipelineStageById(model.pipeline, "invoiced").value)}
                sub={`${formatCount(pipelineStageById(model.pipeline, "invoiced").count)} trips`}
                onPress={() =>
                  setSelection((s) => togglePipelineStageSelection(s, "invoiced"))
                }
              />
            </FinanceProKpiRow>

            <FinanceProPanel title="Movement">
              <FinanceProPipelineFlow
                pipeline={model.pipeline}
                selected={selection.pipelineStage}
                onSelect={(id) =>
                  setSelection((s) => togglePipelineStageSelection(s, id))
                }
              />
            </FinanceProPanel>

            <FinanceProDataTable
              title="Evidence"
              searchPlaceholder="Search trips, customers…"
              context={
                brief.active ? (
                  <FinanceProInvestigation
                    brief={brief}
                    onClear={() => setSelection(clearCanvasSelection())}
                    story={story}
                  />
                ) : undefined
              }
              columns={columns}
              rows={rows}
              keyExtractor={(r) => r.tripId}
              onRowPress={(row) => router.push(ROUTES.financeProTrip(row.tripId))}
              empty={
                story ?? "No trips in this stage."
              }
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <FinanceProQuietAction
                label="Open Pulse Invoice"
                onPress={() => router.push(FINANCE_PRO_LAUNCH.pulseInvoice(pathname))}
              />
              <FinanceProQuietAction
                label="Open Pulse POD"
                onPress={() => router.push(FINANCE_PRO_LAUNCH.pulsePod(pathname))}
              />
            </View>
          </FinanceProStack>
        );
      }}
    </FinanceProWorkspaceFrame>
  );
}
