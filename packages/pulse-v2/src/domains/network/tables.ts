export const NETWORK_SCHEMA = "v2_network";

/** Reserved. Network stays modular; schema is an ownership fence only. */
export const NETWORK_TABLES = [] as const;

export type NetworkTable = (typeof NETWORK_TABLES)[number];
