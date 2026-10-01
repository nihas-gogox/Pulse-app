import {
  acceptVaultFileConfirmation,
  vaultUploadOutcome,
} from "@/features/trips/utils/vaultUploadSession.util";

describe("vault upload confirmation", () => {
  it("closes the dialog immediately and marks the card uploading", () => {
    const next = acceptVaultFileConfirmation({
      inFlight: false,
      slotId: "pod",
    });
    expect(next).toEqual({
      accepted: true,
      closeDialog: true,
      uploadingSlotId: "pod",
      refreshDocuments: false,
    });
  });

  it("prevents a second accept while an upload is in flight", () => {
    expect(
      acceptVaultFileConfirmation({ inFlight: true, slotId: "pod" }),
    ).toEqual({ accepted: false });
  });

  it("records one saved document and does not refresh the document list", () => {
    expect(
      vaultUploadOutcome({
        ok: true,
        documentId: "doc-1",
        slotId: "pod",
      }),
    ).toEqual({
      refreshDocuments: false,
      saved: true,
      uploading: false,
      error: null,
      documentId: "doc-1",
    });
  });

  it("surfaces the failure reason and does not mark the document saved", () => {
    expect(
      vaultUploadOutcome({
        ok: false,
        message: "Storage quota exceeded",
        slotId: "manifest",
      }),
    ).toEqual({
      refreshDocuments: false,
      saved: false,
      uploading: false,
      error: { slotId: "manifest", message: "Storage quota exceeded" },
      documentId: null,
    });
  });
});
