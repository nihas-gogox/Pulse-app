import { buildFinanceProModel } from "../buildFinanceProModel";
import {
  clearCanvasSelection,
  filterModelByCanvas,
  formatCanvasContextLabel,
  toggleAgeBucketSelection,
  toggleClientSelection,
  togglePipelineStageSelection,
  toggleVintageMonthSelection,
} from "../canvasContext.util";
import { ratioPct } from "../collectionMath.util";
import {
  buildAttentionStories,
  buildInvestigationBrief,
  pipelineStageStory,
} from "../investigation.util";
import { EMPTY_CANVAS_SELECTION } from "../financeProTypes";
import {
  obligationAgeBucket,
  pickupAgeDays,
} from "../obligationAge.util";
import type { CustomerLedgerInputs } from "@/features/finance/services/ledgerAggregationRpc.service";

const NOW = new Date("2026-09-12T12:00:00.000Z");

function inputs(partial: Partial<CustomerLedgerInputs>): CustomerLedgerInputs {
  return {
    trip_inputs: [],
    unlinked_payments: [],
    ledger_only_parties: [],
    client_ledger_totals: [],
    ...partial,
  };
}

describe("obligation age buckets", () => {
  it("maps pickup age to Current / 1–15 / 16–30 / 31–60 / 60+", () => {
    expect(obligationAgeBucket(0)).toBe("current");
    expect(obligationAgeBucket(1)).toBe("d1_15");
    expect(obligationAgeBucket(15)).toBe("d1_15");
    expect(obligationAgeBucket(16)).toBe("d16_30");
    expect(obligationAgeBucket(30)).toBe("d16_30");
    expect(obligationAgeBucket(31)).toBe("d31_60");
    expect(obligationAgeBucket(60)).toBe("d31_60");
    expect(obligationAgeBucket(61)).toBe("d60");
  });

  it("returns null days when pickup is missing", () => {
    expect(pickupAgeDays(null, NOW)).toBeNull();
  });
});

describe("collection math", () => {
  it("returns 0 for division by zero", () => {
    expect(ratioPct(50, 0)).toBe(0);
    expect(ratioPct(0, 0)).toBe(0);
  });

  it("computes concentration share", () => {
    expect(ratioPct(250, 1000)).toBe(25);
  });
});

describe("buildFinanceProModel", () => {
  const clients = [
    { id: "aero", name: "AERO", contact_person: null, is_integrated: false },
    { id: "apple", name: "APPLE", contact_person: null, is_integrated: false },
  ];

  it("computes trip-linked outstanding from billed minus attributed receipts", () => {
    const model = buildFinanceProModel({
      clients,
      now: NOW,
      trips: [
        {
          id: "t1",
          client_id: "aero",
          pickup_date: "2026-09-12",
          status: "completed",
          completed_at: "2026-09-12",
          pod_received_at: null,
        },
        {
          id: "t2",
          client_id: "apple",
          pickup_date: "2026-07-01",
          status: "completed",
          completed_at: "2026-07-02",
          pod_received_at: "2026-07-03",
        },
      ],
      issuedInvoices: [],
      inputs: inputs({
        trip_inputs: [
          { client_id: "aero", trip_id: "t1", sales: 1000, initial_paid: 0 },
          { client_id: "apple", trip_id: "t2", sales: 400, initial_paid: 100 },
        ],
        unlinked_payments: [{ client_id: "aero", transaction_id: "x", amount_in: 200 }],
      }),
    });

    expect(model.billed).toBe(1400);
    expect(model.outstanding).toBe(1100);
    expect(model.attributedReceipts).toBe(300);
    expect(model.collectionPct).toBeCloseTo(21.428, 2);
    expect(model.clientsWithBalance).toBe(2);

    const aero = model.clientRows.find((r) => r.id === "aero");
    expect(aero?.outstanding).toBe(800);
    expect(aero?.shareOfOutstanding).toBeCloseTo((800 / 1100) * 100, 5);
  });

  it("buckets open trip obligation by pickup age, not invoice due date", () => {
    const model = buildFinanceProModel({
      clients,
      now: NOW,
      trips: [
        {
          id: "t1",
          pickup_date: "2026-09-12",
          status: "completed",
          completed_at: "2026-09-12",
        },
        {
          id: "t2",
          pickup_date: "2026-08-01",
          status: "completed",
          completed_at: "2026-08-02",
        },
      ],
      inputs: inputs({
        trip_inputs: [
          { client_id: "aero", trip_id: "t1", sales: 100, initial_paid: 0 },
          { client_id: "apple", trip_id: "t2", sales: 250, initial_paid: 0 },
        ],
      }),
    });
    expect(model.ageTotals.current).toBe(100);
    expect(model.ageTotals.d31_60).toBe(250);
    expect(model.unagedOutstanding).toBe(0);
    expect(model.clientRows.find((r) => r.id === "apple")?.oldestObligationDays).toBeGreaterThan(30);
  });

  it("treats missing pickup as unaged, not a fake aging bucket", () => {
    const model = buildFinanceProModel({
      clients,
      now: NOW,
      trips: [{ id: "t1", pickup_date: null, status: "completed" }],
      inputs: inputs({
        trip_inputs: [
          { client_id: "aero", trip_id: "t1", sales: 90, initial_paid: 0 },
        ],
      }),
    });
    expect(model.unagedOutstanding).toBe(90);
    expect(model.ageTotals.current).toBe(0);
  });

  it("aggregates POD-blocked vs ready-to-invoice from physical POD + issued trip ids", () => {
    const model = buildFinanceProModel({
      clients,
      now: NOW,
      trips: [
        {
          id: "blocked",
          status: "completed",
          completed_at: "2026-09-01",
          pickup_date: "2026-09-01",
          pod_received_at: null,
        },
        {
          id: "ready",
          status: "completed",
          completed_at: "2026-09-01",
          pickup_date: "2026-09-01",
          pod_received_at: "2026-09-02",
        },
        {
          id: "billed",
          status: "completed",
          completed_at: "2026-09-01",
          pickup_date: "2026-09-01",
          pod_received_at: "2026-09-02",
        },
      ],
      issuedInvoices: [
        {
          id: "inv1",
          invoice_number: "INV-1",
          invoice_date: "2026-09-03",
          due_date: null,
          client_name: "AERO",
          total_amount: 99999,
          status: "issued",
          trip_ids: ["billed"],
        },
      ],
      inputs: inputs({
        trip_inputs: [
          { client_id: "aero", trip_id: "blocked", sales: 500, initial_paid: 0 },
          { client_id: "aero", trip_id: "ready", sales: 700, initial_paid: 0 },
          { client_id: "aero", trip_id: "billed", sales: 300, initial_paid: 0 },
        ],
      }),
    });

    const pending = model.pipeline.find((s) => s.id === "pod_pending");
    const ready = model.pipeline.find((s) => s.id === "ready_to_invoice");
    const invoiced = model.pipeline.find((s) => s.id === "invoiced");
    expect(pending).toEqual({
      id: "pod_pending",
      count: 1,
      value: 500,
      customerCount: 1,
    });
    expect(ready).toEqual({
      id: "ready_to_invoice",
      count: 1,
      value: 700,
      customerCount: 1,
    });
    expect(invoiced).toEqual({
      id: "invoiced",
      count: 1,
      value: 300,
      customerCount: 1,
    });
    expect(invoiced?.value).not.toBe(99999);
    expect(model.issuedThisMonthCount).toBe(1);
    expect(model.issuedThisMonthValue).toBe(99999);
  });

  it("counts digital POD as received when physical stamp is missing", () => {
    const model = buildFinanceProModel({
      clients,
      now: NOW,
      trips: [
        {
          id: "digital",
          status: "completed",
          completed_at: "2026-09-01",
          pickup_date: "2026-09-01",
          pod_received_at: null,
        },
      ],
      issuedInvoices: [],
      digitalPodTripIds: new Set(["digital"]),
      inputs: inputs({
        trip_inputs: [
          { client_id: "aero", trip_id: "digital", sales: 400, initial_paid: 0 },
        ],
      }),
    });
    const fact = model.tripFacts.find((t) => t.tripId === "digital");
    expect(fact?.physicalPodReceived).toBe(false);
    expect(fact?.podReceived).toBe(true);
    expect(model.pipeline.find((s) => s.id === "pod_pending")?.count).toBe(0);
    expect(model.pipeline.find((s) => s.id === "ready_to_invoice")?.count).toBe(1);
  });

  it("handles empty clients without throwing", () => {
    const model = buildFinanceProModel({
      clients: [],
      now: NOW,
      trips: [],
      inputs: inputs({}),
    });
    expect(model.billed).toBe(0);
    expect(model.outstanding).toBe(0);
    expect(model.collectionPct).toBe(0);
    expect(model.clientRows).toEqual([]);
    expect(model.attention).toEqual([]);
  });
});

describe("canvas selection", () => {
  const clients = [
    { id: "aero", name: "AERO", contact_person: null, is_integrated: false },
    { id: "apple", name: "APPLE", contact_person: null, is_integrated: false },
  ];
  const model = buildFinanceProModel({
    clients,
    now: NOW,
    trips: [
      {
        id: "t1",
        pickup_date: "2026-09-12",
        status: "completed",
        completed_at: "2026-09-12",
        pod_received_at: null,
      },
      {
        id: "t2",
        pickup_date: "2026-07-20",
        status: "completed",
        completed_at: "2026-07-21",
        pod_received_at: "2026-07-22",
      },
    ],
    inputs: inputs({
      trip_inputs: [
        { client_id: "aero", trip_id: "t1", sales: 800, initial_paid: 0 },
        { client_id: "apple", trip_id: "t2", sales: 200, initial_paid: 0 },
      ],
    }),
  });

  it("toggles client then age, formats context, and clears", () => {
    let sel = toggleClientSelection(EMPTY_CANVAS_SELECTION, "aero", "AERO");
    sel = toggleAgeBucketSelection(sel, "current");
    expect(formatCanvasContextLabel(sel)).toBe("AERO · Current");
    sel = toggleAgeBucketSelection(sel, "current");
    expect(sel.ageBucket).toBeNull();
    expect(formatCanvasContextLabel(sel)).toBe("AERO");
    sel = clearCanvasSelection();
    expect(sel).toEqual(EMPTY_CANVAS_SELECTION);
    expect(formatCanvasContextLabel(sel)).toBeNull();
  });

  it("cross-filters outstanding, aging, and pipeline without mutating the base model", () => {
    const aero = filterModelByCanvas(
      model,
      {
        clientId: "aero",
        clientName: "AERO",
        ageBucket: null,
        pipelineStage: null,
        vintageMonthKey: null,
        vintageMonthLabel: null,
      },
      NOW,
    );
    expect(aero.outstanding).toBe(800);
    expect(aero.clientRows).toHaveLength(1);
    expect(aero.ageTotals.current).toBe(800);
    expect(aero.pipeline.find((s) => s.id === "pod_pending")?.value).toBe(800);
    expect(model.outstanding).toBe(1000);

    const bucket = filterModelByCanvas(
      aero,
      {
        clientId: "aero",
        clientName: "AERO",
        ageBucket: "d31_60",
        pipelineStage: null,
        vintageMonthKey: null,
        vintageMonthLabel: null,
      },
      NOW,
    );
    expect(bucket.outstanding).toBe(0);
    expect(bucket.openTrips).toHaveLength(0);

    const ageOnly = filterModelByCanvas(
      model,
      {
        clientId: null,
        clientName: null,
        ageBucket: "d31_60",
        pipelineStage: null,
        vintageMonthKey: null,
        vintageMonthLabel: null,
      },
      NOW,
    );
    expect(ageOnly.outstanding).toBe(200);
    expect(ageOnly.clientRows.find((r) => r.id === "apple")?.outstanding).toBe(200);
    expect(ageOnly.clientRows.find((r) => r.id === "aero")?.outstanding).toBe(0);
  });

  it("filters trip facts by billing pipeline stage without leaving the canvas", () => {
    let sel = togglePipelineStageSelection(EMPTY_CANVAS_SELECTION, "pod_pending");
    expect(formatCanvasContextLabel(sel)).toBe("POD pending");
    const pending = filterModelByCanvas(model, sel, NOW);
    expect(pending.tripFacts).toHaveLength(1);
    expect(pending.tripFacts[0]?.tripId).toBe("t1");
    expect(pending.outstanding).toBe(800);
    sel = togglePipelineStageSelection(sel, "pod_pending");
    expect(sel.pipelineStage).toBeNull();
  });

  it("builds an investigation brief from the filtered model", () => {
    const sel = toggleAgeBucketSelection(EMPTY_CANVAS_SELECTION, "d31_60");
    expect(formatCanvasContextLabel(sel)).toBe("31–60 days");
    const filtered = filterModelByCanvas(model, sel, NOW);
    const brief = buildInvestigationBrief(filtered, sel);
    expect(brief.active).toBe(true);
    expect(brief.outstanding).toBe(200);
    expect(brief.clientCount).toBe(1);
    expect(brief.largestName).toBe("APPLE");
    expect(brief.openTripCount).toBe(1);
  });

  it("filters by pickup month and builds attention from loaded facts", () => {
    let sel = toggleVintageMonthSelection(EMPTY_CANVAS_SELECTION, "2026-07", "Jul 26");
    expect(formatCanvasContextLabel(sel)).toBe("Jul 26");
    const july = filterModelByCanvas(model, sel, NOW);
    expect(july.tripFacts).toHaveLength(1);
    expect(july.tripFacts[0]?.tripId).toBe("t2");
    expect(july.outstanding).toBe(200);
    sel = toggleVintageMonthSelection(sel, "2026-07", "Jul 26");
    expect(sel.vintageMonthKey).toBeNull();

    const stories = buildAttentionStories(model);
    expect(stories.some((s) => s.badge === "Highest exposure")).toBe(true);
    const emptyReady = pipelineStageStory("ready_to_invoice", {
      ...model,
      pipeline: model.pipeline.map((s) =>
        s.id === "ready_to_invoice" || s.id === "pod_received_not_invoiced"
          ? { ...s, count: 0, value: 0, customerCount: 0 }
          : s,
      ),
    });
    expect(emptyReady).toContain("physical-POD billing readiness");
  });
});

describe("collections investigation billed", () => {
  const clients = [
    { id: "aero", name: "AERO", contact_person: null, is_integrated: false },
    { id: "apple", name: "APPLE", contact_person: null, is_integrated: false },
  ];
  const model = buildFinanceProModel({
    clients,
    now: NOW,
    trips: [
      {
        id: "aero-current",
        pickup_date: "2026-09-12",
        status: "completed",
        completed_at: "2026-09-12",
        pod_received_at: null,
      },
      {
        id: "apple-3160",
        pickup_date: "2026-07-20",
        status: "completed",
        completed_at: "2026-07-21",
        pod_received_at: "2026-07-22",
      },
      {
        id: "apple-current",
        pickup_date: "2026-09-10",
        status: "completed",
        completed_at: "2026-09-10",
        pod_received_at: null,
      },
    ],
    inputs: inputs({
      trip_inputs: [
        { client_id: "aero", trip_id: "aero-current", sales: 800, initial_paid: 0 },
        { client_id: "apple", trip_id: "apple-3160", sales: 200, initial_paid: 50 },
        { client_id: "apple", trip_id: "apple-current", sales: 1800, initial_paid: 0 },
      ],
    }),
  });

  it("A. BASE — no investigation keeps workspace billed", () => {
    const view = filterModelByCanvas(model, EMPTY_CANVAS_SELECTION, NOW);
    expect(view).toBe(model);
    expect(view.billed).toBe(2800);
    expect(view.clientRows.find((r) => r.id === "apple")?.billed).toBe(2000);
    expect(view.clientRows.find((r) => r.id === "aero")?.billed).toBe(800);
  });

  it("B. AGE — 31–60 billed is the filtered slice, not customer workspace billed", () => {
    const sel = toggleAgeBucketSelection(EMPTY_CANVAS_SELECTION, "d31_60");
    const view = filterModelByCanvas(model, sel, NOW);
    expect(view.billed).toBe(200);
    expect(view.outstanding).toBe(150);
    expect(view.attributedReceipts).toBe(50);
    expect(view.collectionPct).toBe(ratioPct(50, 200));
    expect(view.clientRows.find((r) => r.id === "apple")?.billed).toBe(200);
    expect(view.clientRows.find((r) => r.id === "apple")?.attributedReceipts).toBe(50);
    expect(view.clientRows.find((r) => r.id === "apple")?.outstanding).toBe(150);
    expect(view.clientRows.find((r) => r.id === "aero")?.billed).toBe(0);
    expect(view.clientRows.find((r) => r.id === "aero")?.outstanding).toBe(0);
  });

  it("C. CUSTOMER — AERO billed follows the AERO slice", () => {
    const sel = toggleClientSelection(EMPTY_CANVAS_SELECTION, "aero", "AERO");
    const view = filterModelByCanvas(model, sel, NOW);
    expect(view.billed).toBe(800);
    expect(view.outstanding).toBe(800);
    expect(view.clientRows).toHaveLength(1);
    expect(view.clientRows[0]?.billed).toBe(800);
    expect(view.clientRows[0]?.attributedReceipts).toBe(0);
  });

  it("D. STAGE — pipeline investigation billed follows that slice", () => {
    const sel = togglePipelineStageSelection(EMPTY_CANVAS_SELECTION, "pod_pending");
    const view = filterModelByCanvas(model, sel, NOW);
    expect(view.billed).toBe(2600);
    expect(view.clientRows.find((r) => r.id === "aero")?.billed).toBe(800);
    expect(view.clientRows.find((r) => r.id === "apple")?.billed).toBe(1800);
    expect(view.clientRows.find((r) => r.id === "apple")?.outstanding).toBe(1800);
  });

  it("E. CLEAR — original base billed returns", () => {
    const aged = filterModelByCanvas(
      model,
      toggleAgeBucketSelection(EMPTY_CANVAS_SELECTION, "d31_60"),
      NOW,
    );
    expect(aged.billed).toBe(200);
    const cleared = filterModelByCanvas(model, clearCanvasSelection(), NOW);
    expect(cleared).toBe(model);
    expect(cleared.billed).toBe(2800);
    expect(cleared.clientRows.find((r) => r.id === "apple")?.billed).toBe(2000);
  });

  it("F. IMMUTABILITY — base model is not mutated", () => {
    const before = {
      billed: model.billed,
      appleBilled: model.clientRows.find((r) => r.id === "apple")?.billed,
      aeroBilled: model.clientRows.find((r) => r.id === "aero")?.billed,
    };
    filterModelByCanvas(
      model,
      toggleAgeBucketSelection(EMPTY_CANVAS_SELECTION, "d31_60"),
      NOW,
    );
    filterModelByCanvas(
      model,
      toggleClientSelection(EMPTY_CANVAS_SELECTION, "aero", "AERO"),
      NOW,
    );
    expect(model.billed).toBe(before.billed);
    expect(model.clientRows.find((r) => r.id === "apple")?.billed).toBe(before.appleBilled);
    expect(model.clientRows.find((r) => r.id === "aero")?.billed).toBe(before.aeroBilled);
  });

  it("G. NO NETWORK — investigation projection does not call fetch", () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    filterModelByCanvas(
      model,
      toggleAgeBucketSelection(EMPTY_CANVAS_SELECTION, "d31_60"),
      NOW,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
