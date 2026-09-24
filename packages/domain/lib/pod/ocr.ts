import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { BASE_OCR_PROMPT, buildUserPrompt } from '@pulse/core/lib/pod/prompts';
import type {
  PODExtraction,
  PODExtractionLegacy,
  PODHeader,
  PODTransport,
  PODParties,
  PODFinancials,
  PODInspection,
  DamageShortageRow,
  LineItem,
  ConfidenceField,
  MultiPODExtraction,
} from '@/types/pod';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const TIMEOUT_MS = 60_000;
const VALIDATION_MISMATCH_PERCENT = 1;

// We use the absolute fastest available model natively provided by Gemini
const MODELS = {
  default: 'gemini-2.5-flash',
  fallback: 'gemini-2.5-flash-lite',
};

export interface OCROutput {
  extraction: PODExtraction;
  model: string;
  processingTime: number;
}

let genAIClient: GoogleGenAI | null = null;
function getGenAIClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env.');
  }
  if (!genAIClient) genAIClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return genAIClient;
}

function timeoutPromise(ms: number) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), ms));
}

function parseExtractionJson(text: string) {
  let raw = text.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  try {
    return JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON from OCR: ${msg}`);
  }
}

function num(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') return parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;
  if (v != null && typeof v === 'object' && 'value' in v) return num((v as { value: unknown }).value);
  return 0;
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as { value: unknown }).value ?? '');
  return String(v);
}

function digitsOnly(podNumber: unknown): string {
  if (podNumber == null) return '';
  const s = String(str(podNumber)).trim();
  const digits = s.replace(/\D/g, '');
  return digits || '';
}

function unwrapScalar(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === 'object' && v !== null && 'value' in v) return (v as { value: unknown }).value;
  return v;
}

function cf(value: unknown, confidence: unknown, isNum = false): ConfidenceField<number | string> {
  return {
    value: isNum ? num(value) : (value == null ? '' : String(value)),
    confidence: Number(confidence) || 0.9,
  };
}

type CF = ConfidenceField<number | string>;

const HEADER_KEYS = ['date', 'lr_number', 'invoice_number', 'original_gir_no', 'gir_number', 'arrival_date_time', 'unload_start_date_time', 'unload_end_date_time', 'release_date_time', 'eway_bill_number', 'loading_in_time', 'loading_out_time', 'unloading_in_time', 'unloading_out_time'];
const TRANSPORT_KEYS: string[] = [];
const PARTIES_KEYS = ['consignor_name_address', 'consignee_name_address', 'gstin', 'pan', 'gst_paid_by'];
const FINANCIALS_KEYS = ['unloading_charges', 'loading_charges', 'shortage_amount', 'damage_amount', 'leakage_amount', 'total_amount', 'debit_reason_code', 'debit_type', 'loading_cost', 'unloading_cost', 'damage_cost', 'shortage_cost'];
const FINANCIALS_NUMERIC = new Set(['unloading_charges', 'loading_charges', 'shortage_amount', 'damage_amount', 'leakage_amount', 'total_amount', 'loading_cost', 'unloading_cost', 'damage_cost', 'shortage_cost']);

function section(obj: unknown, keys: string[], numericKeys: Set<string> = new Set()): Record<string, CF> {
  if (!obj || typeof obj !== 'object') return {};
  const record = obj as Record<string, unknown>;
  const out: Record<string, CF> = {};
  for (const k of keys) {
    if (record[k] == null) continue;
    const v = record[k];
    if (typeof v === 'object' && v !== null && 'value' in v) {
      const cfv = v as { value: unknown; confidence?: unknown };
      out[k] = cf(cfv.value, cfv.confidence, numericKeys.has(k));
    } else {
      out[k] = cf(v, 0.9, numericKeys.has(k));
    }
  }
  return out;
}

function ensureLrNumberFromPodNumber(header: Record<string, unknown>, rawHeader: unknown) {
  if (!header || !rawHeader || typeof rawHeader !== 'object') return;
  const lrVal = (header.lr_number as CF | undefined)?.value;
  const hasLr = lrVal != null && String(lrVal).trim() !== '';
  if (hasLr) return;
  const podVal = (rawHeader as Record<string, unknown>).pod_number;
  const podObj = podVal && typeof podVal === 'object' ? (podVal as { value?: unknown; confidence?: unknown }) : null;
  const v = podObj && 'value' in podObj ? podObj.value : podVal;
  if (v != null && String(v).trim() !== '') {
    header.lr_number = cf(v, podObj && podObj.confidence != null ? podObj.confidence : 0.9);
  }
}

/** Coerce an unknown parsed value into an indexable record (empty if not object-like). */
function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function normalizeExtraction(input: unknown): PODExtraction | PODExtractionLegacy {
  const obj = asRec(input);
  const hasNested = obj.header != null || obj.financials != null;
  if (hasNested) {
    const inspectionRaw = asRec(obj.inspection);
    const inspection: PODInspection = {
      damaged_cases: num(unwrapScalar(inspectionRaw.damaged_cases)),
      short_cases: num(unwrapScalar(inspectionRaw.short_cases)),
      excess_cases: num(unwrapScalar(inspectionRaw.excess_cases)),
      goods_inspection_report: (typeof inspectionRaw.goods_inspection_report === 'object' ? (inspectionRaw.goods_inspection_report as CF) : cf(inspectionRaw.goods_inspection_report, 0.9)) as ConfidenceField<string>,
      actual_vs_standard_time: (typeof inspectionRaw.actual_vs_standard_time === 'object' ? (inspectionRaw.actual_vs_standard_time as CF) : cf(inspectionRaw.actual_vs_standard_time, 0.9)) as ConfidenceField<string>,
      tolerance_hours: (typeof inspectionRaw.tolerance_hours === 'object' ? (inspectionRaw.tolerance_hours as ConfidenceField<number>) : cf(inspectionRaw.tolerance_hours, 0.9, true)) as ConfidenceField<number>,
      bpil_copy_data: (typeof inspectionRaw.bpil_copy_data === 'object' ? (inspectionRaw.bpil_copy_data as CF) : cf(inspectionRaw.bpil_copy_data, 0.9)) as ConfidenceField<string>,
      lscr_copy_data: (typeof inspectionRaw.lscr_copy_data === 'object' ? (inspectionRaw.lscr_copy_data as CF) : cf(inspectionRaw.lscr_copy_data, 0.9)) as ConfidenceField<string>,
    };
    if (Array.isArray(inspectionRaw.damage_shortage_rows) && inspectionRaw.damage_shortage_rows.length > 0) {
      inspection.damage_shortage_rows = inspectionRaw.damage_shortage_rows.map((rawRow: unknown): DamageShortageRow => {
        const row = asRec(rawRow);
        return {
          unit_type: str(unwrapScalar(row.unit_type)) || undefined,
          quantity: unwrapScalar(row.quantity) != null ? num(unwrapScalar(row.quantity)) : undefined,
          shortage_count: unwrapScalar(row.shortage_count) != null ? num(unwrapScalar(row.shortage_count)) : undefined,
          spillage_count: unwrapScalar(row.spillage_count) != null ? num(unwrapScalar(row.spillage_count)) : undefined,
          damage_count: unwrapScalar(row.damage_count) != null ? num(unwrapScalar(row.damage_count)) : undefined,
          damage_cost: unwrapScalar(row.damage_cost) != null ? num(unwrapScalar(row.damage_cost)) : undefined,
        };
      });
    }

    const line_items: LineItem[] = [];

    const extraction: PODExtraction = {
      header: section(obj.header, HEADER_KEYS) as PODHeader,
      transport: section(obj.transport, TRANSPORT_KEYS) as PODTransport,
      parties: section(obj.parties, PARTIES_KEYS) as PODParties,
      financials: section(obj.financials, FINANCIALS_KEYS, FINANCIALS_NUMERIC) as PODFinancials,
      inspection,
      line_items,
    };
    if (extraction.header) {
      ensureLrNumberFromPodNumber(extraction.header as Record<string, unknown>, obj.header);
      extraction.header.pod_number_canonical = digitsOnly(extraction.header.lr_number?.value);
    }

    const validationError = computeValidationError(extraction);
    if (validationError) extraction.validationError = validationError;
    return extraction;
  }

  const podDate = asRec(obj.pod_date);
  const lrNumber = asRec(obj.lr_number);
  const invoiceRef = asRec(obj.invoice_reference);
  const legacyHeader: PODHeader = {
    date: obj.pod_date ? (cf(podDate.value ?? obj.pod_date, podDate.confidence) as ConfidenceField<string>) : undefined,
    lr_number: obj.lr_number ? (cf(lrNumber.value ?? obj.lr_number, lrNumber.confidence) as ConfidenceField<string>) : undefined,
    invoice_number: obj.invoice_reference ? (cf(invoiceRef.value ?? obj.invoice_reference, invoiceRef.confidence) as ConfidenceField<string>) : undefined,
  };
  legacyHeader.pod_number_canonical = digitsOnly(legacyHeader.lr_number?.value);
  const unloadingCharges = asRec(obj.unloading_charges);
  const unloadingDebit = asRec(obj.unloading_debit);
  const totalAmount = asRec(obj.total_amount);
  const legacy: PODExtraction = {
    header: legacyHeader,
    transport: {},
    parties: {},
    financials: {
      unloading_charges: obj.unloading_charges ? (cf(unloadingCharges.value, unloadingCharges.confidence, true) as ConfidenceField<number>) : undefined,
      shortage_amount: obj.unloading_debit ? (cf(unloadingDebit.value, unloadingDebit.confidence, true) as ConfidenceField<number>) : undefined,
      total_amount: obj.total_amount ? (cf(totalAmount.value, totalAmount.confidence, true) as ConfidenceField<number>) : undefined,
    },
    inspection: { damaged_cases: 0, short_cases: 0, excess_cases: 0 },
    line_items: [],
  };
  const validationError = computeValidationError(legacy);
  if (validationError) legacy.validationError = validationError;
  return legacy;
}

function computeValidationError(extraction: { financials?: PODFinancials }) {
  const totalFromDoc = extraction.financials?.total_amount?.value != null ? num(extraction.financials.total_amount.value) : null;
  const unloading = num(extraction.financials?.unloading_charges?.value);
  const loading = num(extraction.financials?.loading_charges?.value);
  const shortage = num(extraction.financials?.shortage_amount?.value);
  const damage = num(extraction.financials?.damage_amount?.value);
  const expectedTotal = unloading + loading + shortage + damage;
  if (totalFromDoc == null || expectedTotal === 0) return null;
  const diff = Math.abs(totalFromDoc - expectedTotal);
  const pct = totalFromDoc !== 0 ? (diff / Math.abs(totalFromDoc)) * 100 : 0;
  if (pct > VALIDATION_MISMATCH_PERCENT) {
    return `Total mismatch: document total ${totalFromDoc} vs computed ${expectedTotal.toFixed(2)} (${pct.toFixed(1)}% diff). Verify amounts.`;
  }
  return null;
}

function normalizeGeminiError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key not valid|invalid.*api.*key|403/i.test(msg)) return 'Invalid or missing Gemini API key.';
  if (/quota|rate limit|429|resource exhausted/i.test(msg)) return 'OCR rate limit exceeded. Try again in a few minutes.';
  if (/timeout|deadline/i.test(msg)) return 'OCR request timed out. Try again or use a smaller file.';
  if (/blocked|safety|content/i.test(msg)) return 'Content was blocked by the OCR service.';
  return msg;
}

type NormalizedTrip = {
  transport: Record<string, CF>;
  parties: Record<string, CF>;
  arrival_date_time?: CF;
  release_date_time?: CF;
  unload_start_date_time?: CF;
  unload_end_date_time?: CF;
};

/** Read a { value, confidence } field off a raw record, returning a normalized CF if present. */
function dateField(rec: Record<string, unknown>, key: string): CF | undefined {
  const v = rec[key];
  if (v && typeof v === 'object' && 'value' in v) {
    const cfv = v as RawField;
    return cf(cfv.value, cfv.confidence);
  }
  return undefined;
}

type RawField = { value?: unknown; confidence?: unknown };

function normalizeTrip(trip: unknown): NormalizedTrip | null {
  if (!trip || typeof trip !== 'object') return null;
  const rec = trip as Record<string, unknown>;
  return {
    transport: section(rec.transport, TRANSPORT_KEYS),
    parties: section(rec.parties, PARTIES_KEYS),
    arrival_date_time: dateField(rec, 'arrival_date_time'),
    release_date_time: dateField(rec, 'release_date_time'),
    unload_start_date_time: dateField(rec, 'unload_start_date_time'),
    unload_end_date_time: dateField(rec, 'unload_end_date_time'),
  };
}

function mergeTripIntoPod(normalizedTrip: NormalizedTrip, podOnlyInput: unknown): PODExtraction {
  const podOnly = asRec(podOnlyInput);
  const header: Record<string, CF | string> = { ...section(podOnly.header, HEADER_KEYS) };
  if (normalizedTrip.arrival_date_time) header.arrival_date_time = normalizedTrip.arrival_date_time;
  if (normalizedTrip.release_date_time) header.release_date_time = normalizedTrip.release_date_time;
  if (normalizedTrip.unload_start_date_time) header.unload_start_date_time = normalizedTrip.unload_start_date_time;
  if (normalizedTrip.unload_end_date_time) header.unload_end_date_time = normalizedTrip.unload_end_date_time;

  const inspectionRaw = asRec(podOnly.inspection);
  const inspection: PODInspection = {
    damaged_cases: num(unwrapScalar(inspectionRaw.damaged_cases)),
    short_cases: num(unwrapScalar(inspectionRaw.short_cases)),
    excess_cases: num(unwrapScalar(inspectionRaw.excess_cases)),
  };
  if (Array.isArray(inspectionRaw.damage_shortage_rows) && inspectionRaw.damage_shortage_rows.length > 0) {
    inspection.damage_shortage_rows = inspectionRaw.damage_shortage_rows.map((rawRow: unknown): DamageShortageRow => {
      const row = asRec(rawRow);
      return {
        unit_type: str(unwrapScalar(row.unit_type)) || undefined,
        quantity: unwrapScalar(row.quantity) != null ? num(unwrapScalar(row.quantity)) : undefined,
        shortage_count: unwrapScalar(row.shortage_count) != null ? num(unwrapScalar(row.shortage_count)) : undefined,
        spillage_count: unwrapScalar(row.spillage_count) != null ? num(unwrapScalar(row.spillage_count)) : undefined,
        damage_count: unwrapScalar(row.damage_count) != null ? num(unwrapScalar(row.damage_count)) : undefined,
        damage_cost: unwrapScalar(row.damage_cost) != null ? num(unwrapScalar(row.damage_cost)) : undefined,
      };
    });
  }
  if (inspectionRaw.goods_inspection_report != null) inspection.goods_inspection_report = (typeof inspectionRaw.goods_inspection_report === 'object' ? (inspectionRaw.goods_inspection_report as CF) : cf(inspectionRaw.goods_inspection_report, 0.9)) as ConfidenceField<string>;
  if (inspectionRaw.actual_vs_standard_time != null) inspection.actual_vs_standard_time = (typeof inspectionRaw.actual_vs_standard_time === 'object' ? (inspectionRaw.actual_vs_standard_time as CF) : cf(inspectionRaw.actual_vs_standard_time, 0.9)) as ConfidenceField<string>;
  if (inspectionRaw.tolerance_hours != null) inspection.tolerance_hours = (typeof inspectionRaw.tolerance_hours === 'object' ? (inspectionRaw.tolerance_hours as ConfidenceField<number>) : cf(inspectionRaw.tolerance_hours, 0.9, true)) as ConfidenceField<number>;

  const line_items: LineItem[] = [];

  const full: PODExtraction = {
    header: header as PODHeader,
    transport: (normalizedTrip.transport || {}) as PODTransport,
    parties: (normalizedTrip.parties || {}) as PODParties,
    financials: section(podOnly.financials, FINANCIALS_KEYS, FINANCIALS_NUMERIC) as PODFinancials,
    inspection,
    line_items,
  };
  if (full.header) {
    ensureLrNumberFromPodNumber(full.header as Record<string, unknown>, podOnly.header);
    full.header.pod_number_canonical = digitsOnly(full.header.lr_number?.value);
  }
  const validationError = computeValidationError(full);
  if (validationError) full.validationError = validationError;
  return full;
}

function tripHash(extraction: PODExtraction | PODExtractionLegacy): string {
  const e = extraction as PODExtraction;
  const p = e.parties || {};
  const h = e.header || {};
  const parts = [
    str(h.arrival_date_time?.value),
    str(h.release_date_time?.value),
    str(p.consignor_name_address?.value),
    str(p.consignee_name_address?.value),
  ];
  return parts.join('|');
}

function consolidatePodsAndValidate(pods: (PODExtraction | PODExtractionLegacy)[], tripMismatch: boolean): MultiPODExtraction {
  const seen = new Set<string>();
  const consolidated: (PODExtraction | PODExtractionLegacy)[] = [];
  let duplicateCanonical = false;
  for (let i = 0; i < pods.length; i++) {
    const p = pods[i] as PODExtraction;
    const canonical = (p.header && p.header.pod_number_canonical) ? String(p.header.pod_number_canonical) : '';
    const key = canonical || `__page_${i}`;
    if (seen.has(key)) {
      if (canonical) duplicateCanonical = true;
      continue;
    }
    seen.add(key);
    consolidated.push(p);
  }
  const segmentationParts = [];
  if (duplicateCanonical) segmentationParts.push('Duplicate POD numbers detected (same canonical ID); verify segmentation.');
  if (consolidated.length >= 3) {
    segmentationParts.push('Multiple PODs on single trip; verify counts.');
  }
  return {
    pods: consolidated,
    consolidationWarning: tripMismatch ? 'Trip-level data differs across PODs; verify from/to and times.' : undefined,
    segmentationWarning: segmentationParts.length ? segmentationParts.join(' ') : undefined,
  };
}

function normalizeToPodsArray(parsed: unknown): MultiPODExtraction {
  const obj = asRec(parsed);
  if (obj.trip != null && Array.isArray(obj.pods) && obj.pods.length > 0) {
    const normalizedTrip = normalizeTrip(obj.trip);
    const pods = obj.pods
      .map((podOnly) => mergeTripIntoPod(normalizedTrip || { transport: {}, parties: {} }, podOnly))
      .filter((p): p is PODExtraction => p != null);
    if (pods.length === 0) throw new Error('OCR returned no valid PODs');
    const hashes = pods.map((p) => tripHash(p));
    const tripMismatch = hashes.some((h) => h !== hashes[0]);
    return consolidatePodsAndValidate(pods, tripMismatch);
  }
  if (Array.isArray(obj.pods) && obj.pods.length > 0) {
    const pods = obj.pods
      .map((p) => normalizeExtraction(p))
      .filter((p): p is PODExtraction | PODExtractionLegacy => p != null);
    const hashes = pods.map((p) => tripHash(p));
    const tripMismatch = pods.length > 1 && hashes.some((h) => h !== hashes[0]);
    return consolidatePodsAndValidate(pods, tripMismatch);
  }
  if (obj.header != null || obj.financials != null || obj.pod_date != null) {
    return { pods: [normalizeExtraction(parsed)] };
  }
  throw new Error('OCR returned no valid PODs');
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function performOCR(buffer: Uint8Array | ArrayBuffer, mimeType: string, modelName: string, fileName?: string) {
  const base64Data = arrayBufferToBase64(buffer);
  const fullPrompt = BASE_OCR_PROMPT + buildUserPrompt(fileName);
  
  const parts: Part[] = [
    { text: fullPrompt },
    { inlineData: { data: base64Data, mimeType } },
  ];
  const contents: Content[] = [{ role: 'user', parts }];

  const response = await getGenAIClient().models.generateContent({
    model: modelName,
    contents,
    config: {
      responseMimeType: 'application/json',
      // We reduced generation tokens required by asking to omit missing fields, this drastically speeds up output!
      temperature: 0.1, // Lower temperature = faster and more deterministic JSON parsing
      topK: 10,
    },
  });
  const text = response.text ?? '';
  if (!text) throw new Error('Empty response from OCR model');
  const parsed = parseExtractionJson(text);
  return normalizeToPodsArray(parsed);
}

type OCRRunResult = {
  extraction: MultiPODExtraction;
  model: string;
  processingTime: number;
};

async function runOCRWithRetrySingle(
  buffer: Uint8Array | ArrayBuffer,
  mimeType: string,
  fileName?: string,
): Promise<OCRRunResult> {
  const models = [MODELS.default, MODELS.fallback];
  let lastError: unknown;

  // We removed retry loops on identical models to fail-fast. If gemini-2.0-flash errors, it drops immediately to 1.5.
  for (const model of models) {
    try {
      const extraction = (await Promise.race([
        performOCR(buffer, mimeType, model, fileName),
        timeoutPromise(TIMEOUT_MS),
      ])) as MultiPODExtraction;
      return { extraction, model, processingTime: 0 };
    } catch (err) {
      console.log(`[OCR] error on ${model}`, err);
      lastError = err;
    }
  }
  const normalized = normalizeGeminiError(lastError);
  throw new Error(normalized);
}

export async function runOCR(
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<OCROutput> {
  const start = Date.now();
  if (onProgress) onProgress(10);

  const buffer = await file.arrayBuffer();
  const mimeType = file.type;

  if (onProgress) onProgress(20);
  if (onProgress) onProgress(50);
  const result = await runOCRWithRetrySingle(buffer, mimeType, fileName);
  if (onProgress) onProgress(100);

  const firstPod = result.extraction.pods?.[0];
  const extractionToReturn =
    firstPod != null ? firstPod : (result.extraction as unknown as PODExtraction);

  return {
    extraction: extractionToReturn as PODExtraction,
    model: result.model,
    processingTime: (Date.now() - start) / 1000,
  };
}
