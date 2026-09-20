import type { DocumentRow } from "@/features/compliance/services/documents.service";
import type { ComplianceDocumentRow } from "@/features/tripCompliance/tripCompliance.types";
import { buildComplianceChecklist, checklistTone, ensureComplianceChecklist } from "@/features/tripCompliance/utils/complianceChecklist.util";

function tripDoc(type: string, status: ComplianceDocumentRow["status"] = "verified"): ComplianceDocumentRow {
  return {
    id: type,
    trip_id: "t1",
    document_type: type,
    file_name: `${type}.pdf`,
    storage_path: type,
    uploaded_at: "2026-09-01",
    status,
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
  };
}

function entityDoc(overrides: Partial<DocumentRow> & Pick<DocumentRow, "doc_type" | "entity_id" | "entity_type">): DocumentRow {
  return {
    id: overrides.id ?? overrides.doc_type,
    organization_id: "org",
    entity_type: overrides.entity_type,
    entity_id: overrides.entity_id,
    doc_type: overrides.doc_type,
    doc_label: null,
    doc_number: null,
    issued_date: null,
    expiry_date: overrides.expiry_date ?? "2027-01-01",
    issued_by: null,
    status: overrides.status ?? "active",
    storage_path: "path",
    notes: null,
    verified_by: null,
    verified_at: null,
    created_by: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

describe("buildComplianceChecklist", () => {
  it("uses trip LR/e-way/invoice, six vehicle docs, and license + Aadhaar", () => {
    const checklist = buildComplianceChecklist({
      tripDocuments: [],
      vehicleDocuments: [],
      driverDocuments: [],
    });
    expect(checklist.groups[0].slots.map((s) => s.type)).toEqual(["lr", "eway_bill", "invoice"]);
    expect(checklist.groups[1].slots.map((s) => s.type)).toEqual([
      "rc",
      "insurance",
      "fitness",
      "permit",
      "pollution",
      "road_tax",
    ]);
    expect(checklist.groups[2].slots.map((s) => s.type)).toEqual(["license", "aadhaar"]);
    expect(checklist.total).toBe(11);
    expect(checklist.verified).toBe(0);
    expect(checklist.tone).toBe("danger");
  });

  it("counts verified trip docs and active vehicle/driver docs into groups", () => {
    const checklist = buildComplianceChecklist({
      tripDocuments: [
        tripDoc("lr"),
        tripDoc("invoice"),
        tripDoc("eway_bill", "pending"),
        tripDoc("pod"),
      ],
      vehicleDocuments: [
        entityDoc({ entity_type: "vehicle", entity_id: "v1", doc_type: "rc", status: "verified" }),
        entityDoc({ entity_type: "vehicle", entity_id: "v1", doc_type: "insurance", status: "active" }),
        entityDoc({ entity_type: "vehicle", entity_id: "v1", doc_type: "fitness", status: "active" }),
      ],
      driverDocuments: [
        entityDoc({ entity_type: "driver", entity_id: "d1", doc_type: "license", status: "verified" }),
      ],
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(checklist.groups[0]).toMatchObject({ verified: 3, total: 3, tone: "success" });
    expect(checklist.groups[1]).toMatchObject({ verified: 3, total: 6, tone: "warning" });
    expect(checklist.groups[2]).toMatchObject({ verified: 1, total: 2, tone: "warning" });
    expect(checklist.verified).toBe(7);
    expect(checklist.tone).toBe("warning");
  });

  it("does not count expired entity documents as verified", () => {
    const checklist = buildComplianceChecklist({
      tripDocuments: [],
      vehicleDocuments: [
        entityDoc({ entity_type: "vehicle", entity_id: "v1", doc_type: "rc", status: "active", expiry_date: "2025-01-01" }),
      ],
      driverDocuments: [],
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(checklist.groups[1].verified).toBe(0);
  });

  it("is success only when every required slot is verified", () => {
    const tripDocuments = ["lr", "eway_bill", "invoice"].map((type) => tripDoc(type));
    const vehicleDocuments = ["rc", "insurance", "fitness", "permit", "pollution", "road_tax"].map((doc_type) =>
      entityDoc({ entity_type: "vehicle", entity_id: "v1", doc_type, status: "verified" }),
    );
    const driverDocuments = ["license", "aadhaar"].map((doc_type) =>
      entityDoc({ entity_type: "driver", entity_id: "d1", doc_type, status: "verified" }),
    );
    const checklist = buildComplianceChecklist({ tripDocuments, vehicleDocuments, driverDocuments });
    expect(checklist.verified).toBe(11);
    expect(checklist.tone).toBe("success");
    expect(checklist.groups.every((group) => group.tone === "success")).toBe(true);
  });
});

describe("checklistTone", () => {
  it("maps none / some / all", () => {
    expect(checklistTone(0, 5)).toBe("danger");
    expect(checklistTone(3, 5)).toBe("warning");
    expect(checklistTone(5, 5)).toBe("success");
  });
});

describe("ensureComplianceChecklist", () => {
  it("rebuilds from trip documents when persisted cache has no checklist", () => {
    const checklist = ensureComplianceChecklist({
      documents: [tripDoc("lr"), tripDoc("invoice")],
    });
    expect(checklist.tone).toBe("warning");
    expect(checklist.groups[0].verified).toBe(2);
    expect(checklist.total).toBe(11);
  });

  it("rebuilds the old 15-slot mock checklist into the current types", () => {
    const stale = buildComplianceChecklist({ tripDocuments: [], vehicleDocuments: [], driverDocuments: [] });
    stale.groups[0].slots.push({ type: "insurance", verified: false }, { type: "rc", verified: false });
    const checklist = ensureComplianceChecklist({ checklist: stale, documents: [tripDoc("lr")] });
    expect(checklist.groups[0].slots.map((s) => s.type)).toEqual(["lr", "eway_bill", "invoice"]);
    expect(checklist.groups[0].verified).toBe(1);
  });

  it("rebuilds vehicle and driver slots from entity documents", () => {
    const checklist = ensureComplianceChecklist({
      documents: [tripDoc("lr")],
      vehicleDocuments: [entityDoc({ doc_type: "rc", entity_id: "v1", entity_type: "vehicle", status: "verified" })],
      driverDocuments: [entityDoc({ doc_type: "license", entity_id: "d1", entity_type: "driver", status: "active" })],
    });
    expect(checklist.groups[0].verified).toBe(1);
    expect(checklist.groups[1].verified).toBe(1);
    expect(checklist.groups[2].verified).toBe(1);
  });

  it("returns the current slot counts when summary is empty", () => {
    const checklist = ensureComplianceChecklist(undefined);
    expect(checklist.tone).toBe("danger");
    expect(checklist.groups).toHaveLength(3);
    expect(checklist.total).toBe(11);
  });
});
