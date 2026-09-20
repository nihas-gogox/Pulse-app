export type V2SalesOrder = {
  id: string;
  workspaceId: string;
  status: "draft" | "placed";
};

export function createCommerceStore() {
  const salesOrders = new Map<string, V2SalesOrder>();

  return {
    table: "sales_orders" as const,
    insertSalesOrder(order: V2SalesOrder): V2SalesOrder {
      salesOrders.set(order.id, order);
      return order;
    },
    getSalesOrder(id: string): V2SalesOrder | null {
      return salesOrders.get(id) ?? null;
    },
  };
}

export type CommerceStore = ReturnType<typeof createCommerceStore>;
