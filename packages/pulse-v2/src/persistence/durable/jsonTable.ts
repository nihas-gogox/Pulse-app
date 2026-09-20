import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { V2PersistenceError } from "../v2PersistenceError";

export { V2PersistenceError, isV2PersistenceError } from "../v2PersistenceError";
export type { V2PersistenceErrorKind } from "../v2PersistenceError";

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
      throw new V2PersistenceError("Invalid durable table (expected array)", { kind: "io" });
    }
    return parsed as T[];
  } catch (err) {
    if (err instanceof V2PersistenceError) throw err;
    throw new V2PersistenceError("Failed to read durable table", { cause: err, kind: "io" });
  }
}

export function writeJsonTable<T>(filePath: string, rows: T[]): void {
  const payload = `${JSON.stringify(rows, null, 2)}\n`;
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${process.hrtime.bigint()}.tmp`,
  );
  try {
    mkdirSync(dir, { recursive: true });
    const fd = openSync(tmp, "w");
    try {
      writeSync(fd, payload, undefined, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, filePath);
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      // tmp cleanup must not mask the write failure
    }
    throw new V2PersistenceError("Failed to write durable table", { cause: err, kind: "io" });
  }
}
