import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createCommerceStore } from "../src/domains/commerce/store";
import { createExecutionStore } from "../src/domains/execution/store";

describe("Pulse V2 in-process Gateway", () => {
  it("lets Commerce persist to its own sales_orders store", () => {
    const store = createCommerceStore();
    store.insertSalesOrder({ id: "so-1", workspaceId: "ws-1", status: "draft" });
    expect(store.getSalesOrder("so-1")?.status).toBe("draft");
  });

  it("lets Execution persist to its own trips store", () => {
    const store = createExecutionStore();
    store.insertTrip({
      id: "trip-1",
      workspaceId: "ws-1",
      orderId: "so-1",
      status: "created",
    });
    expect(store.getTrip("trip-1")?.orderId).toBe("so-1");
  });

  it("creates an order and a trip only through execute()", () => {
    const { execute, dataPlane } = createPulseV2Gateway({
      PULSE_V2_SUPABASE_URL: "",
    });
    expect(dataPlane.mode).toBe("memory");

    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      payload: { id: "so-9", workspaceId: "ws-9" },
      correlationId: "corr-9",
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const fetched = execute({
      domain: "execution",
      operation: "getTrip",
      payload: { id: "trip-so-9" },
      correlationId: "corr-9b",
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.data).toEqual({
      trip: {
        id: "trip-so-9",
        workspaceId: "ws-9",
        orderId: "so-9",
        status: "created",
      },
    });
  });
});
