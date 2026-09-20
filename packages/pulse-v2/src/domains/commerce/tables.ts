/** Tables this V2 Commerce module may touch. Not production schema. */
export const COMMERCE_TABLES = [
  "sales_orders",
  "commerce_products",
  "commerce_inventory",
] as const;

export type CommerceTable = (typeof COMMERCE_TABLES)[number];
