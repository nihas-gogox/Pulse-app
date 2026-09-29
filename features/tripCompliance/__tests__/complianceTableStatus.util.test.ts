/**
 * Dinesh sir's Compliance table — pure derivations (CONTRACT.md §2.A–C,
 * AC-2..AC-7, AC-10, AC-12, AC-19, AC-22, AC-28).
 */
import type { ComplianceDocumentRow, ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import type { ComplianceDocRow } from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import {
  canVerifyTrip,
  deriveComplianceEwayBill,
  deriveComplianceGroupStatus,
  isComplianceDeclineActive,
} from "@/features/tripCompliance/utils/complianceTableStatus.util";

// Local-date noon so "today"/"yesterday" are unambiguous in any TZ.
const NOW = new Date(2026, 8, 4, 12, 0, 0); // 04-Sep-26

function doc(over: Partial<ComplianceDocumentRow> & Pick<ComplianceDocumentRow, "document_type">): ComplianceDocumentRow {
  return {
    id: `d-${Math.random().toString(36).slice(2)}`,
    trip_id: "t1",
    file_name: "file.pdf",
    storage_path: "org/t1/file.pdf",
    uploaded_at: "2026-09-01T00:00:00Z",
    status: "pending",
    verified_by: null,
    verified_at: null,
    rejection_reason: null,
    document_number: null,
    ...over,
  };
}

function eway(documentNumber: string | null, over: Partial<ComplianceDocumentRow> = {}): ComplianceDocumentRow {
  return doc({ document_type: "eway_bill", storage_path: "t1/eway_bill/fields.json", document_number: documentNumber, ...over });
}

describe("deriveComplianceEwayBill — pick (AC-2, AC-5)", () => {
  it("shows ewayNo + DD-Mon-YY validTill from the editor's JSON", () => {
    const r = deriveComplianceEwayBill(
      [eway(JSON.stringify({ ewayNo: "1234 5678 9012", createdDate: "01-Sep-26", validTill: "04-Sep-26", docNo: "" }))],
      NOW,
    );
    expect(r.number).toBe("1234 5678 9012");
    expect(r.validTillLabel).toBe("04-Sep-26");
    expect(r.validTillIso).toBe("2026-09-04");
    expect(r.extraCount).toBe(0);
  });

  it("skips non-eway rows and eway rows that don't parse, picking the first parseable eway row", () => {
    const r = deriveComplianceEwayBill(
      [
        doc({ document_type: "lr", document_number: "LR-1" }),
        eway(null),
        eway("   "),
        eway(JSON.stringify({ ewayNo: "FIRST", validTill: "10-Sep-26" })),
        eway(JSON.stringify({ ewayNo: "SECOND", validTill: "11-Sep-26" })),
      ],
      NOW,
    );
    expect(r.number).toBe("FIRST");
  });

  it("newest parseable eway row wins regardless of array order (mirrors Trip Detail)", () => {
    const older = eway(JSON.stringify({ ewayNo: "OLD" }), { uploaded_at: "2026-01-01T00:00:00Z" });
    const newer = eway(JSON.stringify({ ewayNo: "NEW" }), { uploaded_at: "2026-09-01T00:00:00Z" });
    expect(deriveComplianceEwayBill([older, newer], NOW).number).toBe("NEW");
    expect(deriveComplianceEwayBill([newer, older], NOW).number).toBe("NEW");
  });

  it("sub-second precision: …05:30:00.5+00:00 beats …05:30:00+00:00", () => {
    const whole = eway(JSON.stringify({ ewayNo: "WHOLE" }), { uploaded_at: "2026-09-01T05:30:00+00:00" });
    const half = eway(JSON.stringify({ ewayNo: "HALF" }), { uploaded_at: "2026-09-01T05:30:00.5+00:00" });
    expect(deriveComplianceEwayBill([whole, half], NOW).number).toBe("HALF");
    expect(deriveComplianceEwayBill([half, whole], NOW).number).toBe("HALF");
  });

  it("null uploaded_at sorts first (Postgres desc = nulls first)", () => {
    const dated = eway(JSON.stringify({ ewayNo: "DATED" }), { uploaded_at: "2027-01-01T00:00:00Z" });
    const undated = eway(JSON.stringify({ ewayNo: "UNDATED" }), { uploaded_at: null as unknown as string });
    expect(deriveComplianceEwayBill([dated, undated], NOW).number).toBe("UNDATED");
  });

  it("unparseable uploaded_at is treated like null (sorts first)", () => {
    const dated = eway(JSON.stringify({ ewayNo: "DATED" }), { uploaded_at: "2027-01-01T00:00:00Z" });
    const junk = eway(JSON.stringify({ ewayNo: "JUNK" }), { uploaded_at: "not-a-date" });
    expect(deriveComplianceEwayBill([dated, junk], NOW).number).toBe("JUNK");
  });

  it("falls back to an older parseable row when the newest doesn't parse", () => {
    const older = eway(JSON.stringify({ ewayNo: "OLD" }), { uploaded_at: "2026-01-01T00:00:00Z" });
    const newestEmpty = eway(JSON.stringify({ ewayNo: "", validTill: "" }), { uploaded_at: "2026-09-01T00:00:00Z" });
    expect(deriveComplianceEwayBill([newestEmpty, older], NOW).number).toBe("OLD");
    expect(deriveComplianceEwayBill([older, newestEmpty], NOW).number).toBe("OLD");
  });

  it("treats a legacy plain-string document_number as the E-way number", () => {
    const r = deriveComplianceEwayBill([eway("EWB-LEGACY-99")], NOW);
    expect(r.number).toBe("EWB-LEGACY-99");
    expect(r.validTillLabel).toBeNull();
    expect(r.expired).toBe(false);
  });

  it("entries array: first entry shown, extraCount = remaining (3 entries → +2)", () => {
    const r = deriveComplianceEwayBill(
      [
        eway(
          JSON.stringify({
            entries: [
              { ewayNo: "E1", validTill: "10-Sep-26" },
              { ewayNo: "E2", validTill: "11-Sep-26" },
              { ewayNo: "E3", validTill: "12-Sep-26" },
            ],
          }),
        ),
      ],
      NOW,
    );
    expect(r.number).toBe("E1");
    expect(r.validTillLabel).toBe("10-Sep-26");
    expect(r.extraCount).toBe(2);
  });
});

describe("deriveComplianceEwayBill — validTill formats (AC-3, AC-6)", () => {
  it("ISO date is parsed and labelled DD-Mon-YY", () => {
    const r = deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "2026-09-10" }))], NOW);
    expect(r.validTillIso).toBe("2026-09-10");
    expect(r.validTillLabel).toBe("10-Sep-26");
  });

  it("DD-MM-YYYY is parsed", () => {
    const r = deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "10-09-2026" }))], NOW);
    expect(r.validTillIso).toBe("2026-09-10");
    expect(r.validTillLabel).toBe("10-Sep-26");
  });

  it("garbage is shown raw, never expired, no fabricated date", () => {
    const r = deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "next tuesday" }))], NOW);
    expect(r.validTillIso).toBeNull();
    expect(r.validTillLabel).toBe("next tuesday");
    expect(r.expired).toBe(false);
  });

  it("impossible calendar date (31-Feb-26) is shown raw and not expired", () => {
    const r = deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "31-Feb-26" }))], NOW);
    expect(r.validTillIso).toBeNull();
    expect(r.validTillLabel).toBe("31-Feb-26");
    expect(r.expired).toBe(false);
  });

  it("only number → validTillLabel null; only date → number null", () => {
    const onlyNo = deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E" }))], NOW);
    expect(onlyNo.number).toBe("E");
    expect(onlyNo.validTillLabel).toBeNull();
    const onlyDate = deriveComplianceEwayBill([eway(JSON.stringify({ validTill: "10-Sep-26" }))], NOW);
    expect(onlyDate.number).toBeNull();
    expect(onlyDate.validTillLabel).toBe("10-Sep-26");
  });
});

describe("deriveComplianceEwayBill — expiry boundary (AC-7)", () => {
  it("today is not expired", () => {
    expect(deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "04-Sep-26" }))], NOW).expired).toBe(false);
  });

  it("today is not expired even at 23:59 local", () => {
    const lateNow = new Date(2026, 8, 4, 23, 59, 0);
    expect(deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "04-Sep-26" }))], lateNow).expired).toBe(false);
  });

  it("yesterday is expired", () => {
    expect(deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "03-Sep-26" }))], NOW).expired).toBe(true);
  });

  it("tomorrow is not expired", () => {
    expect(deriveComplianceEwayBill([eway(JSON.stringify({ ewayNo: "E", validTill: "05-Sep-26" }))], NOW).expired).toBe(false);
  });
});

describe("deriveComplianceEwayBill — empty (AC-4)", () => {
  it.each([
    ["no documents", [] as ComplianceDocumentRow[]],
    ["no eway rows", [doc({ document_type: "lr" })]],
    ["eway row with empty JSON", [eway(JSON.stringify({ ewayNo: "", validTill: "" }))]],
    ["eway row with null document_number", [eway(null)]],
  ])("%s → all null, not expired", (_label, docs) => {
    expect(deriveComplianceEwayBill(docs, NOW)).toEqual({
      number: null,
      validTillRaw: null,
      validTillIso: null,
      validTillLabel: null,
      expired: false,
      extraCount: 0,
    });
  });
});

function row(type: string, status: ComplianceDocRow["status"], required = true): ComplianceDocRow {
  return { key: type, type, required, status, doc: null, entityDoc: null };
}

describe("deriveComplianceGroupStatus (AC-10, AC-12)", () => {
  it("approved when every required row is verified", () => {
    expect(deriveComplianceGroupStatus([row("rc", "verified"), row("insurance", "verified"), row("fitness", "verified")])).toEqual({
      status: "approved",
      approved: 3,
      total: 3,
    });
  });

  it.each(["missing", "pending", "rejected", "expired"] as const)("one %s required row → pending", (status) => {
    const g = deriveComplianceGroupStatus([row("rc", "verified"), row("insurance", status), row("fitness", "verified")]);
    expect(g.status).toBe("pending");
    expect(g.approved).toBe(2);
    expect(g.total).toBe(3);
  });

  it("optional rows never affect the status", () => {
    const g = deriveComplianceGroupStatus([row("license", "verified"), row("aadhaar", "missing", false)]);
    expect(g).toEqual({ status: "approved", approved: 1, total: 1 });
  });

  it("zero rows (no vehicle / driver assigned) → pending, not approved", () => {
    expect(deriveComplianceGroupStatus([])).toEqual({ status: "pending", approved: 0, total: 0 });
  });

  it("only optional rows → pending (total 0)", () => {
    expect(deriveComplianceGroupStatus([row("permit", "verified", false)]).status).toBe("pending");
  });
});

function summary(over: Partial<ComplianceTripSummary>): ComplianceTripSummary {
  return {
    trip: { id: "t1" },
    documents: [],
    vehicleDocuments: [],
    driverDocuments: [],
    complianceVerifiedAt: null,
    complianceDeclinedAt: null,
    complianceDeclinedBy: null,
    complianceDeclineReason: null,
    ...over,
  } as unknown as ComplianceTripSummary;
}

const VERIFIED_TRIP_DOCS = [
  doc({ document_type: "lr", status: "verified" }),
  doc({ document_type: "eway_bill", status: "verified" }),
  doc({ document_type: "invoice", status: "verified" }),
];

describe("canVerifyTrip (AC-19, AC-22) [D2]", () => {
  it("allowed when LR, E-way Bill and Invoice are verified", () => {
    expect(canVerifyTrip(summary({ documents: VERIFIED_TRIP_DOCS }))).toEqual({ allowed: true, reason: null });
  });

  it("vehicle/driver docs pending or missing do NOT block (D2)", () => {
    const s = summary({
      documents: VERIFIED_TRIP_DOCS,
      vehicleDocuments: [],
      driverDocuments: [],
    });
    expect(canVerifyTrip(s).allowed).toBe(true);
  });

  it("names every non-verified required trip doc in the reason", () => {
    const r = canVerifyTrip(
      summary({ documents: [doc({ document_type: "lr", status: "verified" }), doc({ document_type: "invoice", status: "rejected" })] }),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("Approve E-way Bill and Invoice first");
  });

  it("three missing → comma + and list", () => {
    expect(canVerifyTrip(summary({ documents: [] })).reason).toBe("Approve LR, E-way Bill and Invoice first");
  });

  it("single missing → no joiner", () => {
    const r = canVerifyTrip(
      summary({ documents: [doc({ document_type: "lr", status: "verified" }), doc({ document_type: "eway_bill", status: "verified" })] }),
    );
    expect(r.reason).toBe("Approve Invoice first");
  });

  it("already verified → not allowed with reason", () => {
    expect(canVerifyTrip(summary({ documents: VERIFIED_TRIP_DOCS, complianceVerifiedAt: "2026-09-01T00:00:00Z" }))).toEqual({
      allowed: false,
      reason: "Trip compliance already verified",
    });
  });
});

describe("isComplianceDeclineActive (AC-26, AC-28)", () => {
  it("false when never declined", () => {
    expect(isComplianceDeclineActive(summary({}))).toBe(false);
  });
  it("true when declined and not verified", () => {
    expect(isComplianceDeclineActive(summary({ complianceDeclinedAt: "2026-09-02T00:00:00Z", complianceDeclineReason: "bad LR" }))).toBe(true);
  });
  it("false once verified after a decline (decline kept as history)", () => {
    expect(
      isComplianceDeclineActive(
        summary({ complianceDeclinedAt: "2026-09-02T00:00:00Z", complianceVerifiedAt: "2026-09-03T00:00:00Z" }),
      ),
    ).toBe(false);
  });
});
