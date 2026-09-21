/**
 * Phase 4: markTripHardCopyPodReceived() is now the ONE authoritative
 * hard-copy-POD-receipt operation — routes through record_trip_hard_copy_pod
 * (SECURITY DEFINER) instead of a raw trips.pod_received_at update.
 */
const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

import { markTripHardCopyPodReceived, fetchTripHardCopyPodReceipt } from "../tripDocumentLrPod.service";

describe("markTripHardCopyPodReceived", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("rejects locally with no trip id, never calling the RPC", async () => {
    const result = await markTripHardCopyPodReceived("");
    expect(result.error?.message).toMatch(/not linked/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls record_trip_hard_copy_pod with the trip id and no metadata when none is supplied", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await markTripHardCopyPodReceived("trip-1");
    expect(mockRpc).toHaveBeenCalledWith("record_trip_hard_copy_pod", {
      p_trip_id: "trip-1",
      p_courier: null,
      p_awb_number: null,
      p_received_by: null,
      p_comment: null,
    });
  });

  it("passes courier/AWB/received-by/comment through when supplied (e.g. from the Compliance panel or Log Incoming PODs)", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await markTripHardCopyPodReceived("trip-1", {
      courier: " BlueDart ",
      awbNumber: " AWB123 ",
      receivedBy: " Ramesh ",
      comment: " Checked at gate ",
    });
    expect(mockRpc).toHaveBeenCalledWith("record_trip_hard_copy_pod", {
      p_trip_id: "trip-1",
      p_courier: "BlueDart",
      p_awb_number: "AWB123",
      p_received_by: "Ramesh",
      p_comment: "Checked at gate",
    });
  });

  it("reports a successful first-time transition as not already received", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const result = await markTripHardCopyPodReceived("trip-1");
    expect(result.error).toBeNull();
    expect(result.alreadyReceived).toBe(false);
  });

  it("reports an idempotent retry (RPC returns false) as already received, not an error", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    const result = await markTripHardCopyPodReceived("trip-1");
    expect(result.error).toBeNull();
    expect(result.alreadyReceived).toBe(true);
  });

  it("surfaces an RPC error (e.g. unauthorized) instead of swallowing it", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "not authorized to record hard-copy POD for this organization" } });
    const result = await markTripHardCopyPodReceived("trip-1");
    expect(result.error?.message).toMatch(/not authorized/i);
  });
});

describe("fetchTripHardCopyPodReceipt", () => {
  it("reports not received when pod_received_at is null, without querying trip_workflow_events", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "trips") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { pod_received_at: null }, error: null }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    const { receipt } = await fetchTripHardCopyPodReceipt("trip-1");
    expect(receipt?.received).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith("trips");
    expect(mockFrom).not.toHaveBeenCalledWith("trip_workflow_events");
  });

  it("returns the persisted courier/AWB/received-by plus the comment from the latest audit event", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    pod_received_at: "2026-09-21T10:00:00Z",
                    pod_hard_copy_courier: "BlueDart",
                    pod_hard_copy_awb_number: "AWB123",
                    pod_hard_copy_received_by: "Ramesh",
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "trip_workflow_events") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: { payload: { comment: "Checked at gate" }, actor_id: "user-1" },
                        error: null,
                      }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    const { receipt } = await fetchTripHardCopyPodReceipt("trip-1");
    expect(receipt).toEqual({
      received: true,
      receivedAt: "2026-09-21T10:00:00Z",
      courier: "BlueDart",
      awbNumber: "AWB123",
      receivedBy: "Ramesh",
      comment: "Checked at gate",
      actorId: "user-1",
    });
  });
});
