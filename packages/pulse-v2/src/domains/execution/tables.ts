export const EXECUTION_SCHEMA = "v2_execution";

/** Tables this V2 Execution module may touch. Not production schema. */
export const EXECUTION_TABLES = [
  "trips",
  "indents",
  "trip_documents",
  "execution_plan_stops",
] as const;

export type ExecutionTable = (typeof EXECUTION_TABLES)[number];
