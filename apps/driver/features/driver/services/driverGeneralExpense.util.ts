/**
 * Device-local general (no-trip) expense notes for the driver app.
 * Shared to fleet via WhatsApp — not persisted in Supabase (v1).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { uuidv7 } from "@pulse/core/lib/uuidv7";

const STORAGE_KEY = "driver_general_expenses_v1";

export type DriverGeneralExpenseCategory =
  | "fuel"
  | "toll"
  | "parking"
  | "food"
  | "maintenance"
  | "misc";

export type DriverGeneralExpenseNote = {
  id: string;
  category: DriverGeneralExpenseCategory;
  amountInr: number;
  note: string;
  createdAt: string;
};

export const GENERAL_EXPENSE_CATEGORY_OPTIONS: {
  value: DriverGeneralExpenseCategory;
  label: string;
}[] = [
  { value: "fuel", label: "Fuel" },
  { value: "toll", label: "Toll / FASTag" },
  { value: "parking", label: "Parking" },
  { value: "food", label: "Food / stay" },
  { value: "maintenance", label: "Repair" },
  { value: "misc", label: "Other" },
];

export function generalExpenseCategoryLabel(
  category: DriverGeneralExpenseCategory,
): string {
  return (
    GENERAL_EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ??
    "Other"
  );
}

async function readAll(): Promise<DriverGeneralExpenseNote[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DriverGeneralExpenseNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listDriverGeneralExpenses(): Promise<DriverGeneralExpenseNote[]> {
  const all = await readAll();
  return all.sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

export async function saveDriverGeneralExpense(input: {
  category: DriverGeneralExpenseCategory;
  amountInr: number;
  note?: string | null;
}): Promise<{ error: Error | null; entry: DriverGeneralExpenseNote | null }> {
  const amount = Math.round(Number(input.amountInr) || 0);
  if (amount <= 0) {
    return { error: new Error("Enter a valid amount"), entry: null };
  }
  const entry: DriverGeneralExpenseNote = {
    id: uuidv7(),
    category: input.category,
    amountInr: amount,
    note: (input.note ?? "").trim(),
    createdAt: new Date().toISOString(),
  };
  try {
    const prev = await readAll();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([entry, ...prev].slice(0, 100)),
    );
    return { error: null, entry };
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error("Could not save expense"),
      entry: null,
    };
  }
}

export function buildGeneralExpenseWhatsAppMessage(input: {
  entry: DriverGeneralExpenseNote;
  driverName?: string | null;
  fleetName?: string | null;
}): string {
  const cat = generalExpenseCategoryLabel(input.entry.category);
  const amt = `₹${input.entry.amountInr.toLocaleString("en-IN")}`;
  const lines = [
    "General expense (no trip)",
    input.fleetName?.trim() ? `Fleet: ${input.fleetName.trim()}` : null,
    input.driverName?.trim() ? `Driver: ${input.driverName.trim()}` : null,
    `Category: ${cat}`,
    `Amount: ${amt}`,
    input.entry.note ? `Note: ${input.entry.note}` : null,
    "Logged from Pulse driver app — settle offline.",
  ].filter(Boolean);
  return lines.join("\n");
}
