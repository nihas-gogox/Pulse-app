import type { ComplianceDocRow } from "@/features/tripCompliance/utils/complianceDocumentRows.util";

export type ComplianceDocumentActivityKind = "uploaded" | "verified" | "declined";

export type ComplianceDocumentActivityEntry = {
  kind: ComplianceDocumentActivityKind;
  label: string;
  actorId: string | null;
  at: string | null;
  note?: string | null;
};

export function buildComplianceDocumentActivity(row: ComplianceDocRow): ComplianceDocumentActivityEntry[] {
  const entries: ComplianceDocumentActivityEntry[] = [];
  const uploadedAt = row.doc?.uploaded_at ?? row.entityDoc?.created_at ?? null;
  const uploadedBy = row.doc?.uploaded_by ?? row.entityDoc?.created_by ?? null;
  if (uploadedAt || uploadedBy) {
    entries.push({
      kind: "uploaded",
      label: "Uploaded by",
      actorId: uploadedBy ?? null,
      at: uploadedAt,
    });
  }

  if (row.status === "verified") {
    const at = row.doc?.verified_at ?? row.entityDoc?.verified_at ?? null;
    const actorId = row.doc?.verified_by ?? row.entityDoc?.verified_by ?? null;
    if (at || actorId) {
      entries.push({ kind: "verified", label: "Verified by", actorId, at });
    }
  }

  if (row.status === "rejected") {
    const at = row.doc?.verified_at ?? row.entityDoc?.verified_at ?? null;
    const actorId = row.doc?.verified_by ?? row.entityDoc?.verified_by ?? null;
    entries.push({
      kind: "declined",
      label: "Declined by",
      actorId,
      at,
      note: row.doc?.rejection_reason ?? row.entityDoc?.notes ?? null,
    });
  }

  return entries;
}

export function formatComplianceActivityTime(iso: string | null | undefined): string {
  if (!iso) return "Time not recorded";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Time not recorded";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function displayComplianceActorName(
  actorId: string | null | undefined,
  names: Record<string, string>,
): string {
  if (!actorId) return "Unknown";
  const name = names[actorId]?.trim();
  return name || "Unknown";
}

export type ComplianceActorDetail = {
  name: string;
  meta: string | null;
};

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  dispatcher: "Dispatcher",
  finance: "Finance",
  driver: "Driver",
};

export function formatComplianceMemberRole(role: string | null | undefined): string | null {
  const key = (role ?? "").trim().toLowerCase();
  if (!key) return null;
  return MEMBER_ROLE_LABEL[key] ?? role!.replace(/_/g, " ");
}

export function composeComplianceActorDetail(input: {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
}): ComplianceActorDetail {
  const fullName = input.fullName?.trim() || "";
  const phone = input.phone?.trim() || "";
  const email = input.email?.trim() || "";
  const name = fullName || phone || email || "Unknown";
  const role = formatComplianceMemberRole(input.role);
  const contact = name === phone ? email : name === email ? phone : phone || email;
  const meta = [role, contact].filter(Boolean).join(" · ") || null;
  return { name, meta };
}

export function displayComplianceActorDetail(
  actorId: string | null | undefined,
  details: Record<string, ComplianceActorDetail>,
): ComplianceActorDetail {
  if (!actorId) return { name: "Unknown", meta: null };
  return details[actorId] ?? { name: "Unknown", meta: null };
}

