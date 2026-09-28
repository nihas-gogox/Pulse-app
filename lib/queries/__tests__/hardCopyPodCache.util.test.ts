import {
  patchCachedCompliancePod,
  patchCachedTripPod,
} from "@/lib/queries/hardCopyPodCache.util";

describe("patchCachedTripPod", () => {
  const patch = {
    pod_received_at: "2026-09-26T06:33:00.000Z",
    pod_hard_copy_received_by: "sneha",
    pod_hard_copy_courier: null,
    pod_hard_copy_awb_number: null,
  };

  it("updates only the matching trip in a list", () => {
    const list = [
      { id: "trip-a", pickup_area: "A", pod_received_at: null },
      { id: "trip-b", pickup_area: "B", pod_received_at: null },
    ];
    const next = patchCachedTripPod(list, "trip-a", patch) as typeof list;
    expect(next[0]?.pod_received_at).toBe(patch.pod_received_at);
    expect(next[0]?.pod_hard_copy_received_by).toBe("sneha");
    expect(next[1]).toBe(list[1]);
  });

  it("updates a bundle trip and infinite pages without touching other trips", () => {
    const bundle = {
      trip: { id: "trip-a", trip_number: "SAT812", pod_received_at: null },
      documents: [{ id: "doc-1" }],
    };
    const pages = {
      pages: [
        {
          trips: [
            { id: "trip-b", display_trip_id: "OTHER", pod_received_at: null },
            { id: "trip-a", display_trip_id: "SAT812", pod_received_at: null },
          ],
        },
      ],
      pageParams: [0],
    };

    const nextBundle = patchCachedTripPod(bundle, "trip-a", patch) as typeof bundle;
    const nextPages = patchCachedTripPod(pages, "trip-a", patch) as typeof pages;

    expect(nextBundle.trip.pod_received_at).toBe(patch.pod_received_at);
    expect(nextBundle.documents).toBe(bundle.documents);
    expect(nextPages.pages[0]?.trips[0]?.pod_received_at).toBeNull();
    expect(nextPages.pages[0]?.trips[1]?.pod_received_at).toBe(patch.pod_received_at);
    expect(nextPages.pageParams).toBe(pages.pageParams);
  });

  it("updates the compliance summary for that trip only", () => {
    const cache = {
      summaries: [
        {
          trip: { id: "trip-a", pickup_area: "A", pod_received_at: null },
          hardCopyPod: {
            received: false,
            receivedAt: null,
            courier: null,
            awbNumber: null,
            receivedBy: null,
          },
        },
        {
          trip: { id: "trip-b", pickup_area: "B", pod_received_at: null },
          hardCopyPod: {
            received: false,
            receivedAt: null,
            courier: null,
            awbNumber: null,
            receivedBy: null,
          },
        },
      ],
    };
    const next = patchCachedCompliancePod(cache, "trip-a", {
      received: true,
      receivedAt: patch.pod_received_at ?? null,
      courier: null,
      awbNumber: null,
      receivedBy: "sneha",
    }) as typeof cache;
    expect(next.summaries[0]?.hardCopyPod.received).toBe(true);
    expect(next.summaries[0]?.hardCopyPod.receivedBy).toBe("sneha");
    expect(next.summaries[0]?.trip.pod_received_at).toBe(patch.pod_received_at);
    expect(next.summaries[1]).toBe(cache.summaries[1]);
  });

  it("returns the same reference when the trip is absent", () => {
    const list = [{ id: "trip-b", pickup_area: "B" }];
    expect(patchCachedTripPod(list, "trip-a", patch)).toBe(list);
  });
});
