jest.mock("jspdf", () => {
  const lines: string[] = [];
  return {
    jsPDF: class {
      setProperties() {}
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      setFillColor() {}
      setDrawColor() {}
      setLineWidth() {}
      rect() {}
      line() {}
      splitTextToSize(value: string) {
        return [String(value)];
      }
      text(line: string | string[]) {
        if (Array.isArray(line)) lines.push(...line);
        else lines.push(line);
      }
      output() {
        const body = `%PDF-1.3\n${lines.join("\n")}`;
        lines.length = 0;
        return Uint8Array.from(Buffer.from(body)).buffer;
      }
    },
  };
});

import { buildElrPreviewEmbedHtml, buildElrPreviewHtml, generateElrPdfBytes } from "@/features/trips/services/elrPdf.util";
import {
  alignElrDraftToTripRoute,
  applyElrCanonicalPrefill,
  buildCompletedElrSnapshot,
  draftFromTripSource,
  elrDetailPhase,
  elrFormCanOpen,
  elrPrefilledFields,
  elrTripLockedFields,
  elrTripStatusCopy,
  isCompleteElrSnapshot,
  lockElrTripFields,
  mergeStoredElrIntoDraft,
  validateElrCompletion,
  type ElrCompletionDraft,
} from "@/features/trips/services/elrCompletion.util";
import {
  buildElrSnapshot,
  elrDocumentLines,
  elrVehicleChangedSinceSnapshot,
  isElrEligible,
  readStoredElrSnapshot,
  serializeElrDocumentNumber,
  type ElrTripSource,
} from "@/features/trips/services/elrSnapshot.util";

const source: ElrTripSource = {
  tripId: "trip-1",
  tripNumber: "TRP051",
  organizationId: "org-a",
  viewerOrganizationId: "org-a",
  transporterName: "Pulse Haul",
  clientName: "ABC Steels",
  vehicleId: "veh-a",
  vehicleRegistration: "TN 01 AB 1234",
  origin: "Chennai",
  destination: "Bengaluru",
  pickupDate: "2026-09-29",
  loadType: "Coils",
  loadTons: 12,
  generatedAt: "2026-09-29T08:00:00.000Z",
};

function completeDraft(): ElrCompletionDraft {
  return {
    ...draftFromTripSource(source),
    consignorAddress: "12 Industrial Estate",
    consignorCity: "Chennai",
    consignorState: "Tamil Nadu",
    consignorPin: "600001",
    consignorGst: "registered",
    consignorGstin: "33AABCU9603R1ZM",
    consigneeName: "South Mills",
    consigneeAddress: "44 Delivery Road",
    consigneeCity: "Bengaluru",
    consigneeState: "Karnataka",
    consigneePin: "560001",
    consigneeGst: "unregistered",
    consigneeGstin: "",
    transporterAddress: "8 Carrier Lane",
    transporterCity: "Chennai",
    transporterState: "Tamil Nadu",
    transporterPin: "600032",
    transporterGst: "registered",
    transporterGstin: "33AABCU9603R1ZM",
    vehicleType: "Container",
    quantity: "10",
    quantityUnit: "Bundles",
    sourceDocumentType: "tax_invoice",
    sourceDocumentNumber: "INV-19",
    sourceDocumentDate: "2026-09-28",
    goodsValue: "250000",
  };
}

function labels(draft: ElrCompletionDraft): string[] {
  return validateElrCompletion(draft).map((issue) => issue.label);
}

describe("E-LR completion", () => {
  it("does not start until a vehicle is assigned", () => {
    expect(isElrEligible({ vehicleId: null, driverId: "drv-1" })).toBe(false);
    expect(elrDetailPhase({ eligible: false, hasExisting: false, missingCount: 3 })).toBe(
      "not_eligible",
    );
  });

  it("opens completion once a vehicle is assigned, even when LR fields are missing", () => {
    expect(isElrEligible({ vehicleId: "veh-a", driverId: null })).toBe(true);
    expect(
      isElrEligible({ vehicleId: null, vehicleRegistration: "8400164" }),
    ).toBe(true);
    const bare = draftFromTripSource({
      ...source,
      clientName: "",
      transporterName: "",
      origin: "",
      destination: "",
      loadType: null,
      loadTons: null,
    });
    expect(bare.consignorAddress).toBe("");
    expect(bare.consigneeName).toBe("");
    expect(bare.vehicleType).toBe("");
    expect(bare.quantity).toBe("");
    expect(bare.goodsValue).toBe("");
    expect(bare.sourceDocumentType).toBe("");
    expect(labels(bare).length).toBeGreaterThan(0);
    expect(elrFormCanOpen({ eligible: true, hasFinal: false })).toBe(true);
    expect(
      elrDetailPhase({ eligible: true, hasExisting: false, missingCount: labels(bare).length }),
    ).toBe("start");
    expect(elrTripStatusCopy("start").action).toBe("Generate E-LR");
  });

  it("blocks generation while required receipt fields are missing", () => {
    const draft = completeDraft();
    expect(labels({ ...draft, consigneeName: "" })).toContain("Consignee name");
    expect(labels({ ...draft, consigneeAddress: "" })).toContain("Consignee address");
    expect(labels({ ...draft, consigneePin: "12" })).toContain("Consignee PIN");
    expect(labels({ ...draft, transporterAddress: "" })).toContain("Transporter address");
    expect(labels({ ...draft, vehicleType: "" })).toContain("Vehicle type");
    expect(labels({ ...draft, cargoDescription: "" })).toContain("Goods description");
    expect(labels({ ...draft, quantity: "" })).toContain("Quantity");
    expect(labels({ ...draft, weight: "" })).toContain("Weight");
    expect(labels({ ...draft, sourceDocumentType: "" })).toContain("Source document");
    expect(labels({ ...draft, consignorGst: "registered", consignorGstin: "" })).toContain(
      "Consignor GSTIN",
    );
    expect(labels({ ...draft, consigneeGst: "unregistered", consigneeGstin: "" })).not.toContain(
      "Consignee GSTIN",
    );
  });

  it("prefills canonical fields and leaves the consignee manual", () => {
    const fromTrip = draftFromTripSource(source);
    expect(fromTrip.consignorName).toBe("ABC Steels");
    expect(fromTrip.cargoDescription).toBe("Coils");
    expect(fromTrip.weight).toBe("12");
    expect(fromTrip.consigneeName).toBe("");
    expect(fromTrip.vehicleType).toBe("");
    const filled = applyElrCanonicalPrefill(fromTrip, {
      consignorAddress: "12 Industrial Estate",
      consignorState: "Tamil Nadu",
      consigneeName: "Bengaluru",
      vehicleType: "Container",
      orderReference: "SO-9",
    });
    expect(filled.consignorAddress).toBe("12 Industrial Estate");
    expect(filled.consigneeName).toBe("");
    expect(filled.consigneeCity).toBe("Bengaluru");
    expect(filled.vehicleType).toBe("Container");
    expect(filled.orderReference).toBe("SO-9");
    const edited = lockElrTripFields(
      { ...filled, origin: "Mumbai", destination: "Pune", cargoDescription: "Changed" },
      source,
    );
    expect(edited.origin).toBe("Chennai");
    expect(edited.destination).toBe("Bengaluru");
    expect(edited.cargoDescription).toBe("Coils");
    expect(edited.consignorAddress).toBe("12 Industrial Estate");
    expect(elrTripLockedFields(source)).toContain("origin");
    expect(elrTripLockedFields(source)).not.toContain("consigneeName");
  });

  it("stores the completed values on an immutable snapshot and prints them", () => {
    const built = buildCompletedElrSnapshot({
      source,
      draft: completeDraft(),
      generatedBy: "user-1",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.consignee?.name).toBe("South Mills");
    expect(built.snapshot.consignee?.name).not.toBe(source.destination);
    expect(built.snapshot.vehicle).toEqual({
      id: "veh-a",
      registrationNumber: "TN 01 AB 1234",
      type: "Container",
    });
    expect(built.snapshot.cargo?.quantity).toBe(10);
    expect(built.snapshot.commercial?.sourceDocument?.number).toBe("INV-19");
    expect(built.snapshot.generatedBy).toBe("user-1");
    const lines = elrDocumentLines(built.snapshot).join("\n");
    expect(lines).toContain("South Mills");
    expect(lines).toContain("Container");
    expect(lines).toContain("INV-19");
    const stored = readStoredElrSnapshot(serializeElrDocumentNumber(built.snapshot));
    expect(stored).toEqual(built.snapshot);
    expect(elrVehicleChangedSinceSnapshot(built.snapshot, "veh-b")).toBe(true);
    expect(stored?.vehicle.id).toBe("veh-a");
    const pdf = Buffer.from(generateElrPdfBytes(built.snapshot)).toString("latin1");
    expect(pdf).toContain("South Mills");
    expect(pdf).toContain("ELR-TRP051");
    const html = buildElrPreviewHtml(built.snapshot);
    const embed = buildElrPreviewEmbedHtml(built.snapshot);
    expect(html).toContain("GSTIN");
    expect(html).toContain("33AABCU9603R1ZM");
    expect(html).toContain(">GST<");
    expect(html).toContain("Unregistered");
    expect(html).toContain("class=\"cols\"");
    expect(html).toContain("class=\"band");
    expect(embed).toContain("elr-sheet");
    expect(embed).not.toContain("<!DOCTYPE");
    expect(
      elrDetailPhase({ eligible: true, hasExisting: true, missingCount: 0 }),
    ).toBe("view");
    expect(elrTripStatusCopy("view", "ELR-TRP051").hint).toBe("E-LR: ELR-TRP051");
    expect(elrTripStatusCopy("view", "ELR-TRP051").action).toBe("View E-LR");
    expect(elrTripStatusCopy("before_loading").hint).toBe(
      "E-LR available after loading",
    );
    expect(elrTripStatusCopy("not_eligible").hint).toBe(
      "E-LR available after vehicle assignment",
    );
    expect(
      elrDetailPhase({
        eligible: true,
        hasExisting: false,
        missingCount: 3,
        afterLoading: false,
      }),
    ).toBe("before_loading");
    expect(
      elrDetailPhase({
        eligible: true,
        hasExisting: true,
        missingCount: 0,
        afterLoading: false,
      }),
    ).toBe("view");
    expect(elrTripStatusCopy("ready_to_complete").hint).toBe("E-LR details required");
    expect(elrTripStatusCopy("ready_to_generate").hint).toBe("E-LR ready to preview");
    expect(
      elrDetailPhase({
        eligible: true,
        hasExisting: false,
        missingCount: 7,
        hasDraft: true,
      }),
    ).toBe("ready_to_complete");
    expect(
      elrDetailPhase({
        eligible: true,
        hasExisting: false,
        missingCount: 0,
        hasDraft: true,
      }),
    ).toBe("ready_to_generate");
  });

  it("keeps optional checks off until those fields are entered", () => {
    const draft = completeDraft();
    expect(labels(draft)).not.toContain("HSN code");
    expect(labels(draft)).not.toContain("E-way bill number");
    expect(labels(draft)).not.toContain("Freight");
    expect(labels({ ...draft, hsn: "12" })).toContain("HSN code");
    expect(labels({ ...draft, hsn: "8471" })).not.toContain("HSN code");
    expect(labels({ ...draft, ewayBillNumber: "123" })).toContain("E-way bill number");
    expect(labels({ ...draft, freight: "0" })).toContain("Freight");
    expect(labels({ ...draft, sourceDocumentDate: "28/09/2026" })).not.toContain(
      "Source document date",
    );
    const built = buildCompletedElrSnapshot({
      source,
      draft: { ...draft, sourceDocumentDate: "28/09/2026", consigneeName: "Harbour Stores" },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.commercial?.sourceDocument?.date).toBe("2026-09-28");
    expect(built.snapshot.consignee?.name).toBe("Harbour Stores");
    expect(elrDocumentLines(built.snapshot).join("\n")).toContain("Harbour Stores");
  });

  it("marks only known canonical fields as prefilled", () => {
    const fields = elrPrefilledFields(source, {
      consignorAddress: "12 Industrial Estate",
      vehicleType: "Container",
    });
    expect(fields).toContain("consignorName");
    expect(fields).toContain("consignorAddress");
    expect(fields).toContain("vehicleType");
    expect(fields).not.toContain("consigneeName");
  });

  it("treats an older receipt as unfinished so the missing fields can be entered", () => {
    const older = buildElrSnapshot(source);
    expect(older.ok).toBe(true);
    if (!older.ok) return;
    expect(isCompleteElrSnapshot(older.snapshot)).toBe(false);
    const merged = mergeStoredElrIntoDraft(draftFromTripSource(source), older.snapshot);
    expect(merged.consigneeName).toBe("");
    expect(merged.origin).toBe("Chennai");
    expect(merged.cargoDescription).toBe("Coils");
    const finished = buildCompletedElrSnapshot({ source, draft: completeDraft() });
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(isCompleteElrSnapshot(finished.snapshot)).toBe(true);
  });

  it("follows the trip-card route for movement and for both parties", () => {
    const routed = alignElrDraftToTripRoute(
      {
        ...draftFromTripSource(source),
        origin: "Chennai",
        destination: "Bengaluru",
        consignorCity: "Chennai",
        consignorState: "Tamil Nadu",
        consigneeName: "Muthu kumar",
        consigneeCity: "Mumbai",
        consigneeState: "Maharashtra",
      },
      {
        ...source,
        origin: "Mumbai, Maharashtra",
        destination: "Hyderabad, Telangana",
      },
    );
    expect(routed.origin).toBe("Mumbai, Maharashtra");
    expect(routed.destination).toBe("Hyderabad, Telangana");
    expect(routed.consignorCity).toBe("Mumbai");
    expect(routed.consignorState).toBe("Maharashtra");
    expect(routed.consigneeCity).toBe("Hyderabad");
    expect(routed.consigneeState).toBe("Telangana");
    expect(routed.consigneeName).toBe("Muthu kumar");
    const built = buildCompletedElrSnapshot({
      source: { ...source, origin: "Mumbai, Maharashtra", destination: "Hyderabad, Telangana" },
      draft: { ...completeDraft(), consigneeCity: "Mumbai", consignorCity: "Chennai" },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.route.origin).toBe("Mumbai, Maharashtra");
    expect(built.snapshot.consignor.city).toBe("Mumbai");
    expect(built.snapshot.consignee?.city).toBe("Hyderabad");
    expect(built.snapshot.consignee?.name).toBe("South Mills");
  });

  it("lets a later generation carry edits without changing the earlier snapshot", () => {
    const first = buildCompletedElrSnapshot({ source, draft: completeDraft() });
    const second = buildCompletedElrSnapshot({
      source,
      draft: { ...completeDraft(), consigneeName: "Edited Co", goodsValue: "10" },
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.snapshot.consignee?.name).toBe("South Mills");
    expect(second.snapshot.consignee?.name).toBe("Edited Co");
    expect(first.snapshot.commercial?.goodsValue).toBe(250000);
    expect(validateElrCompletion(completeDraft())).toHaveLength(0);
    const partial = { ...completeDraft(), quantity: "" };
    expect(validateElrCompletion(partial).length).toBeGreaterThan(0);
    expect(validateElrCompletion({ ...partial, quantity: "4" }).map((issue) => issue.field)).not.toContain(
      "quantity",
    );
  });
});
