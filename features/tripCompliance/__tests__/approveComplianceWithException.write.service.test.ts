// See tripComplianceWrite.service.test.ts for why finance.service is mocked here.
jest.mock("@/features/finance/services/finance.service", () => ({
  createLedgerEntry: jest.fn(),
  updateLedgerEntry: jest.fn(),
}));

const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    rpc: mockRpc,
  }),
}));

import { approveComplianceWithException } from "@/features/tripCompliance/services/tripComplianceWrite.service";

describe("approveComplianceWithException", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects locally with an empty comment, never calling the RPC", async () => {
    const result = await approveComplianceWithException({ tripId: "trip-1", comment: "   " });
    expect(result.error?.message).toMatch(/comment is required/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls approve_trip_compliance_with_exception with the trimmed comment", async () => {
    mockRpc.mockResolvedValue({ error: null });
    const result = await approveComplianceWithException({
      tripId: "trip-1",
      comment: "  Supplier has submitted LR. Invoice and E-way Bill are pending.  ",
    });
    expect(result.error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("approve_trip_compliance_with_exception", {
      p_trip_id: "trip-1",
      p_comment: "Supplier has submitted LR. Invoice and E-way Bill are pending.",
    });
  });

  it("surfaces the RPC's error message (e.g. an unauthorized actor, or an already-decided trip)", async () => {
    mockRpc.mockResolvedValue({ error: { message: "not authorized to approve compliance for this organization" } });
    const result = await approveComplianceWithException({ tripId: "trip-1", comment: "Approving anyway." });
    expect(result.error?.message).toMatch(/not authorized/i);
  });
});
