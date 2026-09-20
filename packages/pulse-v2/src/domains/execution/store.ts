export type V2Trip = {
  id: string;
  workspaceId: string;
  orderId: string;
  status: "created";
};

export function createExecutionStore() {
  const trips = new Map<string, V2Trip>();

  return {
    table: "trips" as const,
    insertTrip(trip: V2Trip): V2Trip {
      trips.set(trip.id, trip);
      return trip;
    },
    getTrip(id: string): V2Trip | null {
      return trips.get(id) ?? null;
    },
    getTripByOrderId(orderId: string): V2Trip | null {
      for (const trip of trips.values()) {
        if (trip.orderId === orderId) return trip;
      }
      return null;
    },
  };
}

export type ExecutionStore = ReturnType<typeof createExecutionStore>;
