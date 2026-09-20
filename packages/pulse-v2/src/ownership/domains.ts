import { COMMERCE_SCHEMA, COMMERCE_TABLES } from "../domains/commerce/tables";
import { EXECUTION_SCHEMA, EXECUTION_TABLES } from "../domains/execution/tables";
import { IDENTITY_SCHEMA, IDENTITY_TABLES } from "../domains/identity/tables";
import { FINANCE_SCHEMA, FINANCE_TABLES } from "../domains/finance/tables";
import { NETWORK_SCHEMA, NETWORK_TABLES } from "../domains/network/tables";

export const V2_DOMAIN_SCHEMAS = {
  identity: IDENTITY_SCHEMA,
  commerce: COMMERCE_SCHEMA,
  execution: EXECUTION_SCHEMA,
  finance: FINANCE_SCHEMA,
  network: NETWORK_SCHEMA,
} as const;

export const V2_DOMAIN_TABLES: Record<string, readonly string[]> = {
  identity: IDENTITY_TABLES,
  commerce: COMMERCE_TABLES,
  execution: EXECUTION_TABLES,
  finance: FINANCE_TABLES,
  network: NETWORK_TABLES,
};

export type V2OwnedDomain = keyof typeof V2_DOMAIN_SCHEMAS;
