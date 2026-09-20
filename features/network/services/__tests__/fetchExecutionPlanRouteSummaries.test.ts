import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("fetchExecutionPlanRouteSummaries", () => {
  it("does not nest client_warehouses on execution_plan_stops", () => {
    const source = readFileSync(
      join(__dirname, "../fetchExecutionPlanRouteSummaries.ts"),
      "utf8",
    );
    expect(source).toContain("execution_plan_id, stop_type, sequence, label, city, state, address_line");
    expect(source).not.toContain("warehouse:client_warehouses");
    expect(source).toContain("console.warn");
  });
});
