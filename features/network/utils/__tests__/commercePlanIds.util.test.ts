import {
  chunkIds,
  COMMERCE_PLAN_ENRICH_CAP,
  extractCommercePlanIds,
  mapChunksInFlight,
  prioritizeIndentRowsForPlanEnrichment,
} from "../commercePlanIds.util";

describe("extractCommercePlanIds", () => {
  it("dedupes, trims, and skips empty plan ids", () => {
    expect(
      extractCommercePlanIds([
        { execution_plan_id: " plan-a " },
        { execution_plan_id: "plan-a" },
        { execution_plan_id: "" },
        { execution_plan_id: null },
        { execution_plan_id: "plan-b" },
      ]),
    ).toEqual(["plan-a", "plan-b"]);
  });

  it("caps how many plans cards may enrich", () => {
    const rows = Array.from({ length: COMMERCE_PLAN_ENRICH_CAP + 20 }, (_, i) => ({
      execution_plan_id: `plan-${i}`,
    }));
    expect(extractCommercePlanIds(rows)).toHaveLength(COMMERCE_PLAN_ENRICH_CAP);
  });

  it("keeps earlier (visible) rows when over the cap", () => {
    expect(
      extractCommercePlanIds(
        [{ execution_plan_id: "visible" }, { execution_plan_id: "later" }],
        1,
      ),
    ).toEqual(["visible"]);
  });
});

describe("prioritizeIndentRowsForPlanEnrichment", () => {
  it("puts open loads ahead of completed history", () => {
    const rows = [
      { id: "old", status: "completed", execution_plan_id: "p-old" },
      { id: "live", status: "open", execution_plan_id: "p-live" },
    ];
    expect(prioritizeIndentRowsForPlanEnrichment(rows).map((r) => r.id)).toEqual([
      "live",
      "old",
    ]);
  });
});

describe("chunkIds", () => {
  it("splits ids into bounded IN-list chunks", () => {
    expect(chunkIds(["a", "b", "c", "d"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("mapChunksInFlight", () => {
  it("runs workers and preserves order", async () => {
    const seen: number[] = [];
    const result = await mapChunksInFlight([1, 2, 3], 2, async (n) => {
      seen.push(n);
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30]);
    expect(seen.sort()).toEqual([1, 2, 3]);
  });
});
