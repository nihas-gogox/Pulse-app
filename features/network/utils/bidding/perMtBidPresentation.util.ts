/**
 * Per-MT bid presentation — labels, unit-rate conversion, and expected-trip
 * estimates. Stored bids stay trip totals when indent weight is known; the
 * keypad shows ₹/MT so a unit target cannot be misread as a trip fare.
 *
 * Vehicle payload for the estimate follows Create Trip's VEHICLE_TYPES plus
 * the MT already written into Add Vehicle presets (e.g. "20 ft - 7 MT").
 */
import { positiveMoneyOrNull } from "@/lib/format";

export type PerMtExpectedSource = "indent_weight" | "vehicle_type" | "estimate";

export type PerMtExpectedTrip = {
  tonnes: number;
  amountInr: number;
  source: PerMtExpectedSource;
};

/** Reject 0 / negative / NaN so a missing weight never renders as "0T". */
export function positiveTonnes(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normalizeVehicleKey(vehicleType: string): string {
  return vehicleType
    .trim()
    .toUpperCase()
    .replace(/\bFOOT\b/g, "FT")
    .replace(/(\d)\s*FT/g, "$1 FT")
    .replace(/(\d)FT\b/g, "$1 FT")
    .replace(/\bSINGLE AXLE\b/g, "SXL")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Typical payload (MT) for Create Trip / Add Load body-length labels.
 * Numbers that already exist on Add Vehicle ("14 ft - 3.5 MT") win.
 * Estimate only — never stored as the bid.
 */
const BODY_PAYLOAD_T: Record<string, number> = {
  "8 FT": 1.5,
  "10 FT": 3.5,
  "14 FT": 3.5, // Canter / 709 14 ft - 3.5 MT
  "17 FT": 5, // Canter 17 ft - 5 MT
  "19 FT": 7, // 19 ft - 6 Wheeler - 7 MT
  "20 FT": 7, // 20 ft - 7 MT
  "20 FT OPEN": 7,
  "20 FT CONTAINER": 7,
  "21 FT": 7,
  "22 FT": 9,
  "22 FT OPEN": 9,
  "24 FT": 7, // 24 ft SXL Container unless labelled MXL
  "24 FT SXL": 7,
  "24 FT MXL": 16,
  "26 FT": 9,
  "28 FT SXL": 7,
  "28 FT MXL": 18,
  "30 FT": 18,
  "32 FT": 18, // bare 32ft in this catalog is mostly MXL / container
  "32 FT SXL": 7,
  "32 FT MXL": 18, // 32 FT MXL 18 MT
  "32 FT CONTAINER": 18,
  "40 FT": 25,
  "40 FT CONTAINER": 25,
  "TATA ACE": 0.75,
  "EICHER 14 FT": 3.5,
  "TAURUS 17 FT": 5,
  "CONTAINER 20 FT": 7,
  "CONTAINER 32 FT": 18,
  "MINI TRUCK": 1,
  "MINI TRUCK / LCV": 1,
  "PICKUP": 1,
  "TEMPO": 1.5,
};

function payloadFromBodyLength(vehicleType: string): number | null {
  const key = normalizeVehicleKey(vehicleType);
  if (BODY_PAYLOAD_T[key] != null) return BODY_PAYLOAD_T[key];

  if (/\bMXL\b/.test(key)) {
    if (key.includes("24 FT")) return BODY_PAYLOAD_T["24 FT MXL"];
    if (key.includes("28 FT")) return BODY_PAYLOAD_T["28 FT MXL"];
    if (key.includes("32 FT")) return BODY_PAYLOAD_T["32 FT MXL"];
  }
  if (/\bSXL\b/.test(key)) {
    if (key.includes("24 FT")) return BODY_PAYLOAD_T["24 FT SXL"];
    if (key.includes("28 FT")) return BODY_PAYLOAD_T["28 FT SXL"];
    if (key.includes("32 FT")) return BODY_PAYLOAD_T["32 FT SXL"];
  }
  if (key.includes("CONTAINER") && key.includes("20 FT")) {
    return BODY_PAYLOAD_T["CONTAINER 20 FT"];
  }
  if (key.includes("CONTAINER") && key.includes("32 FT")) {
    return BODY_PAYLOAD_T["32 FT CONTAINER"];
  }
  if (key.includes("CONTAINER") && key.includes("40 FT")) {
    return BODY_PAYLOAD_T["40 FT CONTAINER"];
  }

  const ft = key.match(/\b(\d+)\s*FT(?:\s+(SXL|MXL|OPEN|CONTAINER))?\b/);
  if (!ft) return null;
  const lookup = ft[2] ? `${ft[1]} FT ${ft[2]}` : `${ft[1]} FT`;
  return BODY_PAYLOAD_T[lookup] ?? null;
}

/**
 * Payload from labels like "16 MT" / "21MT" / "20 ft - 7 MT".
 */
export function parseTonnageFromVehicleType(
  vehicleType?: string | null,
): number | null {
  const raw = (vehicleType ?? "").trim();
  if (!raw) return null;
  const matches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*MT\b/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1]?.[1];
  return positiveTonnes(Number(last));
}

/** Vehicle payload for the expected-trip line: MT in the name, else body-length map. */
export function resolveVehiclePayloadTonnes(
  vehicleType?: string | null,
): number | null {
  const fromMt = parseTonnageFromVehicleType(vehicleType);
  if (fromMt != null) return fromMt;
  const raw = (vehicleType ?? "").trim();
  if (!raw) return null;
  return positiveTonnes(payloadFromBodyLength(raw));
}

export function formatTonnesLabel(tonnes: number): string {
  const n = Math.round(tonnes * 100) / 100;
  const text = Number.isInteger(n) ? String(n) : String(n);
  return `${text}T`;
}

export function formatWeightChip(
  weightTonnes: number | null | undefined,
): string | undefined {
  const tonnes = positiveTonnes(weightTonnes);
  return tonnes == null ? undefined : formatTonnesLabel(tonnes);
}

/**
 * Never offer 16T / 21T chips on a 10 FT load. Capacity comes from the
 * asked vehicle only.
 */
export function perMtEstimateChipTonnes(vehicleType?: string | null): number[] {
  void vehicleType;
  return [];
}

/**
 * Existing bids / counters are trip totals once weight is known. Convert
 * back to the ₹/MT the keypad should show.
 */
export function unitRateFromStoredBid(
  storedAmount: number,
  tonnes: number | null,
): number {
  if (!Number.isFinite(storedAmount) || storedAmount <= 0) return 0;
  const t = positiveTonnes(tonnes);
  if (t != null) return Math.round(storedAmount / t);
  return Math.round(storedAmount);
}

/** Inverse of unitRateFromStoredBid — what the award RPC / quote row stores. */
export function storedBidFromUnitRate(
  unitRate: number,
  tonnes: number | null,
): number {
  if (!Number.isFinite(unitRate) || unitRate <= 0) return 0;
  const t = positiveTonnes(tonnes);
  if (t != null) return Math.round(unitRate * t);
  return Math.round(unitRate);
}

/**
 * Expected trip value for the bidder. Indent weight is the only number used
 * to convert a stored bid. Vehicle payload is an estimate from the asked
 * vehicle — never a 21T chip on a 10 FT load.
 */
export function resolveExpectedTripValue(input: {
  unitRateInr: number | null | undefined;
  indentTonnes: number | null | undefined;
  vehicleType?: string | null;
  estimateTonnes?: number | null;
}): PerMtExpectedTrip | null {
  const rate = positiveMoneyOrNull(input.unitRateInr);
  if (rate == null) return null;

  const indent = positiveTonnes(input.indentTonnes);
  if (indent != null) {
    return {
      tonnes: indent,
      amountInr: Math.round(rate * indent),
      source: "indent_weight",
    };
  }

  const vehiclePayload = resolveVehiclePayloadTonnes(input.vehicleType);
  if (vehiclePayload != null) {
    return {
      tonnes: vehiclePayload,
      amountInr: Math.round(rate * vehiclePayload),
      source: "vehicle_type",
    };
  }

  const estimate = positiveTonnes(input.estimateTonnes);
  if (estimate != null) {
    return {
      tonnes: estimate,
      amountInr: Math.round(rate * estimate),
      source: "estimate",
    };
  }

  return null;
}
