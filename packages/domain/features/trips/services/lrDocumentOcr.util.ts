import type { OcrJobRow } from "@/features/ocr/types/ocr.types";

export type LrOcrFields = {
  lrNumber: string | null;
  lrDate: string | null;
};

function confidenceValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "object" && "value" in value) {
    return confidenceValue((value as { value: unknown }).value);
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function headerFromOcrPayload(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;

  const extraction = asRecord(root.extraction) ?? root;
  const nestedExtraction = asRecord(extraction.extraction) ?? extraction;
  const directHeader = asRecord(nestedExtraction.header);
  if (directHeader) return directHeader;

  const pods = nestedExtraction.pods;
  if (Array.isArray(pods) && pods.length > 0) {
    return asRecord(asRecord(pods[0])?.header);
  }
  return null;
}

export function parseLrFieldsFromOcrResult(
  resultJson: Record<string, unknown> | null | undefined,
): LrOcrFields {
  const header = headerFromOcrPayload(resultJson);
  return {
    lrNumber: confidenceValue(header?.lr_number),
    lrDate: confidenceValue(header?.date),
  };
}

export function parseLrFieldsFromOcrJob(job: Pick<OcrJobRow, "result_json"> | null): LrOcrFields {
  return parseLrFieldsFromOcrResult(job?.result_json ?? null);
}

/** Typed LR number always wins over a later OCR guess. */
export function preferredLrDocumentNumber(
  manual: string | null | undefined,
  ocr: string | null | undefined,
): string | null {
  const typed = parseLrFieldValues(manual).lrNumber || null;
  if (typed) return typed;
  const scanned = ocr?.trim() || null;
  return scanned;
}

export type LrFieldValues = {
  lrNumber: string;
  date: string;
  invoice: string;
};

const EMPTY_LR_FIELDS: LrFieldValues = {
  lrNumber: "",
  date: "",
  invoice: "",
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads a stored LR `document_number` — plain text or `{ lrNumber, date, invoice }`. */
export function parseLrFieldValues(raw?: string | null): LrFieldValues {
  const text = (raw ?? "").trim();
  if (!text) return { ...EMPTY_LR_FIELDS };
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return {
          lrNumber: asTrimmedString(
            parsed.lrNumber ?? parsed.n ?? parsed.number,
          ),
          date: asTrimmedString(parsed.date ?? parsed.d),
          invoice: asTrimmedString(
            parsed.invoice ?? parsed.invoiceNumber ?? parsed.i,
          ),
        };
      }
    } catch {
      return { ...EMPTY_LR_FIELDS, lrNumber: text };
    }
  }
  return { ...EMPTY_LR_FIELDS, lrNumber: text };
}

export function serializeLrFieldValues(values: LrFieldValues): string {
  const lrNumber = values.lrNumber.trim();
  const date = values.date.trim();
  const invoice = values.invoice.trim();
  if (!date && !invoice) return lrNumber;
  return JSON.stringify({ lrNumber, date, invoice });
}

export const LR_FIELDS_FILE_NAME = "lr-fields.json";

export function lrFieldsStoragePath(tripId: string): string {
  return `${tripId}/lr/fields.json`;
}

export function isLrFieldsMetaPath(
  storagePath?: string | null,
  fileName?: string | null,
): boolean {
  const path = (storagePath ?? "").toLowerCase().split("?")[0];
  const name = (fileName ?? "").toLowerCase();
  return (
    path.endsWith("/lr/fields.json") ||
    path.endsWith("lr-fields.json") ||
    name === LR_FIELDS_FILE_NAME
  );
}
