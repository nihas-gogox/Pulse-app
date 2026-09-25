import {
  resolveIndentDeployQuote,
  resolveIndentDeployQuoteWithFreshQuote,
} from "../resolveIndentDeployQuote.util";

const load = {
  id: "indent-1",
  assigned_supplier_id: "awarded-org",
  status: "awarded",
  assigned_supplier_rate: 20000,
};

const acceptedQuote = {
  id: "q-1",
  indent_id: "indent-1",
  status: "accepted",
} as const;

describe("resolveIndentDeployQuote", () => {
  it("uses assigned_indent when this org won the load, even if a direct quote exists", () => {
    const resolution = resolveIndentDeployQuote(load, "awarded-org", [
      acceptedQuote as never,
    ]);
    expect(resolution?.mode).toBe("assigned_indent");
  });

  it("uses direct_quote only when this org is not the assigned supplier", () => {
    const resolution = resolveIndentDeployQuote(
      { ...load, assigned_supplier_id: "other-org" },
      "awarded-org",
      [acceptedQuote as never],
    );
    expect(resolution).toEqual({ mode: "direct_quote", quote: acceptedQuote });
  });
});

describe("resolveIndentDeployQuoteWithFreshQuote", () => {
  it("does not let a companion quote override an assigned marketplace/network award", () => {
    const resolution = resolveIndentDeployQuoteWithFreshQuote(
      load,
      "awarded-org",
      [],
      acceptedQuote as never,
    );
    expect(resolution?.mode).toBe("assigned_indent");
  });
});
