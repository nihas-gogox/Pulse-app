/**
 * Phase 2 (Compliance / Document State) fix: replacing a trip_documents row
 * (uploadTripDocument with options.replaceExistingOfType) used to silently
 * overwrite the row in place — clearing verified_by/verified_at/status and
 * permanently deleting the old storage file — with no audit trail at all.
 * This preserves history via a `document_audit_log` 'replaced' row (same
 * entity_type/entity_id convention `verify_trip_document` already uses) and
 * stops deleting the superseded file.
 */
const mockStorageUpload = jest.fn(async () => ({ error: null }));
const mockStorageRemove = jest.fn(async () => ({ error: null }));
const mockAuditInsert = jest.fn(async () => ({ error: null }));

const EXISTING_DOC = {
  id: "doc-1",
  file_name: "invoice-old.pdf",
  storage_path: "trip-1/invoice/old.pdf",
  document_number: "INV-OLD",
  uploaded_at: "2026-09-01T00:00:00.000Z",
  uploaded_by: "user-original",
  status: "verified",
  verified_by: "user-verifier",
  verified_at: "2026-09-02T00:00:00.000Z",
  rejection_reason: null,
};

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: (table: string) => {
      if (table === "trip_documents") {
        const builder: Record<string, unknown> = {};
        const chain = () => builder;
        builder.select = chain;
        builder.eq = chain;
        builder.order = chain;
        builder.limit = () => Promise.resolve({ data: [EXISTING_DOC], error: null });
        builder.update = () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: EXISTING_DOC.id,
                    trip_id: "trip-1",
                    file_name: "invoice-new.pdf",
                    storage_path: "trip-1/invoice/new.pdf",
                    mime_type: "application/pdf",
                    size_bytes: 100,
                    uploaded_at: "2026-09-20T00:00:00.000Z",
                    uploaded_by: "user-replacer",
                    document_type: "invoice",
                    document_number: "INV-NEW",
                  },
                  error: null,
                }),
            }),
          }),
        });
        return builder;
      }
      if (table === "trips") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { organization_id: "org-1" }, error: null }) }),
          }),
        };
      }
      if (table === "document_audit_log") return { insert: mockAuditInsert };
      throw new Error(`unexpected table ${table}`);
    },
    storage: {
      from: () => ({ upload: mockStorageUpload, remove: mockStorageRemove }),
    },
  }),
}));

jest.mock("@/lib/platform/events/InProcessEventBus", () => ({
  getPlatformEventBus: () => ({ publish: jest.fn() }),
}));
jest.mock("@/features/trips/services/tripWorkflow.service", () => ({
  recordTripWorkflowEvent: jest.fn(),
}));
jest.mock("@/features/ocr/services/ocrJob.service", () => ({ listOcrJobsForTripDocuments: jest.fn() }));

import { uploadTripDocument } from "@/features/trips/services/tripDocuments.service";

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("uploadTripDocument — replace preserves audit history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageUpload.mockResolvedValue({ error: null } as never);
    mockAuditInsert.mockResolvedValue({ error: null } as never);
  });

  it("writes a document_audit_log 'replaced' row snapshotting the superseded document", async () => {
    const { doc, error } = await uploadTripDocument(
      "trip-1",
      "user-replacer",
      { arrayBuffer: new ArrayBuffer(8), fileName: "invoice-new.pdf", mimeType: "application/pdf" },
      "invoice",
      "INV-NEW",
      { replaceExistingOfType: true },
    );
    expect(error).toBeNull();
    expect(doc).not.toBeNull();

    await flushMicrotasks();

    expect(mockAuditInsert).toHaveBeenCalledTimes(1);
    const inserted = mockAuditInsert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      document_id: null,
      organization_id: "org-1",
      entity_type: "trip_document",
      entity_id: "doc-1",
      action: "replaced",
      actor_id: "user-replacer",
      old_status: "verified",
      new_status: "pending",
    });
    expect(inserted.metadata).toMatchObject({
      old_storage_path: EXISTING_DOC.storage_path,
      old_file_name: EXISTING_DOC.file_name,
      old_verified_by: EXISTING_DOC.verified_by,
      old_verified_at: EXISTING_DOC.verified_at,
      new_file_name: "invoice-new.pdf",
    });
    expect(inserted.metadata.new_storage_path).toMatch(/^trip-1\/invoice\//);
    expect(inserted.metadata.new_storage_path).not.toBe(EXISTING_DOC.storage_path);
  });

  it("no longer deletes the superseded file from storage", async () => {
    await uploadTripDocument(
      "trip-1",
      "user-replacer",
      { arrayBuffer: new ArrayBuffer(8), fileName: "invoice-new.pdf", mimeType: "application/pdf" },
      "invoice",
      "INV-NEW",
      { replaceExistingOfType: true },
    );
    await flushMicrotasks();
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it("does not block the replace when the audit write fails (best-effort)", async () => {
    mockAuditInsert.mockResolvedValue({ error: { message: "boom" } } as never);
    const { doc, error } = await uploadTripDocument(
      "trip-1",
      "user-replacer",
      { arrayBuffer: new ArrayBuffer(8), fileName: "invoice-new.pdf", mimeType: "application/pdf" },
      "invoice",
      "INV-NEW",
      { replaceExistingOfType: true },
    );
    await flushMicrotasks();
    expect(error).toBeNull();
    expect(doc).not.toBeNull();
  });
});
