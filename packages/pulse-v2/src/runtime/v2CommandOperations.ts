/**
 * V2 execute() operations that participate in Command Store.
 * Queries use the existing read path and must not create CommandRecords.
 */
export const V2_COMMAND_OPERATIONS = ["createOrder", "createTripFromOrder"] as const;
export const V2_QUERY_OPERATIONS = ["getOrder", "getTrip", "getTripByOrderId"] as const;

export type V2CommandOperation = (typeof V2_COMMAND_OPERATIONS)[number];

export function isV2CommandOperation(operation: string): operation is V2CommandOperation {
  return (V2_COMMAND_OPERATIONS as readonly string[]).includes(operation);
}
