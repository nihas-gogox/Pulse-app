/**
 * Guards the indent list against the nested trips embed that ran trips RLS
 * per row (2026-09-30 production: 13–14s for LIMIT 500).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(__dirname, "../indents.service.ts"), "utf8");

describe("getIndentsByOrganization list query", () => {
  it("does not embed trips; loads display codes with a chunked indent_id IN()", () => {
    const listFn = SOURCE.slice(
      SOURCE.indexOf("export async function getIndentsByOrganization"),
      SOURCE.indexOf("export async function getIndentsDelta"),
    );
    expect(listFn).toContain('.select("*")');
    expect(listFn).not.toMatch(/active_trip:trips/);
    expect(listFn).toContain("attachActiveTripRefs");

    const attach = SOURCE.slice(
      SOURCE.indexOf("async function attachActiveTripRefs"),
      SOURCE.indexOf("export async function getIndentsByOrganization"),
    );
    expect(attach).toContain('.from("trips")');
    expect(attach).toContain('.in("indent_id"');
    expect(SOURCE).toContain("TRIP_REF_IN_CHUNK");
    expect(attach).not.toMatch(/trips!/);
  });
});
