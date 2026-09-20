jest.mock("@/features/finance/services/finance.service", () => ({
  createLedgerEntry: jest.fn(),
  updateLedgerEntry: jest.fn(),
}));

const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: () => {
      throw new Error("unexpected table");
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

import { setTripDocumentVerification } from "@/features/tripCompliance/services/tripComplianceWrite.service";

describe("setTripDocumentVerification — approve / decline", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ error: null });
  });

  it("approves through verify_trip_document", async () => {
    const { error } = await setTripDocumentVerification({
      document: { id: "doc-1", status: "pending" },
      organizationId: "org-1",
      actorId: "user-1",
      status: "verified",
    });
    expect(error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("verify_trip_document", {
      p_document_id: "doc-1",
      p_status: "verified",
      p_rejection_reason: null,
    });
  });

  it("requires a note before decline", async () => {
    const { error } = await setTripDocumentVerification({
      document: { id: "doc-1", status: "pending" },
      organizationId: "org-1",
      actorId: "user-1",
      status: "rejected",
      rejectionReason: "   ",
    });
    expect(error?.message).toMatch(/rejection reason is required/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("declines with the note through verify_trip_document", async () => {
    const { error } = await setTripDocumentVerification({
      document: { id: "doc-1", status: "pending" },
      organizationId: "org-1",
      actorId: "user-1",
      status: "rejected",
      rejectionReason: "Illegible LR",
    });
    expect(error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith("verify_trip_document", {
      p_document_id: "doc-1",
      p_status: "rejected",
      p_rejection_reason: "Illegible LR",
    });
  });
});
