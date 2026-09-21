import {
  buildComplianceDocumentActivity,
  composeComplianceActorDetail,
  displayComplianceActorDetail,
  displayComplianceActorName,
  formatComplianceActivityTime,
} from "@/features/tripCompliance/utils/complianceDocumentActivity.util";
import type { ComplianceDocRow } from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import type { ComplianceDocumentRow } from "@/features/tripCompliance/tripCompliance.types";

function row(overrides: Partial<ComplianceDocumentRow> = {}): ComplianceDocRow {
  return {
    key: "lr",
    type: "lr",
    required: true,
    status: overrides.status ?? "pending",
    doc: {
      id: "doc-1",
      trip_id: "t1",
      document_type: "lr",
      file_name: "lr.jpg",
      storage_path: "path",
      uploaded_at: "2026-09-15T09:11:00.000Z",
      uploaded_by: "user-upload",
      status: overrides.status ?? "pending",
      verified_by: null,
      verified_at: null,
      rejection_reason: null,
      ...overrides,
    },
    entityDoc: null,
  };
}

describe("buildComplianceDocumentActivity", () => {
  it("logs who uploaded and when", () => {
    expect(buildComplianceDocumentActivity(row())).toEqual([
      {
        kind: "uploaded",
        label: "Uploaded by",
        actorId: "user-upload",
        at: "2026-09-15T09:11:00.000Z",
      },
    ]);
  });

  it("adds verified actor and time after approval", () => {
    const entries = buildComplianceDocumentActivity(
      row({
        status: "verified",
        verified_by: "user-ops",
        verified_at: "2026-09-15T10:02:00.000Z",
      }),
    );
    expect(entries.map((e) => e.kind)).toEqual(["uploaded", "verified"]);
    expect(entries[1]).toMatchObject({
      label: "Verified by",
      actorId: "user-ops",
      at: "2026-09-15T10:02:00.000Z",
    });
  });

  it("adds declined note without dropping the upload event", () => {
    const entries = buildComplianceDocumentActivity(
      row({
        status: "rejected",
        verified_by: "user-ops",
        verified_at: "2026-09-15T10:05:00.000Z",
        rejection_reason: "Unreadable photo",
      }),
    );
    expect(entries[1]).toMatchObject({
      kind: "declined",
      label: "Declined by",
      note: "Unreadable photo",
    });
  });
});

describe("displayComplianceActorName", () => {
  it("uses the resolved profile name instead of a raw id", () => {
    expect(displayComplianceActorName("user-upload", { "user-upload": "Priya Sharma" })).toBe("Priya Sharma");
    expect(displayComplianceActorName("missing", {})).toBe("Unknown");
    expect(displayComplianceActorName(null, {})).toBe("Unknown");
  });
});

describe("composeComplianceActorDetail", () => {
  it("prefers member name and shows role plus contact", () => {
    expect(
      composeComplianceActorDetail({
        fullName: "Aji O",
        phone: "9999999999",
        email: "aji@pulse.app",
        role: "member",
      }),
    ).toEqual({
      name: "Aji O",
      meta: "Member · 9999999999",
    });
  });

  it("falls back to phone or email when name is missing", () => {
    expect(composeComplianceActorDetail({ fullName: "  ", email: "ops@pulse.app", role: "dispatcher" })).toEqual({
      name: "ops@pulse.app",
      meta: "Dispatcher",
    });
  });
});

describe("displayComplianceActorDetail", () => {
  it("returns unknown when the member was not resolved", () => {
    expect(displayComplianceActorDetail("u1", {})).toEqual({ name: "Unknown", meta: null });
  });
});

describe("formatComplianceActivityTime", () => {
  it("returns a readable timestamp", () => {
    expect(formatComplianceActivityTime("not-a-date")).toBe("Time not recorded");
    expect(formatComplianceActivityTime(null)).toBe("Time not recorded");
    expect(formatComplianceActivityTime("2026-09-15T09:11:00.000Z")).toMatch(/2026/);
  });
});
