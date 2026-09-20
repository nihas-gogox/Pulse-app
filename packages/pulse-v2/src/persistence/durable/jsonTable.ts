import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export class V2PersistenceError extends Error {
  readonly code = "V2_PERSISTENCE_FAILED";
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "V2PersistenceError";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function commerceTablePath(dataDir: string): string {
  return path.join(dataDir, "v2_commerce.sales_orders.json");
}

export function executionTablePath(dataDir: string): string {
  return path.join(dataDir, "v2_execution.trips.json");
}

export function readJsonTable<T>(filePath: string): T[] {
  try {
    if (!existsSync(filePath)) return [];
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new V2PersistenceError(`Invalid table file (expected array): ${filePath}`);
    }
    return parsed as T[];
  } catch (err) {
    if (err instanceof V2PersistenceError) throw err;
    throw new V2PersistenceError(`Failed to read ${filePath}`, { cause: err });
  }
}

export function writeJsonTable<T>(filePath: string, rows: T[]): void {
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  } catch (err) {
    throw new V2PersistenceError(`Failed to write ${filePath}`, { cause: err });
  }
}
