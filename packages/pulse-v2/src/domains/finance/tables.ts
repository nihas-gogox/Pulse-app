export const FINANCE_SCHEMA = "v2_finance";

/** Reserved. Finance extraction is out of scope; schema is an ownership fence only. */
export const FINANCE_TABLES = [] as const;

export type FinanceTable = (typeof FINANCE_TABLES)[number];
