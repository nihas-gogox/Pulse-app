/**
 * Documents Center — central Compliance & Document Intelligence hub.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  ComplianceDashboard  (6 top metric cards)                       │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  [All] [Expiring Soon] [Expired] [Pending] [Missing] [Renewal]   │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  Section-specific list (TanStack-Query backed, paginated)        │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Sections (`DocumentCenterSection`):
 *   • `all`                  → `useOrgComplianceDocumentsQuery({ })`
 *   • `expiring`             → `useExpiringDocumentsQuery(orgId, 30)`
 *   • `expired`              → `useOrgComplianceDocumentsQuery({ status: 'expired' })`
 *   • `pending_verification` → `useOrgComplianceDocumentsQuery({ status: 'pending' })`
 *   • `missing`              → metadata-only rows (storage_path IS NULL)
 *   • `renewal_queue`        → expiring within 7 days (subset of `expiring`)
 *
 * Tapping a doc row opens a future per-document detail sheet (out of
 * scope for Phase 2 — wire `onDocumentPress` to your detail screen
 * once `DocumentCard` lands in Phase 3).
 */

import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  FileText,
  Inbox,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Theme from "@/constants/Theme";
import Layout from "@/constants/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  useExpiringDocumentsQuery,
  useOrgComplianceDocumentsQuery,
} from "@/lib/queries/useDocumentsQuery";
import type {
  ComplianceDocument,
  DocumentCenterSection,
  DocumentRow,
} from "@/features/compliance/types/compliance.types";
import {
  enrichDocuments,
  formatExpiryNarrative,
  getExpiryToneColors,
} from "@/features/compliance/utils/expiry.util";

import { ComplianceDashboard } from "./ComplianceDashboard";

interface SectionDef {
  id: DocumentCenterSection;
  labelKey: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const SECTIONS: SectionDef[] = [
  { id: "all",                  labelKey: "complianceSectionAll",      Icon: FileText },
  { id: "expiring",             labelKey: "complianceSectionExpiring", Icon: Clock },
  { id: "expired",              labelKey: "complianceSectionExpired",  Icon: XCircle },
  { id: "pending_verification", labelKey: "complianceSectionPending",  Icon: ShieldCheck },
  { id: "missing",              labelKey: "complianceSectionMissing",  Icon: AlertTriangle },
  { id: "renewal_queue",        labelKey: "complianceSectionRenewal",  Icon: RefreshCcw },
];

export interface DocumentCenterProps {
  /** When omitted, defaults to the current organization from context. */
  orgId?: string | null;
}

export function DocumentCenter({ orgId: orgIdProp }: DocumentCenterProps) {
  const { t } = useLanguage();
  const { currentOrganization } = useOrganization();
  const router = useRouter();
  const orgId = orgIdProp ?? currentOrganization?.id ?? null;

  const [section, setSection] = useState<DocumentCenterSection>("all");

  // Section data sources — only the active one is enabled to avoid
  // hammering the network on first paint.
  const allQ = useOrgComplianceDocumentsQuery(orgId, {});
  const expiredQ = useOrgComplianceDocumentsQuery(orgId, { status: "expired" });
  const pendingQ = useOrgComplianceDocumentsQuery(orgId, { status: "pending" });
  const missingQ = useOrgComplianceDocumentsQuery(orgId, { fileless: true });
  const expiring30 = useExpiringDocumentsQuery(orgId, 30);
  const expiring7  = useExpiringDocumentsQuery(orgId, 7);

  const activeRows = useMemo<ComplianceDocument[]>(() => {
    switch (section) {
      case "all":
        return enrichDocuments(allQ.data ?? []);
      case "expired":
        return enrichDocuments(expiredQ.data ?? []);
      case "pending_verification":
        return enrichDocuments(pendingQ.data ?? []);
      case "missing":
        return enrichDocuments(missingQ.data ?? []);
      case "expiring":
        // `ExpiringDocRow` is a row subset — map into `DocumentRow` shape for
        // the list renderer. Missing fields default to safe values.
        return enrichDocuments(
          (expiring30.data ?? []).map((r) => ({
            id: r.id,
            organization_id: orgId ?? "",
            entity_type: r.entity_type as DocumentRow["entity_type"],
            entity_id: r.entity_id,
            doc_type: r.doc_type,
            doc_label: r.doc_label,
            doc_number: r.doc_number,
            issued_date: null,
            expiry_date: r.expiry_date,
            issued_by: null,
            status: r.status as DocumentRow["status"],
            storage_path: null,
            notes: null,
            verified_by: null,
            verified_at: null,
            created_by: null,
            created_at: r.expiry_date,
            updated_at: r.expiry_date,
          })),
        );
      case "renewal_queue":
        return enrichDocuments(
          (expiring7.data ?? []).map((r) => ({
            id: r.id,
            organization_id: orgId ?? "",
            entity_type: r.entity_type as DocumentRow["entity_type"],
            entity_id: r.entity_id,
            doc_type: r.doc_type,
            doc_label: r.doc_label,
            doc_number: r.doc_number,
            issued_date: null,
            expiry_date: r.expiry_date,
            issued_by: null,
            status: r.status as DocumentRow["status"],
            storage_path: null,
            notes: null,
            verified_by: null,
            verified_at: null,
            created_by: null,
            created_at: r.expiry_date,
            updated_at: r.expiry_date,
          })),
        );
      default:
        return [];
    }
  }, [
    section,
    allQ.data,
    expiredQ.data,
    pendingQ.data,
    missingQ.data,
    expiring30.data,
    expiring7.data,
    orgId,
  ]);

  const isSectionLoading =
    (section === "all" && allQ.isLoading) ||
    (section === "expired" && expiredQ.isLoading) ||
    (section === "pending_verification" && pendingQ.isLoading) ||
    (section === "missing" && missingQ.isLoading) ||
    (section === "expiring" && expiring30.isLoading) ||
    (section === "renewal_queue" && expiring7.isLoading);

  const navigateToEntity = (doc: ComplianceDocument) => {
    // Phase 3 will replace this with a proper per-document detail sheet.
    // For now, route into the entity's existing detail screen so
    // ops can resolve the doc inline.
    if (doc.entity_type === "vehicle") {
      router.push(`/vehicle/${doc.entity_id}` as Parameters<typeof router.push>[0]);
    } else if (doc.entity_type === "driver") {
      router.push(`/fleet-driver/${doc.entity_id}` as Parameters<typeof router.push>[0]);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dashboardSlot}>
        <ComplianceDashboard
          orgId={orgId}
          onCardPress={(s) => setSection(s)}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {SECTIONS.map((s) => {
          const active = s.id === section;
          return (
            <Pressable
              key={s.id}
              onPress={() => setSection(s.id)}
              style={[styles.tabPill, active && styles.tabPillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <s.Icon
                size={14}
                color={active ? "#ffffff" : Theme.textMuted}
                strokeWidth={2.2}
              />
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {t(s.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isSectionLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Theme.primary} />
        </View>
      ) : activeRows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Inbox size={40} color={Theme.textMuted} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>{t("complianceEmptyTitle")}</Text>
          <Text style={styles.emptyBody}>{t("complianceEmptyBody")}</Text>
        </View>
      ) : (
        <FlashList
          data={activeRows}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <DocumentListRow
              doc={item}
              onPress={() => navigateToEntity(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.rowSep} />}
        />
      )}
    </View>
  );
}

// ── Inline row (Phase 3 will replace with full `DocumentCard`) ─────────────

function DocumentListRow({
  doc,
  onPress,
}: {
  doc: ComplianceDocument;
  onPress: () => void;
}) {
  const tone = getExpiryToneColors(doc.alertLevel);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
    >
      <View
        style={[styles.rowAccent, { backgroundColor: tone.fg }]}
      />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {doc.displayLabel}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {doc.entity_type.toUpperCase()} · {doc.doc_number ?? "—"}
        </Text>
        <View style={styles.rowPillRow}>
          <View
            style={[
              styles.rowPill,
              { backgroundColor: tone.bg, borderColor: tone.border },
            ]}
          >
            <Text style={[styles.rowPillText, { color: tone.fg }]} numberOfLines={1}>
              {formatExpiryNarrative(doc.daysUntilExpiry)}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={16} color={Theme.textMuted} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Theme.screenBackground,
  },
  dashboardSlot: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 14,
    paddingBottom: 6,
  },
  tabRow: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingVertical: 10,
    gap: 6,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
  },
  tabPillActive: {
    backgroundColor: Theme.buttonPrimary,
    borderColor: Theme.primary,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  tabLabelActive: {
    color: Theme.buttonPrimaryText,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  emptyBody: {
    fontSize: 12,
    color: Theme.textMuted,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: 24,
  },
  rowSep: {
    height: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    paddingLeft: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowAccent: {
    width: 3,
    alignSelf: "stretch",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  rowMeta: {
    fontSize: 11,
    color: Theme.textMuted,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  rowPillRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  rowPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
