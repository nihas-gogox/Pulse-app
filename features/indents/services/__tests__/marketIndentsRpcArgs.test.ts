/**
 * Guards the PostgREST named-arg for market_indents_for_org.
 * Renaming the SQL param without updating the client 404s Claimed/Find Work.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("market_indents_for_org client args", () => {
  it("calls the RPC with p_org_id (not org_id)", () => {
    const source = readFileSync(
      join(__dirname, "../indents.service.ts"),
      "utf8",
    );
    const start = source.indexOf("market_indents_for_org");
    const rpcBlock = source.slice(
      start,
      source.indexOf("quoted_indents_for_org", start),
    );
    expect(rpcBlock).toContain("p_org_id:");
    expect(rpcBlock).not.toMatch(/\{\s*org_id:/);
  });
});
