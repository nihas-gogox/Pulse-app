/**
 * Supplier (vendor) onboarding pack, rendered inside the profile card's
 * Verification Vault. Layout mirrors the card's edit panels: accent-bar section
 * headings, bordered form cards, uppercase field labels, registry-style rows.
 * Reuses PulsePillButton (actions), SubTabs (choices) and LoadingIndicator.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PulsePillButton } from "@/components/PulsePillButton";
import { SubTabs } from "@/components/SubTabs";
import Theme from "@/constants/Theme";
import { radius, space } from "@/design-system";
import {
  getSupplierKycDocuments,
  removeSupplierKycDocument,
  updateSupplierKycDocumentStatus,
} from "@/features/suppliers/services/supplierKycDocuments.service";
import {
  deleteSupplierTdsRate,
  getSupplierBankAccount,
  getVendorOnboardingProfile,
  listSupplierTdsRates,
  saveSupplierBankAccount,
  setVendorStatus,
  updateVendorAdvancePercentage,
  updateVendorContactNumbers,
  updateVendorIdentityNumbers,
  upsertSupplierTdsRate,
  type SupplierBankAccount,
  type SupplierTdsRate,
  type VendorOnboardingProfile,
} from "@/features/suppliers/services/supplierVendorOnboarding.service";
import {
  SUPPLIER_KYC_DOC_LABELS,
  type SupplierKycDocType,
  type SupplierKycDocument,
  type SupplierVendorStatus,
} from "@/features/suppliers/types/supplierManagement.types";
import {
  notifySupplierKycUser,
  openSupplierKycDocument,
  pickAndUploadSupplierKycDocument,
} from "@/features/suppliers/utils/supplierKycUpload.util";
import {
  BANK_PROOF_OPTIONS,
  REGISTRATION_NUMBER_FIELD,
  REGISTRATION_OPTIONS,
  VENDOR_STATUS_LABELS,
  VENDOR_VAULT_SECTIONS,
  docsForSection,
  financialYearOf,
  financialYearOptions,
  latestDocOfType,
  latestDocOfTypes,
  maskAadhaar,
  parsePercentage,
  validateVendorNumber,
  validateVendorStatusChange,
  type RegistrationKind,
  type VendorVaultSection,
} from "@/features/suppliers/utils/supplierVendorOnboarding.util";
import { formatTripTableDate } from "@/lib/format";
import { extractIndianMobileTenDigits, validatePhone } from "@/lib/phoneValidation";

import { VendorDocFileRow } from "./VendorDocFileRow";

type Props = {
  organizationId: string;
  supplierId: string;
  canEdit: boolean;
};

const STATUS_ORDER: SupplierVendorStatus[] = ["active", "inactive", "blacklisted"];

const REGISTRATION_PLACEHOLDERS: Record<RegistrationKind, string> = {
  gstin: "29ABCDE1234F1Z5",
  udyam: "UDYAM-KA-01-0012345",
  msme: "MSME registration no.",
  gumasta: "e.g. 760012345/Commercial II",
};

/** Doc types that count toward the "documents verified" summary. */
const SUMMARY_DOC_TYPES: SupplierKycDocType[] = ["pan", "aadhaar_front", "aadhaar_back"];

function sectionOf(id: VendorVaultSection["id"]): VendorVaultSection {
  const s = VENDOR_VAULT_SECTIONS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown vault section ${id}`);
  return s;
}

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirm", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export function SupplierVendorOnboardingVault({ organizationId, supplierId, canEdit }: Props) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<SupplierKycDocument[]>([]);
  const [profile, setProfile] = useState<VendorOnboardingProfile | null>(null);
  const [tdsRates, setTdsRates] = useState<SupplierTdsRate[]>([]);
  const [bank, setBank] = useState<SupplierBankAccount | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [primaryInput, setPrimaryInput] = useState("");
  const [secondaryInput, setSecondaryInput] = useState("");
  const [panInput, setPanInput] = useState("");
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [regKind, setRegKind] = useState<RegistrationKind>("gstin");
  const [regInput, setRegInput] = useState("");
  const [bankForm, setBankForm] = useState({ account_number: "", ifsc_code: "", bank_name: "" });
  const [bankProofType, setBankProofType] = useState<SupplierKycDocType>("cancelled_cheque");
  const [otherName, setOtherName] = useState("");
  const [statusDraft, setStatusDraft] = useState<SupplierVendorStatus>("active");
  const [reasonDraft, setReasonDraft] = useState("");
  const [advanceInput, setAdvanceInput] = useState("");
  const fyOptions = useMemo(() => financialYearOptions(new Date()), []);
  const currentFy = useMemo(() => financialYearOf(new Date()), []);
  const [tdsYear, setTdsYear] = useState(currentFy);
  const [tdsInput, setTdsInput] = useState("");

  useEffect(() => {
    const existing = tdsRates.find((r) => r.financial_year === tdsYear);
    setTdsInput(existing != null ? String(existing.rate_percent) : "");
  }, [tdsYear, tdsRates]);

  const reload = useCallback(async () => {
    const [kyc, prof, tds, acct] = await Promise.all([
      getSupplierKycDocuments(organizationId, supplierId),
      getVendorOnboardingProfile(organizationId, supplierId),
      listSupplierTdsRates(organizationId, supplierId),
      getSupplierBankAccount(organizationId, supplierId),
    ]);
    const firstError = kyc.error ?? prof.error ?? tds.error ?? acct.error;
    setError(firstError ? firstError.message : null);
    setDocs(kyc.documents);
    setTdsRates(tds.rates);
    setBank(acct.account);
    if (prof.profile) {
      const p = prof.profile;
      setProfile(p);
      setPanInput(p.pan_number ?? "");
      setStatusDraft(p.vendor_status);
      setReasonDraft(p.blacklist_reason ?? "");
      setAdvanceInput(p.advance_percentage == null ? "" : String(p.advance_percentage));
      const kind: RegistrationKind = p.gstin
        ? "gstin"
        : p.msme_number?.startsWith("UDYAM")
          ? "udyam"
          : p.msme_number
            ? "msme"
            : p.gumasta_number
              ? "gumasta"
              : "gstin";
      setRegKind(kind);
      setRegInput(p[REGISTRATION_NUMBER_FIELD[kind]] ?? "");
      setPrimaryInput(extractIndianMobileTenDigits(p.phone ?? "") ?? "");
      setSecondaryInput(extractIndianMobileTenDigits(p.secondary_phone ?? "") ?? "");
    }
    setLoading(false);
  }, [organizationId, supplierId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Runs one write, shows its error, then refreshes everything. */
  const run = useCallback(
    async (key: string, action: () => Promise<{ error: Error | null } | void>) => {
      setBusyKey(key);
      setError(null);
      try {
        const res = await action();
        if (res && res.error) {
          setError(res.error.message);
          notifySupplierKycUser("Could not save", res.error.message);
        }
      } finally {
        setBusyKey(null);
        await reload();
      }
    },
    [reload],
  );

  const fail = useCallback((title: string, msg: string) => {
    setError(msg);
    notifySupplierKycUser(title, msg);
  }, []);

  const upload = useCallback(
    (key: string, docType: SupplierKycDocType, opts: { mode: "replace" | "append"; label?: string; number?: string }) =>
      run(key, async () => {
        const res = await pickAndUploadSupplierKycDocument({
          orgId: organizationId,
          supplierId,
          docType,
          docLabel: opts.label ?? SUPPLIER_KYC_DOC_LABELS[docType],
          docNumber: opts.number,
          mode: opts.mode,
        });
        if (res.status === "error") return { error: res.error };
        return { error: null };
      }),
    [run, organizationId, supplierId],
  );

  const onView = useCallback((doc: SupplierKycDocument) => {
    const path = (doc.storage_path ?? "").trim();
    if (path) void openSupplierKycDocument(path);
  }, []);

  const onVerify = useCallback(
    (doc: SupplierKycDocument) => run(`verify:${doc.id}`, () => updateSupplierKycDocumentStatus(doc.id, "verified")),
    [run],
  );

  const onRemove = useCallback(
    async (doc: SupplierKycDocument) => {
      const ok = await confirmAction("Remove document", `Remove ${doc.doc_label ?? doc.file_name ?? "this file"}?`);
      if (ok) await run(`remove:${doc.id}`, () => removeSupplierKycDocument(doc));
    },
    [run],
  );

  /** Validates then saves identity numbers; returns false when validation failed. */
  const saveNumbers = useCallback(
    (
      key: string,
      fields: { kind: Parameters<typeof validateVendorNumber>[0]; value: string }[],
      patch: Parameters<typeof updateVendorIdentityNumbers>[2],
    ): boolean => {
      for (const f of fields) {
        const msg = validateVendorNumber(f.kind, f.value);
        if (msg) {
          fail("Check the number", msg);
          return false;
        }
      }
      void run(key, () => updateVendorIdentityNumbers(organizationId, supplierId, patch));
      return true;
    },
    [run, fail, organizationId, supplierId],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <LoadingIndicator size="small" color={Theme.textPrimaryDark} />
      </View>
    );
  }

  const rowProps = { canEdit, onView, onVerify };
  const regDoc = latestDocOfType(docs, regKind);
  const bankDoc = latestDocOfTypes(docs, sectionOf("bank").docTypes);
  const currentStatus = profile?.vendor_status ?? "active";

  // Save buttons enable only after a value changes (invalid input counts, so its error shows).
  const advanceTrimmed = advanceInput.trim();
  const savedAdvance = profile?.advance_percentage ?? null;
  const advanceDirty = advanceTrimmed ? parsePercentage(advanceTrimmed) !== savedAdvance : savedAdvance != null;
  const savedPrimary = extractIndianMobileTenDigits(profile?.phone ?? "") ?? "";
  const savedSecondary = extractIndianMobileTenDigits(profile?.secondary_phone ?? "") ?? "";
  const canEditPrimary = canEdit && !profile?.is_integrated;
  const contactDirty =
    (canEditPrimary && primaryInput.trim() !== savedPrimary) || secondaryInput.trim() !== savedSecondary;
  const statusDirty =
    statusDraft !== currentStatus ||
    (statusDraft === "blacklisted" && reasonDraft.trim() !== (profile?.blacklist_reason ?? ""));

  // Summary strip
  const summaryDocs = [
    ...SUMMARY_DOC_TYPES.map((t) => latestDocOfType(docs, t)),
    bankDoc,
    regDoc,
  ].filter((d): d is SupplierKycDocument => Boolean(d?.storage_path));
  const verifiedCount = summaryDocs.filter((d) => d.status === "verified").length;
  const currentTds = tdsRates.find((r) => r.financial_year === currentFy);

  return (
    <View style={styles.root}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.summary}>
        <SummaryCell label="Vendor status">
          <StatusPill status={currentStatus} />
        </SummaryCell>
        <SummaryCell label="Key documents" value={`${verifiedCount} / ${SUMMARY_DOC_TYPES.length + 2} verified`} />
        <SummaryCell label="Advance" value={savedAdvance == null ? "—" : `${savedAdvance}%`} />
        <SummaryCell label={`TDS FY ${currentFy}`} value={currentTds ? `${currentTds.rate_percent}%` : "—"} last />
      </View>

      {/* ── Contact ───────────────────────────────────────────────────── */}
      <SectionHeading title="Contact numbers" hint="Primary and secondary mobile for this vendor" />
      <FormCard>
        <FieldRow>
          <Field
            label="Primary mobile"
            value={primaryInput}
            onChangeText={setPrimaryInput}
            placeholder="10-digit mobile"
            keyboardType="number-pad"
            editable={canEditPrimary}
          />
          <Field
            label="Secondary mobile (optional)"
            value={secondaryInput}
            onChangeText={setSecondaryInput}
            placeholder="10-digit mobile"
            keyboardType="number-pad"
            editable={canEdit}
          />
        </FieldRow>
        {profile?.is_integrated ? (
          <Text style={styles.note}>Primary mobile is managed by the connected vendor account.</Text>
        ) : null}
        {canEdit ? (
          <FormActions>
            <PulsePillButton
              label="Save mobile numbers"
              size="compact"
              variant="dark"
              loading={busyKey === "contact"}
              disabled={!contactDirty}
              onPress={() => {
                const primary = primaryInput.trim();
                const secondary = secondaryInput.trim();
                const primaryDigits = canEditPrimary ? extractIndianMobileTenDigits(primary) : savedPrimary;
                const msg =
                  (canEditPrimary ? (primary ? validatePhone(primary) : "Primary mobile is required.") : null) ??
                  (secondary ? validatePhone(secondary) : null) ??
                  (secondary && extractIndianMobileTenDigits(secondary) === primaryDigits
                    ? "Secondary mobile must be different from the primary."
                    : null);
                if (msg) {
                  fail("Check the mobile number", msg);
                  return;
                }
                void run("contact", () =>
                  updateVendorContactNumbers(organizationId, supplierId, {
                    ...(canEditPrimary && primary !== savedPrimary ? { phone: primary } : {}),
                    secondary_phone: secondary,
                  }),
                );
              }}
            />
          </FormActions>
        ) : null}
      </FormCard>

      {/* ── Commercial terms ─────────────────────────────────────────── */}
      <SectionHeading title="Commercial terms" hint="Status, advance and TDS by financial year" />
      <FormCard>
        <CardTitle
          title="Vendor status"
          trailing={
            profile?.status_changed_at ? (
              <Text style={styles.cardMeta}>Updated {formatTripTableDate(profile.status_changed_at)}</Text>
            ) : null
          }
        />
        {canEdit ? (
          <Choice
            items={STATUS_ORDER.map((s) => ({ key: s, label: VENDOR_STATUS_LABELS[s] }))}
            value={statusDraft}
            onChange={(v) => setStatusDraft(v as SupplierVendorStatus)}
          />
        ) : (
          <View style={styles.inline}>
            <StatusPill status={currentStatus} />
          </View>
        )}
        {currentStatus === "blacklisted" && profile?.blacklist_reason && statusDraft !== "blacklisted" ? (
          <Text style={styles.reason}>Reason: {profile.blacklist_reason}</Text>
        ) : null}
        {canEdit && statusDraft === "blacklisted" ? (
          <Field
            label="Blacklist reason (required)"
            value={reasonDraft}
            onChangeText={setReasonDraft}
            placeholder="Why is this vendor blacklisted?"
            multiline
          />
        ) : !canEdit && currentStatus === "blacklisted" && profile?.blacklist_reason ? (
          <Text style={styles.reason}>Reason: {profile.blacklist_reason}</Text>
        ) : null}
        {canEdit ? (
          <FormActions>
            <PulsePillButton
              label="Save status"
              size="compact"
              variant="dark"
              loading={busyKey === "status"}
              disabled={!statusDirty}
              onPress={async () => {
                const msg = validateVendorStatusChange(statusDraft, reasonDraft);
                if (msg) {
                  setError(msg);
                  return;
                }
                if (statusDraft === "blacklisted") {
                  const ok = await confirmAction("Blacklist vendor", "This vendor can no longer be assigned to new trips.");
                  if (!ok) return;
                }
                await run("status", () => setVendorStatus(organizationId, supplierId, statusDraft, reasonDraft));
              }}
            />
          </FormActions>
        ) : null}

        <Divider />
        <CardTitle title="Advance" />
        <FieldRow>
          <Field
            label="Advance % (of partner rate)"
            value={advanceInput}
            onChangeText={(text) => setAdvanceInput(text.replace(/%/g, ""))}
            placeholder="e.g. 30"
            keyboardType="decimal-pad"
            editable={canEdit}
          />
        </FieldRow>
        {canEdit ? (
          <FormActions>
            <PulsePillButton
              label="Save advance %"
              size="compact"
              variant="dark"
              loading={busyKey === "advance"}
              disabled={!advanceDirty}
              onPress={() => {
                const pct = advanceTrimmed ? parsePercentage(advanceTrimmed) : null;
                if (advanceTrimmed && pct == null) {
                  fail("Check the advance %", "Advance % must be a number from 0 to 100 (do not include letters).");
                  return;
                }
                void run("advance", () => updateVendorAdvancePercentage(organizationId, supplierId, pct));
              }}
            />
          </FormActions>
        ) : null}

        <Divider />
        <CardTitle title="TDS rate by financial year" />
        {canEdit ? (
          <>
            <Text style={styles.fieldLabel}>Financial year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fyScroll}>
              <Choice items={fyOptions.map((fy) => ({ key: fy, label: `FY ${fy}` }))} value={tdsYear} onChange={setTdsYear} />
            </ScrollView>
            <FieldRow>
              <Field
                label="TDS rate %"
                value={tdsInput}
                onChangeText={(text) => setTdsInput(text.replace(/%/g, ""))}
                placeholder="e.g. 1 or 2"
                keyboardType="decimal-pad"
              />
            </FieldRow>
            {!tdsInput.trim() ? (
              <Text style={styles.empty}>Enter a TDS rate % to enable Save for FY {tdsYear}.</Text>
            ) : null}
            <FormActions>
              <PulsePillButton
                label={tdsRates.some((r) => r.financial_year === tdsYear) ? `Update FY ${tdsYear}` : `Save FY ${tdsYear}`}
                size="compact"
                variant="dark"
                loading={busyKey === "tds"}
                disabled={!tdsInput.trim()}
                onPress={() => {
                  const pct = parsePercentage(tdsInput);
                  if (pct == null) {
                    fail("Check the TDS rate", "TDS rate must be a number from 0 to 100 (do not include letters).");
                    return;
                  }
                  void run("tds", async () => {
                    const res = await upsertSupplierTdsRate(organizationId, supplierId, tdsYear, pct);
                    // Keep the saved rate visible for this FY (do not clear the field).
                    return res;
                  });
                }}
              />
            </FormActions>
          </>
        ) : null}
        {tdsRates.length === 0 ? (
          <Text style={styles.empty}>No TDS rate saved yet.</Text>
        ) : (
          <View style={styles.table}>
            {tdsRates.map((r, i) => (
              <View key={r.id} style={[styles.tableRow, i === tdsRates.length - 1 && styles.tableRowLast]}>
                <Text style={styles.tableKey}>FY {r.financial_year}</Text>
                <Text style={styles.tableValue}>{r.rate_percent}%</Text>
                {canEdit ? (
                  <PulsePillButton
                    label="Delete"
                    size="compact"
                    variant="outline"
                    loading={busyKey === `tds-del:${r.id}`}
                    labelStyle={styles.destructiveLabel}
                    accessibilityLabel={`Delete TDS rate for FY ${r.financial_year}`}
                    onPress={async () => {
                      const ok = await confirmAction("Delete TDS rate", `Delete the FY ${r.financial_year} rate?`);
                      if (ok) await run(`tds-del:${r.id}`, () => deleteSupplierTdsRate(r.id));
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </FormCard>

      {/* ── Identity & registration ──────────────────────────────────── */}
      <SectionHeading title="Identity & registration" hint="PAN, Aadhaar and business registration" />
      <FormCard>
        <CardTitle title="PAN" />
        <FieldRow>
          <Field label="PAN number" value={panInput} onChangeText={setPanInput} placeholder="ABCDE1234F" autoCapitalize="characters" editable={canEdit} />
        </FieldRow>
        {canEdit ? (
          <FormActions>
            <PulsePillButton
              label="Save PAN number"
              size="compact"
              variant="dark"
              loading={busyKey === "pan-number"}
              disabled={panInput.trim().toUpperCase() === (profile?.pan_number ?? "")}
              onPress={() => {
                saveNumbers("pan-number", [{ kind: "pan", value: panInput }], { pan_number: panInput });
              }}
            />
          </FormActions>
        ) : null}
        <VendorDocFileRow
          {...rowProps}
          title="PAN card"
          kind="single"
          last
          doc={latestDocOfType(docs, "pan")}
          busy={busyKey === "upload:pan"}
          onUpload={() => void upload("upload:pan", "pan", { mode: "replace", number: panInput || undefined })}
        />
      </FormCard>

      <FormCard>
        <CardTitle
          title="Aadhaar"
          trailing={profile?.aadhaar_number ? <Text style={styles.cardMeta}>On file · {maskAadhaar(profile.aadhaar_number)}</Text> : null}
        />
        {canEdit ? (
          <>
            <FieldRow>
              <Field
                label={profile?.aadhaar_number ? "Update Aadhaar number" : "Aadhaar number"}
                value={aadhaarInput}
                onChangeText={setAadhaarInput}
                placeholder="12 digits"
                keyboardType="number-pad"
              />
            </FieldRow>
            <FormActions>
              <PulsePillButton
                label="Save Aadhaar number"
                size="compact"
                variant="dark"
                loading={busyKey === "aadhaar-number"}
                disabled={!aadhaarInput.trim()}
                onPress={() => {
                  if (saveNumbers("aadhaar-number", [{ kind: "aadhaar", value: aadhaarInput }], { aadhaar_number: aadhaarInput })) {
                    setAadhaarInput("");
                  }
                }}
              />
            </FormActions>
          </>
        ) : null}
        {(["aadhaar_front", "aadhaar_back"] as const).map((t, i) => (
          <VendorDocFileRow
            key={t}
            {...rowProps}
            title={SUPPLIER_KYC_DOC_LABELS[t]}
            kind="single"
            last={i === 1}
            doc={latestDocOfType(docs, t)}
            busy={busyKey === `upload:${t}`}
            onUpload={() => void upload(`upload:${t}`, t, { mode: "replace" })}
          />
        ))}
      </FormCard>

      <FormCard>
        <CardTitle title="GST / Udyam / MSME / Gumasta" />
        <Choice
          items={REGISTRATION_OPTIONS.map((o) => ({ key: o.docType, label: o.label }))}
          value={regKind}
          onChange={(v) => {
            const kind = v as RegistrationKind;
            setRegKind(kind);
            setRegInput(profile?.[REGISTRATION_NUMBER_FIELD[kind]] ?? "");
          }}
        />
        <FieldRow>
          <Field
            label={`${REGISTRATION_OPTIONS.find((o) => o.docType === regKind)?.label ?? ""} number`}
            value={regInput}
            onChangeText={setRegInput}
            placeholder={REGISTRATION_PLACEHOLDERS[regKind]}
            autoCapitalize="characters"
            editable={canEdit}
          />
        </FieldRow>
        {canEdit ? (
          <FormActions>
            <PulsePillButton
              label="Save number"
              size="compact"
              variant="dark"
              loading={busyKey === "reg-number"}
              disabled={regInput.trim().toUpperCase() === (profile?.[REGISTRATION_NUMBER_FIELD[regKind]] ?? "").toUpperCase()}
              onPress={() => {
                saveNumbers("reg-number", [{ kind: regKind, value: regInput }], {
                  [REGISTRATION_NUMBER_FIELD[regKind]]: regInput,
                });
              }}
            />
          </FormActions>
        ) : null}
        <VendorDocFileRow
          {...rowProps}
          title={SUPPLIER_KYC_DOC_LABELS[regKind]}
          kind="single"
          last
          doc={regDoc}
          busy={busyKey === `upload:${regKind}`}
          onUpload={() => void upload(`upload:${regKind}`, regKind, { mode: "replace", number: regInput || undefined })}
        />
      </FormCard>

      {/* ── Banking ──────────────────────────────────────────────────── */}
      <SectionHeading title="Banking" hint="Payout account and proof document" />
      <FormCard>
        <CardTitle
          title="Bank account"
          trailing={
            bank?.account_number ? (
              <Text style={[styles.cardMeta, styles.bankOnFileMeta]} numberOfLines={2}>
                On file · {bank.account_number} · {bank.ifsc_code ?? "—"}
              </Text>
            ) : null
          }
        />
        {canEdit ? (
          <>
            <FieldRow>
              <Field
                label="Account number"
                value={bankForm.account_number}
                onChangeText={(v) => setBankForm((f) => ({ ...f, account_number: v }))}
                placeholder="9–18 digits"
                keyboardType="number-pad"
              />
              <Field
                label="IFSC"
                value={bankForm.ifsc_code}
                onChangeText={(v) => setBankForm((f) => ({ ...f, ifsc_code: v }))}
                placeholder="HDFC0001234"
                autoCapitalize="characters"
              />
              <Field
                label="Bank name"
                value={bankForm.bank_name}
                onChangeText={(v) => setBankForm((f) => ({ ...f, bank_name: v }))}
                placeholder={bank?.bank_name ?? "e.g. HDFC Bank"}
              />
            </FieldRow>
            <FormActions>
              <PulsePillButton
                label="Save bank details"
                size="compact"
                variant="dark"
                loading={busyKey === "bank"}
                disabled={!bankForm.account_number.trim() || !bankForm.ifsc_code.trim()}
                onPress={() => {
                  const msg =
                    validateVendorNumber("account", bankForm.account_number) ??
                    validateVendorNumber("ifsc", bankForm.ifsc_code);
                  if (msg) {
                    fail("Check the bank details", msg);
                    return;
                  }
                  void run("bank", async () => {
                    const res = await saveSupplierBankAccount(organizationId, supplierId, bank?.id ?? null, bankForm);
                    if (!res.error) setBankForm({ account_number: "", ifsc_code: "", bank_name: "" });
                    return res;
                  });
                }}
              />
            </FormActions>
            <Divider />
            <Text style={styles.fieldLabel}>Proof document</Text>
            <Choice
              items={BANK_PROOF_OPTIONS.map((o) => ({ key: o.docType, label: o.label }))}
              value={bankProofType}
              onChange={(v) => setBankProofType(v as SupplierKycDocType)}
            />
          </>
        ) : null}
        <VendorDocFileRow
          {...rowProps}
          title={bankDoc ? SUPPLIER_KYC_DOC_LABELS[bankDoc.doc_type] : "Bank proof"}
          kind="single"
          last
          doc={bankDoc}
          busy={busyKey === "upload:bank"}
          onUpload={() =>
            void upload("upload:bank", bankProofType, {
              mode: "replace",
              label: BANK_PROOF_OPTIONS.find((o) => o.docType === bankProofType)?.label,
            })
          }
        />
      </FormCard>

      {/* ── Document library ─────────────────────────────────────────── */}
      <SectionHeading title="Document library" hint="Verification photos, signed and other documents" />
      {(["physical", "signed", "other"] as const).map((id) => {
        const section = sectionOf(id);
        const docType = section.docTypes[0];
        const list = docsForSection(docs, section);
        return (
          <FormCard key={id}>
            <CardTitle title={section.title} trailing={<Text style={styles.cardMeta}>{list.length} file{list.length === 1 ? "" : "s"}</Text>} />
            {list.length === 0 ? <Text style={styles.empty}>Nothing uploaded yet.</Text> : null}
            {list.map((d, i) => (
              <VendorDocFileRow
                key={d.id}
                {...rowProps}
                title={d.doc_label || d.file_name || SUPPLIER_KYC_DOC_LABELS[d.doc_type]}
                kind="multi"
                last={i === list.length - 1 && !canEdit}
                doc={d}
                busy={busyKey === `remove:${d.id}` || busyKey === `verify:${d.id}`}
                onRemove={(doc) => void onRemove(doc)}
              />
            ))}
            {canEdit ? (
              <View style={styles.addRow}>
                {section.requiresName ? (
                  <View style={styles.addField}>
                    <Field label="Document name (required)" value={otherName} onChangeText={setOtherName} placeholder="e.g. Trade licence" />
                  </View>
                ) : null}
                <PulsePillButton
                  label={section.photosOnly ? "Add photo" : "Add document"}
                  size="compact"
                  variant="filled"
                  showPlusIcon
                  loading={busyKey === `upload:${id}`}
                  disabled={Boolean(section.requiresName) && !otherName.trim()}
                  onPress={() =>
                    void upload(`upload:${id}`, docType, {
                      mode: "append",
                      label: section.requiresName ? otherName.trim() : `${SUPPLIER_KYC_DOC_LABELS[docType]} ${list.length + 1}`,
                    }).then(() => {
                      if (section.requiresName) setOtherName("");
                    })
                  }
                />
              </View>
            ) : null}
          </FormCard>
        );
      })}
    </View>
  );
}

// ── Layout pieces (match CounterpartyProfileSystemCard edit panels) ─────────

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionHeadingRow}>
      <View style={styles.accent} />
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function FormCard({ children }: { children: ReactNode }) {
  return <View style={styles.formCard}>{children}</View>;
}

function CardTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View style={styles.cardTitleRow}>
      <Text style={styles.cardTitle}>{title}</Text>
      {trailing}
    </View>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

function FormActions({ children }: { children: ReactNode }) {
  return <View style={styles.formActions}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function SummaryCell({
  label,
  value,
  children,
  last,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.summaryCell, last && styles.summaryCellLast]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {children ?? <Text style={styles.summaryValue}>{value}</Text>}
    </View>
  );
}

function StatusPill({ status }: { status: SupplierVendorStatus }) {
  const tone =
    status === "active"
      ? { bg: Theme.positiveMuted, fg: Theme.positive }
      : status === "blacklisted"
        ? { bg: Theme.surfaceGray, fg: Theme.negative }
        : { bg: Theme.warningMuted, fg: Theme.warning };
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.fg }]}>{VENDOR_STATUS_LABELS[status]}</Text>
    </View>
  );
}

/** Shared SubTabs in its light variant, flush with the form card padding. */
function Choice({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choice}>
      <SubTabs items={items} value={value} onChange={onChange} variant="light" horizontalPadding={0} gap={space[4]} />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "characters";
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !editable && styles.inputReadOnly]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme.textSection}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={false}
        multiline={multiline}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%" },
  loading: { paddingVertical: space[6], alignItems: "center" },
  errorBanner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.negative,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    marginBottom: space[3],
  },
  errorText: { fontSize: 11, fontWeight: "700", color: Theme.negative },

  // Summary strip — registry-card style
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
    marginBottom: space[4],
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: 130,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Theme.borderInput,
    gap: space[1],
  },
  summaryCellLast: { borderRightWidth: 0 },
  summaryLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: Theme.textSection,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: { fontSize: 13, fontWeight: "700", color: Theme.textPrimaryDark, fontVariant: ["tabular-nums"] },

  // Section heading — accent bar + uppercase title + hint (editSectionHeadingRow)
  sectionHeadingRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: space[2], marginTop: space[1] },
  accent: { width: 2, height: 12, borderRadius: 1, backgroundColor: Theme.textPrimaryDark, marginTop: 1 },
  sectionHeadingCopy: { flex: 1, minWidth: 0 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionHint: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Form card (editFormCard)
  formCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: space[3],
    paddingTop: space[3],
    paddingBottom: space[1],
    marginBottom: space[3],
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
    marginBottom: space[2],
    flexWrap: "wrap",
  },
  cardTitle: { fontSize: 12, fontWeight: "800", color: Theme.textPrimaryDark },
  cardMeta: { fontSize: 10, fontWeight: "600", color: Theme.textMuted },
  bankOnFileMeta: {
    maxWidth: 280,
    textAlign: "right",
    lineHeight: 14,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Theme.borderInput, marginVertical: space[3] },

  // Fields (fieldLabel + fieldInputLarge)
  fieldRow: { flexDirection: "row", flexWrap: "wrap", columnGap: space[3] },
  field: { flexGrow: 1, flexBasis: 200, minWidth: 0 },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Theme.textRouteCard,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Theme.surfaceGray,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    marginBottom: space[3],
    width: "100%",
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  inputReadOnly: { opacity: 0.6 },
  note: { fontSize: 10, fontWeight: "600", color: Theme.textMuted, marginTop: -space[1], marginBottom: space[3] },
  reason: { fontSize: 11, fontWeight: "700", color: Theme.negative, marginBottom: space[3] },
  empty: { fontSize: 12, fontWeight: "500", color: Theme.textMuted, paddingBottom: space[3] },
  inline: { flexDirection: "row", marginBottom: space[3] },

  // Actions — right-aligned like the editor header actions
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: space[2], marginBottom: space[3] },
  destructiveLabel: { color: Theme.negative },

  // SubTabs wrapper
  choice: { marginBottom: space[3] },
  fyScroll: { marginHorizontal: -space[1], paddingHorizontal: space[1] },

  // Status pill (pillEmerald family)
  statusPill: { alignSelf: "flex-start", paddingHorizontal: space[2], paddingVertical: 2, borderRadius: 4 },
  statusPillText: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.4 },

  // TDS table (registry rows)
  table: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Theme.borderInput, marginBottom: space[2] },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderInput,
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableKey: { flex: 1, fontSize: 12, fontWeight: "700", color: Theme.textPrimaryDark },
  tableValue: { fontSize: 12, fontWeight: "800", color: Theme.textPrimaryDark, fontVariant: ["tabular-nums"] },

  // Document library add row
  addRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: space[3],
    paddingTop: space[3],
    paddingBottom: space[3],
  },
  addField: { flexGrow: 1, flexBasis: 220, marginBottom: -space[3] },
});
