import { generateGeminiVisionJson } from "@pulse/core/lib/gemini/geminiVisionJson.util";

import { compressOperationsPhotoToBase64 } from "../operations/uploads/photoUploads";

const TIMEOUT_MS = 18_000;
const OCR_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"] as const;

export type OdometerOcrField = {
  value: number;
  confidence: number;
};

export type OdometerPhotoOcrResult = {
  odometerKm: OdometerOcrField | null;
  summary: string | null;
  model: string;
  processingTimeSec: number;
};

const SYSTEM_PROMPT = `You are an OCR engine for vehicle dashboard odometer / trip meter photos.

Extract ONLY the main total odometer reading in kilometers (KM) visible on the instrument cluster.

Output one valid JSON object only. No markdown, no code fences.

Fields:
- odometer_km: { "value": <number>, "confidence": <0.0-1.0> } — total KM reading (integer or decimal). REQUIRED when digits are visible.
- summary: one short sentence describing what was read

Rules:
- Read the primary TOTAL / ODO / KM odometer digits, not trip sub-meters unless that is the only reading.
- Strip leading zeros but preserve the full reading (e.g. 128456 not 128).
- Ignore speed, RPM, fuel gauge, and clock.
- If partially obscured, return best-effort digits with lower confidence.`;

const READING_KEYS = [
  "odometer_km",
  "odometer",
  "km_reading",
  "reading_km",
  "total_km",
  "mileage_km",
  "odometer_reading",
  "reading",
] as const;

function parseJson(text: string): Record<string, unknown> {
  let raw = text.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  return JSON.parse(raw) as Record<string, unknown>;
}

function parseOdometerValue(value: unknown): number | null {
  if (value == null) return null;

  const raw =
    typeof value === "object" && value !== null && "value" in value
      ? (value as { value: unknown }).value
      : value;

  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;

  if (typeof raw !== "string") return null;

  const cleaned = raw.trim().replace(/[^\d.]/g, "");
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function confidenceOf(value: unknown, fallback = 0.72): number {
  if (value != null && typeof value === "object" && "confidence" in value) {
    const c = Number((value as { confidence: unknown }).confidence);
    return Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : fallback;
  }
  return fallback;
}

function extractOdometerKm(parsed: Record<string, unknown>): OdometerOcrField | null {
  for (const key of READING_KEYS) {
    const raw = parsed[key];
    if (raw == null) continue;
    const value = parseOdometerValue(raw);
    if (value == null) continue;
    return { value, confidence: confidenceOf(raw) };
  }
  return null;
}

function extractOdometerKmFromSummary(summary: string | null | undefined): OdometerOcrField | null {
  if (!summary?.trim()) return null;
  const match = summary.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:km|kms|kilometers?)?/i);
  if (!match?.[1]) return null;
  const value = parseOdometerValue(match[1]);
  if (value == null) return null;
  return { value, confidence: 0.38 };
}

export async function extractOdometerPhotoOcr(localUri: string): Promise<OdometerPhotoOcrResult> {
  const started = Date.now();
  const { base64, mimeType } = await compressOperationsPhotoToBase64(localUri);

  const { text, model } = await generateGeminiVisionJson({
    prompt: SYSTEM_PROMPT,
    base64,
    mimeType,
    models: OCR_MODELS,
    timeoutMs: TIMEOUT_MS,
  });

  const parsed = parseJson(text);
  const summary =
    typeof parsed.summary === "string" ? parsed.summary.trim() : null;
  let odometerKm = extractOdometerKm(parsed);
  if (!odometerKm) {
    odometerKm = extractOdometerKmFromSummary(summary);
  }

  return {
    odometerKm,
    summary,
    model,
    processingTimeSec: (Date.now() - started) / 1000,
  };
}

export function formatOdometerKmForEntry(km: number): string {
  if (!Number.isFinite(km)) return "";
  return Number.isInteger(km) ? String(km) : String(Math.round(km * 10) / 10);
}
