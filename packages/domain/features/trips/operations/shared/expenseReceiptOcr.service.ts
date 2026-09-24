import { generateGeminiVisionJson } from "@pulse/core/lib/gemini/geminiVisionJson.util";

import { compressOperationsPhotoToBase64 } from "../uploads/photoUploads";
import type { FuelType, OperationalPaymentMode, TripOtherExpenseCategory } from "../types";
import {
  AMOUNT_FIELD_KEYS,
  buildReceiptNotes,
  inferCityFromAddress,
  LITERS_FIELD_KEYS,
  normalizeCity,
  parseIndianAmount,
  parseLiters,
  strField,
  VENDOR_FIELD_KEYS,
} from "./expenseReceiptOcr.parse.util";

const TIMEOUT_MS = 22_000;
const OCR_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

export type ExpenseBillKind = "fuel" | "toll" | "other";

export type OcrScalarField<T> = {
  value: T;
  confidence: number;
};

export type ExpenseReceiptOcrResult = {
  amountInr: OcrScalarField<number> | null;
  liters: OcrScalarField<number> | null;
  vendorName: OcrScalarField<string> | null;
  city: OcrScalarField<string> | null;
  location: OcrScalarField<string> | null;
  description: OcrScalarField<string> | null;
  notes: OcrScalarField<string> | null;
  billDate: OcrScalarField<string> | null;
  fuelType: OcrScalarField<FuelType> | null;
  paymentMode: OcrScalarField<OperationalPaymentMode> | null;
  expenseCategory: OcrScalarField<TripOtherExpenseCategory> | null;
  detectedBillKind: OcrScalarField<ExpenseBillKind> | null;
  summary: string | null;
  model: string;
  processingTimeSec: number;
};

const SYSTEM_PROMPT = `You are an OCR engine for Indian logistics driver expense receipts (fuel, toll/FASTag, parking, loading, repair, food, and other trip costs).

Extract ONLY what is visibly written on the bill. Do not calculate line items into a total unless a printed total/paid/grand-total/sale amount is shown.

Output one valid JSON object only. No markdown, no code fences.

Each field must be { "value": <string|number>, "confidence": <0.0-1.0> }. Omit keys that are missing or unreadable.

CRITICAL: amount_inr is the highest-priority field. For Indian fuel pump receipts (HP/HPCL, IOCL, BPCL, Nayara), map the printed "Sale" or final paid amount to amount_inr.

Indian fuel pump receipts often show:
- dealer/agency/outlet name (e.g. BR AGENCIES) → vendor_name
- oil company (HPCL, IOCL, BPCL) → brand or notes
- address line (e.g. MC ROAD THANJAVUR) → address; city is the town name (THANJAVUR)
- Sale / Amount → amount_inr (number only, no Rs symbol)
- Volume / Qty with L suffix → volume or liters (number only, e.g. 43.00)
- Rate / Price per litre → rate_per_liter
- Bill No, Date, Time, FP ID, Nozzle No, Density, Preset → include in notes or separate keys
- Skip values literally printed as "NotEntered" or blank

Fields:
- amount_inr: total amount paid in INR (number only) — REQUIRED when Sale/Total/Paid is visible
- liters: fuel quantity in liters when printed (number only)
- volume: same as liters when receipt says Volume/Qty (number only, strip L)
- rate_per_liter: price per litre when printed (number only)
- vendor_name: pump dealer/agency/merchant name
- brand: oil company if shown (HPCL, IOCL, BPCL)
- address: full address line from receipt
- city: city or town from address (e.g. Thanjavur, Pune) — not state name
- location: specific place if separate from city (pump/plaza/yard)
- description: short expense label if visible
- notes: bill number, date, time, FP/nozzle/density/preset/phone — compact text
- bill_no, bill_date, date, density, preset, fp_id, nozzle_no: include when visible
- bill_date: DD-MM-YYYY or DD/MM/YYYY when visible
- fuel_type: diesel | petrol | cng | other when visible (HSD=diesel, MS=petrol)
- payment_mode: cash | fastag | card | credit | unknown when visible
- expense_category: parking | challan | loading | unloading | detention | maintenance | fastag | advance | food | weighbridge | misc
- bill_kind: fuel | toll | other
- summary: one short sentence describing what was extracted (always include this key)`;

function parseJson(text: string): Record<string, unknown> {
  let raw = text.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  return JSON.parse(raw) as Record<string, unknown>;
}

function str(value: unknown): string | null {
  return strField(value);
}

function confidenceOf(value: unknown, fallback = 0.75): number {
  if (value != null && typeof value === "object" && "confidence" in value) {
    const c = Number((value as { confidence: unknown }).confidence);
    return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : fallback;
  }
  return fallback;
}

function scalarField<T>(
  raw: unknown,
  mapValue: (value: unknown) => T | null,
): OcrScalarField<T> | null {
  const mapped = mapValue(raw != null && typeof raw === "object" && "value" in raw ? raw : raw);
  if (mapped == null) return null;
  return {
    value: mapped,
    confidence: confidenceOf(raw),
  };
}

function extractNestedAmount(container: unknown): OcrScalarField<number> | null {
  if (container == null || typeof container !== "object") return null;
  for (const key of AMOUNT_FIELD_KEYS) {
    const raw = (container as Record<string, unknown>)[key];
    if (raw == null) continue;
    const field = scalarField(raw, (v) => parseIndianAmount(v));
    if (field) return field;
  }
  return null;
}

/** Best-effort total amount — checks many common receipt field names. */
export function resolveOcrAmount(result: Pick<ExpenseReceiptOcrResult, "amountInr">): number | null {
  const primary = result.amountInr?.value;
  if (primary != null && primary > 0) return primary;
  return null;
}

/** Best-effort city from dedicated field or location aliases. */
export function resolveOcrCity(result: ExpenseReceiptOcrResult): string | null {
  const city = result.city?.value?.trim();
  if (city) return city;
  return null;
}

const CITY_FIELD_KEYS = [
  "city",
  "city_name",
  "town",
  "location_city",
  "address_city",
  "place_city",
] as const;

const LOCATION_FIELD_KEYS = [
  "location",
  "location_name",
  "place",
  "place_name",
  "plaza",
  "plaza_name",
  "station",
  "station_name",
  "yard",
  "depot",
  "address",
  "vendor_address",
  "full_address",
] as const;

function extractCityField(parsed: Record<string, unknown>): OcrScalarField<string> | null {
  for (const key of CITY_FIELD_KEYS) {
    if (parsed[key] == null) continue;
    const field = scalarField(parsed[key], normalizeCity);
    if (field) return field;
  }

  const nestedSources = [parsed.address, parsed.vendor_address, parsed.location_address, parsed.billing_address];
  for (const source of nestedSources) {
    if (typeof source === "string") {
      const inferred = inferCityFromAddress(source);
      if (inferred) return { value: inferred, confidence: 0.6 };
    }
    if (source != null && typeof source === "object" && "value" in source) {
      const inferred = inferCityFromAddress(str(source) ?? "");
      if (inferred) return { value: inferred, confidence: confidenceOf(source, 0.6) };
    }
  }

  const flatAddress = str(parsed.address) ?? str(parsed.vendor_address) ?? str(parsed.full_address);
  if (flatAddress) {
    const inferred = inferCityFromAddress(flatAddress);
    if (inferred) return { value: inferred, confidence: 0.58 };
  }

  return null;
}

function extractLocationField(parsed: Record<string, unknown>): OcrScalarField<string> | null {
  for (const key of LOCATION_FIELD_KEYS) {
    if (parsed[key] == null) continue;
    const field = scalarField(parsed[key], str);
    if (field) return field;
  }
  return null;
}

function extractAmountInr(parsed: Record<string, unknown>): OcrScalarField<number> | null {
  for (const key of AMOUNT_FIELD_KEYS) {
    if (parsed[key] == null) continue;
    const field = scalarField(parsed[key], (v) => parseIndianAmount(v));
    if (field) return field;
  }

  const nestedSources = [parsed.financials, parsed.payment, parsed.totals, parsed.summary_fields, parsed.fuel_details];
  for (const source of nestedSources) {
    const nested = extractNestedAmount(source);
    if (nested) return nested;
  }

  return null;
}

function extractLiters(parsed: Record<string, unknown>): OcrScalarField<number> | null {
  for (const key of LITERS_FIELD_KEYS) {
    if (parsed[key] == null) continue;
    const field = scalarField(parsed[key], (v) => parseLiters(v));
    if (field) return field;
  }

  const nestedSources = [parsed.fuel_details, parsed.fueling, parsed.summary_fields];
  for (const source of nestedSources) {
    if (source == null || typeof source !== "object") continue;
    for (const key of LITERS_FIELD_KEYS) {
      const raw = (source as Record<string, unknown>)[key];
      if (raw == null) continue;
      const field = scalarField(raw, (v) => parseLiters(v));
      if (field) return field;
    }
  }

  return null;
}

function extractVendorField(parsed: Record<string, unknown>): OcrScalarField<string> | null {
  for (const key of VENDOR_FIELD_KEYS) {
    if (parsed[key] == null) continue;
    const field = scalarField(parsed[key], str);
    if (field) return field;
  }

  const brand = str(parsed.brand) ?? str(parsed.oil_company) ?? str(parsed.company);
  if (brand) {
    return { value: brand, confidence: 0.55 };
  }

  return null;
}

function extractNotesField(parsed: Record<string, unknown>): OcrScalarField<string> | null {
  const fromModel = scalarField(parsed.notes, str);
  const composed = buildReceiptNotes(parsed, fromModel?.value ?? null);
  if (!composed) return fromModel;

  return {
    value: composed,
    confidence: Math.max(fromModel?.confidence ?? 0, 0.72),
  };
}

function normalizeFuelType(value: unknown): FuelType | null {
  const text = str(value)?.toLowerCase();
  if (!text) return null;
  if (text.includes("diesel") || text === "hsd") return "diesel";
  if (text.includes("petrol") || text.includes("ms")) return "petrol";
  if (text.includes("cng") || text.includes("png")) return "cng";
  if (text.includes("other")) return "other";
  return null;
}

function normalizePaymentMode(value: unknown): OperationalPaymentMode | null {
  const text = str(value)?.toLowerCase();
  if (!text) return null;
  if (text.includes("fastag") || text.includes("fast tag")) return "fastag";
  if (text.includes("cash")) return "cash";
  if (text.includes("card") || text.includes("upi")) return "card";
  if (text.includes("credit")) return "credit";
  if (text.includes("unknown")) return "unknown";
  return null;
}

const OTHER_EXPENSE_CATEGORIES: TripOtherExpenseCategory[] = [
  "parking",
  "challan",
  "loading",
  "unloading",
  "detention",
  "maintenance",
  "fastag",
  "advance",
  "food",
  "weighbridge",
  "misc",
];

function normalizeExpenseCategory(value: unknown): TripOtherExpenseCategory | null {
  const text = str(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!text) return null;

  if (OTHER_EXPENSE_CATEGORIES.includes(text as TripOtherExpenseCategory)) {
    return text as TripOtherExpenseCategory;
  }

  if (/parking|park/.test(text)) return "parking";
  if (/challan|fine|penalty|e_challan/.test(text)) return "challan";
  if (/loading|load/.test(text) && !/unloading|unload/.test(text)) return "loading";
  if (/unloading|unload/.test(text)) return "unloading";
  if (/detention|waiting|hold/.test(text)) return "detention";
  if (/repair|maintenance|service|puncture|tyre|oil/.test(text)) return "maintenance";
  if (/fastag|fast_tag|fast\s*tag/.test(text)) return "fastag";
  if (/advance|bata/.test(text)) return "advance";
  if (/food|meal|stay|hotel|dhaba|tea/.test(text)) return "food";
  if (/weigh|weighbridge|bridge/.test(text)) return "weighbridge";
  if (/toll|plaza|nhai/.test(text)) return "fastag";
  if (/misc|other|general/.test(text)) return "misc";

  return null;
}

function normalizeBillKind(value: unknown): ExpenseBillKind | null {
  const text = str(value)?.toLowerCase();
  if (!text) return null;
  if (
    text.includes("fuel") ||
    text.includes("petrol") ||
    text.includes("diesel") ||
    text.includes("pump") ||
    text.includes("hpcl") ||
    text.includes("iocl") ||
    text.includes("bpcl") ||
    text.includes("petroleum")
  ) {
    return "fuel";
  }
  if (text.includes("toll") || text.includes("fastag") || text.includes("plaza")) return "toll";
  if (text.includes("other")) return "other";
  return null;
}

function inferCategoryFromDescription(parsed: Record<string, unknown>): TripOtherExpenseCategory | null {
  const description = str(parsed.description) ?? str(parsed.vendor_name) ?? str(parsed.summary);
  return description ? normalizeExpenseCategory(description) : null;
}

function inferBillKindFromParsed(parsed: Record<string, unknown>): ExpenseBillKind | null {
  const explicit = normalizeBillKind(parsed.bill_kind);
  if (explicit) return explicit;

  const haystack = [
    str(parsed.summary),
    str(parsed.vendor_name),
    str(parsed.brand),
    str(parsed.company),
    str(parsed.description),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/hpcl|iocl|bpcl|petrol|diesel|fuel|pump|petroleum|volume|litre|liter/.test(haystack)) {
    return "fuel";
  }
  if (/toll|fastag|plaza|nhai/.test(haystack)) return "toll";
  return null;
}

function buildSummary(parsed: Record<string, unknown>, amountInr: OcrScalarField<number> | null): string | null {
  const existing = str(parsed.summary);
  if (existing) return existing;

  const parts: string[] = [];
  const amount = amountInr?.value ?? parseIndianAmount(parsed.sale ?? parsed.amount_inr);
  const vendor = str(parsed.vendor_name) ?? str(parsed.dealer_name) ?? str(parsed.agency_name);
  const liters = parseLiters(parsed.volume ?? parsed.liters);

  if (amount) parts.push(`₹${Math.round(amount).toLocaleString("en-IN")}`);
  if (vendor) parts.push(vendor);
  if (liters) parts.push(`${liters} L`);

  if (parts.length === 0) return "Bill attached · enter details manually";
  return `${parts.join(" · ")} detected on bill`;
}

function normalizeExtraction(parsed: Record<string, unknown>): Omit<ExpenseReceiptOcrResult, "model" | "processingTimeSec"> {
  const amountInr = extractAmountInr(parsed);
  let expenseCategory = scalarField(parsed.expense_category, normalizeExpenseCategory);

  if (!expenseCategory) {
    const inferred = inferCategoryFromDescription(parsed);
    if (inferred) {
      expenseCategory = { value: inferred, confidence: 0.62 };
    }
  }

  const detectedBillKind = scalarField(parsed.bill_kind, normalizeBillKind);
  const inferredBillKind = inferBillKindFromParsed(parsed);
  const liters = extractLiters(parsed);
  const isFuelBill =
    detectedBillKind?.value === "fuel" ||
    inferredBillKind === "fuel" ||
    (liters?.value != null && liters.value > 0);

  if (isFuelBill) {
    expenseCategory = null;
  }

  return {
    amountInr,
    liters,
    vendorName: extractVendorField(parsed),
    city: extractCityField(parsed),
    location: extractLocationField(parsed),
    description: scalarField(parsed.description, str),
    notes: extractNotesField(parsed),
    billDate:
      scalarField(parsed.bill_date, str) ??
      scalarField(parsed.date, str) ??
      scalarField(parsed.transaction_date, str),
    fuelType: scalarField(parsed.fuel_type, normalizeFuelType),
    paymentMode: scalarField(parsed.payment_mode, normalizePaymentMode),
    expenseCategory,
    detectedBillKind:
      detectedBillKind ??
      (inferredBillKind ? { value: inferredBillKind, confidence: 0.62 } : null),
    summary: buildSummary(parsed, amountInr),
  };
}

function buildUserPrompt(kind: ExpenseBillKind) {
  const fuelHints =
    kind === "fuel"
      ? `
Fuel form context: prioritize Sale→amount_inr, Volume→liters, dealer name→vendor_name, address→city.
Example HP receipt: Sale Rs.4000 → amount_inr:4000, Volume 43.00L → liters:43, vendor_name:"BR AGENCIES", address:"MC ROAD THANJAVUR" → city:"Thanjavur", notes:"Bill 419296-ORGNL · 25/08/2025 · Rate ₹93.02/L · 43 L · Density 813kg/m3".
`
      : "";

  return `Form context: driver is logging a "${kind}" expense, but the photo may be any receipt type.
Always extract amount_inr when a payable total or Sale line is visible.
Prioritize amount_inr, liters/volume (fuel), city (from address), vendor_name, then compose notes from bill metadata.
Indian receipts often print city in the address line (e.g. THANJAVUR in "MC ROAD THANJAVUR") — extract the town, not the state.
Return only valid JSON.${fuelHints}`;
}

export type ExpenseReceiptOcrProgress = "preparing" | "analyzing";

async function performOcr(
  base64: string,
  mimeType: string,
  kind: ExpenseBillKind,
): Promise<Omit<ExpenseReceiptOcrResult, "processingTimeSec">> {
  const textPrompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(kind)}`;
  const { text, model } = await generateGeminiVisionJson({
    prompt: textPrompt,
    base64,
    mimeType,
    models: OCR_MODELS,
    timeoutMs: TIMEOUT_MS,
  });
  const parsed = parseJson(text);
  return {
    ...normalizeExtraction(parsed),
    model,
  };
}

export async function extractExpenseReceiptOcr(
  localUri: string,
  kind: ExpenseBillKind,
  onProgress?: (phase: ExpenseReceiptOcrProgress) => void,
): Promise<ExpenseReceiptOcrResult> {
  const started = Date.now();
  onProgress?.("preparing");
  const { base64, mimeType } = await compressOperationsPhotoToBase64(localUri);

  onProgress?.("analyzing");
  const result = await performOcr(base64, mimeType, kind);

  return {
    ...result,
    processingTimeSec: (Date.now() - started) / 1000,
  };
}

/** @internal Test hook — normalizes raw model JSON without calling Gemini. */
export function normalizeExpenseReceiptParsedForTest(
  parsed: Record<string, unknown>,
): Omit<ExpenseReceiptOcrResult, "model" | "processingTimeSec"> {
  return normalizeExtraction(parsed);
}
