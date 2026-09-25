import {
  formatVaultDocDate,
  type TripDocItem,
} from "../components/trip-detail/tripDocTypes";

export const EWAY_BILL_FIELDS_FILE_NAME = "eway-fields.json";

export type EwayFieldValues = {
  ewayNo: string;
  createdDate: string;
  validTill: string;
  docNo: string;
};

export type EwayBillStripRow = {
  id: string;
  entryIndex: number;
  ewayNo: string;
  createdDate: string;
  validTill: string;
  docNo: string;
  canView: boolean;
};

export const EMPTY_EWAY_FIELD_VALUES: EwayFieldValues = {
  ewayNo: "",
  createdDate: "",
  validTill: "",
  docNo: "",
};

const EMPTY_STRIP_ROW: EwayBillStripRow = {
  id: "eway-empty",
  entryIndex: 0,
  ewayNo: "—",
  createdDate: "—",
  validTill: "—",
  docNo: "—",
  canView: false,
};

export function ewayBillFieldsStoragePath(tripId: string): string {
  return `${tripId}/eway_bill/fields.json`;
}

export function isEwayBillMetaPath(
  storagePath?: string | null,
  fileName?: string | null,
): boolean {
  const path = (storagePath ?? "").toLowerCase().split("?")[0];
  const name = (fileName ?? "").toLowerCase();
  return (
    path.endsWith("/fields.json") ||
    path.endsWith("eway-fields.json") ||
    name === EWAY_BILL_FIELDS_FILE_NAME
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function recordToEwayFields(parsed: Record<string, unknown>): EwayFieldValues {
  return {
    ewayNo: String(parsed.ewayNo ?? parsed.n ?? "").trim(),
    createdDate: String(parsed.createdDate ?? parsed.created ?? "").trim(),
    validTill: String(parsed.validTill ?? parsed.v ?? "").trim(),
    docNo: String(parsed.docNo ?? parsed.d ?? "").trim(),
  };
}

export function ewayFieldHasContent(values: EwayFieldValues): boolean {
  return !!(
    values.ewayNo.trim() ||
    values.createdDate.trim() ||
    values.validTill.trim() ||
    values.docNo.trim()
  );
}

export function parseEwayFieldEntries(raw?: string | null): EwayFieldValues[] {
  if (!raw?.trim()) return [];
  const text = raw.trim();

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => recordToEwayFields(asRecord(item) ?? {}))
          .filter(ewayFieldHasContent);
      }
    } catch {
      return [{ ...EMPTY_EWAY_FIELD_VALUES, ewayNo: text }];
    }
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const record = asRecord(parsed);
      if (parsed && record) {
        const listed = Array.isArray(record.entries)
          ? record.entries
              .map((item) => recordToEwayFields(asRecord(item) ?? {}))
              .filter(ewayFieldHasContent)
          : [];
        if (listed.length > 0) return listed;
        const single = recordToEwayFields(record);
        return ewayFieldHasContent(single) ? [single] : [];
      }
    } catch {
      return [{ ...EMPTY_EWAY_FIELD_VALUES, ewayNo: text }];
    }
  }

  return [{ ...EMPTY_EWAY_FIELD_VALUES, ewayNo: text }];
}

export function parseEwayFieldValues(raw?: string | null): EwayFieldValues {
  return parseEwayFieldEntries(raw)[0] ?? { ...EMPTY_EWAY_FIELD_VALUES };
}

function serializeOne(values: EwayFieldValues): EwayFieldValues {
  return {
    ewayNo: values.ewayNo.trim(),
    createdDate: values.createdDate.trim(),
    validTill: values.validTill.trim(),
    docNo: values.docNo.trim(),
  };
}

export function serializeEwayFieldEntries(entries: EwayFieldValues[]): string {
  const cleaned = entries.map(serializeOne).filter(ewayFieldHasContent);
  const first = cleaned[0] ?? { ...EMPTY_EWAY_FIELD_VALUES };
  return JSON.stringify({
    ewayNo: first.ewayNo,
    createdDate: first.createdDate,
    validTill: first.validTill,
    docNo: first.docNo,
    entries: cleaned,
  });
}

export function serializeEwayFieldValues(values: EwayFieldValues): string {
  return serializeEwayFieldEntries([values]);
}

function dash(value?: string | null): string {
  const text = value?.trim();
  return text ? text : "—";
}

export function ewayDocHasPreviewableFile(doc?: TripDocItem | null): boolean {
  if (!doc) return false;
  const paths = [
    doc.storagePath,
    ...(doc.files ?? []).map((file) => file.storagePath),
  ].filter((path): path is string => !!path?.trim());
  return paths.some((path) => !isEwayBillMetaPath(path));
}

function displayDate(value?: string | null): string {
  return dash(formatVaultDocDate(value) || value);
}

export function buildEwayBillStripRows(params: {
  ewayDoc?: TripDocItem | null;
}): EwayBillStripRow[] {
  const entries = parseEwayFieldEntries(params.ewayDoc?.documentNumber);
  const ewayDoc = params.ewayDoc;
  const files = (ewayDoc?.files ?? []).filter(
    (file) =>
      !!file.storagePath?.trim() && !isEwayBillMetaPath(file.storagePath),
  );
  const slotPreviewable =
    ewayDocHasPreviewableFile(ewayDoc) &&
    !!ewayDoc?.storagePath &&
    !isEwayBillMetaPath(ewayDoc.storagePath);
  const baseId = ewayDoc?.documentId ?? ewayDoc?.id ?? "eway";

  const toRow = (
    fields: EwayFieldValues,
    index: number,
    id: string,
    canView: boolean,
  ): EwayBillStripRow => ({
    id,
    entryIndex: index,
    ewayNo: dash(fields.ewayNo),
    createdDate: displayDate(fields.createdDate),
    validTill: displayDate(fields.validTill),
    docNo: dash(fields.docNo),
    canView,
  });

  if (entries.length > 0) {
    return entries.map((fields, index) =>
      toRow(
        fields,
        index,
        files[index]?.id ?? `${baseId}-entry-${index}`,
        !!files[index] || slotPreviewable,
      ),
    );
  }

  if (files.length === 0) {
    return [
      {
        ...EMPTY_STRIP_ROW,
        id: ewayDoc ? `${baseId}-entry-0` : EMPTY_STRIP_ROW.id,
      },
    ];
  }

  return files.map((file, index) => {
    const fromLabel = file.label.includes("·")
      ? parseEwayFieldValues(file.label.split("·").pop()?.trim()).ewayNo
      : "";
    return toRow(
      { ...EMPTY_EWAY_FIELD_VALUES, ewayNo: fromLabel },
      index,
      file.id,
      true,
    );
  });
}
