import {
  buildCommerceRouteHierarchy,
  groupPlanStopsToRouteSummaries,
  indentDisplayOriginDest,
  isMultiOrderExecutionPlan,
  type ExecutionPlanRouteStop,
  type ExecutionPlanRouteSummary,
} from "../executionPlanRouteSummary";

function stop(
  extras: Pick<ExecutionPlanRouteStop, "sequence" | "kind" | "kindIndex" | "place">,
): ExecutionPlanRouteStop {
  return {
    caption: extras.kind === "pickup" ? `Pickup ${extras.kindIndex}` : `Drop ${extras.kindIndex}`,
    latitude: null,
    longitude: null,
    ...extras,
  };
}

describe("groupPlanStopsToRouteSummaries", () => {
  it("uses warehouse city for pickups and stop address for drops", () => {
    const summaries = groupPlanStopsToRouteSummaries([
      {
        execution_plan_id: "plan-1",
        stop_type: "pickup",
        sequence: 1,
        label: "Pickup A",
        city: null,
        state: null,
        address_line: null,
        warehouse: { city: "Chennai", state: "Tamil Nadu", address: "Muthu street" },
      },
      {
        execution_plan_id: "plan-1",
        stop_type: "drop",
        sequence: 2,
        label: "Drop C",
        city: "",
        state: "",
        address_line: "Ramaraj street",
        warehouse: null,
      },
      {
        execution_plan_id: "plan-1",
        stop_type: "drop",
        sequence: 3,
        label: "Drop D",
        city: "Banglore",
        state: "Karnataka",
        address_line: "Mukunt drear",
        warehouse: null,
      },
    ]);

    expect(summaries["plan-1"]).toEqual({
      pickup: "Chennai, Tamil Nadu",
      drop: "Ramaraj street · Banglore, Karnataka",
      stops: [
        {
          sequence: expect.any(Number),
          kind: "pickup",
          kindIndex: 1,
          caption: "Pickup 1",
          place: "Chennai, Tamil Nadu",
          latitude: null,
          longitude: null,
        },
        {
          sequence: expect.any(Number),
          kind: "drop",
          kindIndex: 1,
          caption: "Drop 1",
          place: "Ramaraj street",
          latitude: null,
          longitude: null,
        },
        {
          sequence: expect.any(Number),
          kind: "drop",
          kindIndex: 2,
          caption: "Drop 2",
          place: "Banglore, Karnataka",
          latitude: null,
          longitude: null,
        },
      ],
    });
    expect(isMultiOrderExecutionPlan(summaries["plan-1"])).toBe(true);
  });

  it("uses stop city when warehouse is omitted", () => {
    const summaries = groupPlanStopsToRouteSummaries([
      {
        execution_plan_id: "plan-2",
        stop_type: "pickup",
        sequence: 1,
        label: "Pickup A",
        city: "Chennai",
        state: "Tamil Nadu",
        address_line: null,
      },
      {
        execution_plan_id: "plan-2",
        stop_type: "drop",
        sequence: 2,
        label: "Drop C",
        city: "Banglore",
        state: "Karnataka",
        address_line: "Ramaraj street",
      },
    ]);

    expect(summaries["plan-2"]).toMatchObject({
      pickup: "Chennai, Tamil Nadu",
      drop: "Banglore, Karnataka",
    });
  });
});

describe("indentDisplayOriginDest", () => {
  it("overlays planner labels with plan locations", () => {
    expect(
      indentDisplayOriginDest(
        {
          pickup_area: "Pickup A",
          drop_location: "2 drops (Drop C, Drop D)",
          execution_plan_id: "plan-1",
        },
        {
          "plan-1": {
            pickup: "Chennai, Tamil Nadu",
            drop: "Ramaraj street · Banglore, Karnataka",
            stops: [],
          },
        },
      ),
    ).toEqual({
      origin: "Chennai, Tamil Nadu",
      dest: "Ramaraj street · Banglore, Karnataka",
    });
  });
});

describe("isMultiOrderExecutionPlan", () => {
  it("does not throw when summary or stops is missing", () => {
    expect(isMultiOrderExecutionPlan(null)).toBe(false);
    expect(isMultiOrderExecutionPlan(undefined)).toBe(false);
    expect(
      isMultiOrderExecutionPlan({
        pickup: "Chennai",
        drop: "Bangalore",
      } as ExecutionPlanRouteSummary),
    ).toBe(false);
    expect(
      isMultiOrderExecutionPlan({
        pickup: "Chennai",
        drop: "Bangalore",
        stops: undefined as unknown as ExecutionPlanRouteStop[],
      }),
    ).toBe(false);
  });
});

describe("buildCommerceRouteHierarchy", () => {
  it("single pickup + final drop has no via line", () => {
    expect(
      buildCommerceRouteHierarchy([
        stop({ sequence: 1, kind: "pickup", kindIndex: 1, place: "Chennai Warehouse" }),
        stop({ sequence: 2, kind: "drop", kindIndex: 1, place: "Bangalore" }),
      ]),
    ).toEqual({
      pickupPlace: "Chennai Warehouse",
      finalDropPlace: "Bangalore",
      intermediateCount: 0,
      intermediatePlaces: [],
    });
    expect(
      isMultiOrderExecutionPlan({
        pickup: "Chennai Warehouse",
        drop: "Bangalore",
        stops: [
          stop({ sequence: 1, kind: "pickup", kindIndex: 1, place: "Chennai Warehouse" }),
          stop({ sequence: 2, kind: "drop", kindIndex: 1, place: "Bangalore" }),
        ],
      }),
    ).toBe(false);
  });

  it("one intermediate drop stays secondary to the last drop", () => {
    expect(
      buildCommerceRouteHierarchy([
        stop({ sequence: 1, kind: "pickup", kindIndex: 1, place: "Chennai Warehouse" }),
        stop({ sequence: 2, kind: "drop", kindIndex: 1, place: "Hosur" }),
        stop({ sequence: 3, kind: "drop", kindIndex: 2, place: "Bangalore" }),
      ]),
    ).toEqual({
      pickupPlace: "Chennai Warehouse",
      finalDropPlace: "Bangalore",
      intermediateCount: 1,
      intermediatePlaces: ["Hosur"],
    });
  });

  it("multiple intermediates stay secondary and count correctly", () => {
    expect(
      buildCommerceRouteHierarchy([
        stop({ sequence: 1, kind: "pickup", kindIndex: 1, place: "Chennai Warehouse" }),
        stop({ sequence: 2, kind: "drop", kindIndex: 1, place: "Hosur" }),
        stop({ sequence: 3, kind: "drop", kindIndex: 2, place: "Krishnagiri" }),
        stop({ sequence: 4, kind: "drop", kindIndex: 3, place: "Bangalore" }),
      ]),
    ).toEqual({
      pickupPlace: "Chennai Warehouse",
      finalDropPlace: "Bangalore",
      intermediateCount: 2,
      intermediatePlaces: ["Hosur", "Krishnagiri"],
    });
  });

  it("uses the last drop by execution sequence as the final destination", () => {
    const hierarchy = buildCommerceRouteHierarchy([
      stop({ sequence: 4, kind: "drop", kindIndex: 2, place: "Bangalore" }),
      stop({ sequence: 2, kind: "drop", kindIndex: 1, place: "Hosur" }),
      stop({ sequence: 1, kind: "pickup", kindIndex: 1, place: "Chennai Warehouse" }),
    ]);
    expect(hierarchy.finalDropPlace).toBe("Bangalore");
    expect(hierarchy.pickupPlace).toBe("Chennai Warehouse");
    expect(hierarchy.intermediatePlaces).toEqual(["Hosur"]);
  });

  it("does not fabricate missing optional location text", () => {
    expect(
      buildCommerceRouteHierarchy([
        stop({ sequence: 1, kind: "pickup", kindIndex: 1, place: "   " }),
        stop({ sequence: 2, kind: "drop", kindIndex: 1, place: "" }),
        stop({ sequence: 3, kind: "drop", kindIndex: 2, place: "Bangalore" }),
      ]),
    ).toEqual({
      pickupPlace: null,
      finalDropPlace: "Bangalore",
      intermediateCount: 1,
      intermediatePlaces: [],
    });
  });
});
