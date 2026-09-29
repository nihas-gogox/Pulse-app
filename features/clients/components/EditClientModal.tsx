import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { formatMobileNumber } from "@/lib/format";
import type {
  ClientRow,
  UpdateClientData,
} from "@/features/clients/services/clients.service";
import { ClientInvoicePodPolicySection } from "@/features/clients/components/ClientInvoicePodPolicySection";
import { isIntegratedClientRow } from "@/features/trips/visibility/tripVisibility";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Treat DB/API placeholders or internal ids as empty so we show proper placeholders instead. */
function normalizeContactDisplay(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  if (s === "nameLabel" || s === "contactPerson" || s === "contact") return "";
  return s;
}

/** Treat linked-org placeholder or UUID in phone field as empty for display. */
function normalizePhoneDisplay(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  if (!s) return "";
  if (/^linked-/i.test(s)) return "";
  if (s.toLowerCase().includes("linked-")) return "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return "";
  if (/^[0-9a-f-]{36,}$/i.test(s)) return "";
  return s;
}

export interface EditClientModalProps {
  visible: boolean;
  client: ClientRow | null;
  onClose: () => void;
  /** Called with a patch object; caller is responsible for invoking updateClient with the current org + client id. */
  onSave: (patch: UpdateClientData) => Promise<void> | void;
  /** Optional: when provided for integrated clients, shows a Sync Latest button that calls this to prefill from platform profile. */
  onSyncLatest?: () => Promise<
    | {
        organizationName?: string;
        contactPerson?: string;
        phone?: string;
        email?: string;
        gstin?: string | null;
        address?: string | null;
        website?: string | null;
      }
    | void
  >;
}

export function EditClientModal({
  visible,
  client,
  onClose,
  onSave,
  onSyncLatest,
}: EditClientModalProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [organizationName, setOrganizationName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  useEffect(() => {
    if (client) {
      setOrganizationName(client.name ?? "");
      setContactPerson(normalizeContactDisplay(client.contact_person));
      setPhone(normalizePhoneDisplay(client.phone));
      setEmail((client.email ?? "").trim());
      setAddress((client.address ?? "").trim());
      setGstin((client.gstin ?? "").trim());
      setPanNumber((client.pan_number ?? "").trim());
    }
  }, [client]);

  const isIntegrated = isIntegratedClientRow(client);
  const canEditIdentity = !isIntegrated;
  const canEditOrg = canEditIdentity;
  const canEditPhone = canEditIdentity;
  const canEditContact = canEditIdentity;
  const canEditEmail = canEditIdentity;

  const hasEmptyContactOrPhone =
    isIntegrated &&
    (normalizeContactDisplay(client?.contact_person ?? "") === "" ||
      normalizePhoneDisplay(client?.phone ?? "") === "");

  useEffect(() => {
    if (!visible || !client || !isIntegrated || !onSyncLatest || !hasEmptyContactOrPhone) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await onSyncLatest();
        if (cancelled || !result) return;
        if (result.organizationName != null) setOrganizationName(result.organizationName);
        if (result.contactPerson != null) {
          setContactPerson(normalizeContactDisplay(result.contactPerson));
        }
        if (result.phone != null) {
          setPhone(normalizePhoneDisplay(result.phone));
        }
        if (result.email != null) {
          setEmail((result.email ?? "").trim());
        }
        if (result.gstin && !gstin.trim()) setGstin(result.gstin.trim());
        if (result.address && !address.trim()) setAddress(result.address.trim());
      } catch {
        // Ignore; user can still tap "Sync latest details" manually.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, client?.id, isIntegrated, hasEmptyContactOrPhone, onSyncLatest]);

  if (!visible || !client) return null;

  const canSubmit =
    !submitting &&
    (isIntegrated
      ? true
      : contactPerson.trim().length > 0 && !!organizationName.trim());
  const useSingleColumnFields = windowWidth < 390;

  const handleSyncLatest = async () => {
    if (!onSyncLatest || !isIntegrated) return;
    setSyncing(true);
    setError(null);
    try {
      const result = await onSyncLatest();
      if (result) {
        if (result.organizationName != null) {
          setOrganizationName(result.organizationName);
        }
        if (result.contactPerson != null) {
          setContactPerson(normalizeContactDisplay(result.contactPerson));
        }
        if (result.phone != null) {
          setPhone(normalizePhoneDisplay(result.phone));
        }
        if (result.email != null) {
          setEmail((result.email ?? "").trim());
        }
        if (result.gstin) setGstin(result.gstin.trim());
        if (result.address) setAddress(result.address.trim());
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to sync latest client details",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const patch: UpdateClientData = {};
    if (canEditContact) {
      patch.contact_person = contactPerson.trim();
    }
    if (canEditEmail) {
      patch.email = email.trim();
    }
    if (canEditOrg) {
      patch.organization_name = organizationName.trim();
    }
    if (canEditPhone) {
      patch.phone = phone.trim();
    }
    patch.address = address.trim();
    patch.gstin = gstin.trim();
    patch.pan_number = panNumber.trim();
    const result = onSave(patch);
    const p = result as void | Promise<unknown>;
    if (typeof p?.then === "function") {
      p.then(() => {
        setSubmitting(false);
        onClose();
      }).catch((err: unknown) => {
        setSubmitting(false);
        setError(
          err instanceof Error ? err.message : "Failed to update client",
        );
      });
    } else {
      setSubmitting(false);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <KeyboardAvoidingView
        style={styles.screenRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.screenRoot, { backgroundColor: Theme.surface }]}>
          <View style={[styles.screenHeader, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={styles.screenHeaderButton}
              onPress={onClose}
              accessibilityLabel="Go back"
              activeOpacity={0.8}
            >
              <FontAwesome
                name="chevron-left"
                size={16}
                color={Theme.textPrimaryDark}
              />
            </TouchableOpacity>
            <View style={styles.screenHeaderTitleWrap}>
              <Text style={styles.screenTitle}>Edit Client</Text>
            </View>
          </View>

          <ScrollView
            style={styles.screenScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.screenScrollContent,
              { paddingBottom: insets.bottom + 140 },
            ]}
          >
            <View style={styles.screenSection}>
              <Text style={styles.screenSectionLabel}>CLIENT DETAILS</Text>

              {isIntegrated && (
                <View style={styles.screenStatusCard}>
                  <Text style={styles.screenStatusTitle}>Integrated client</Text>
                  <Text style={styles.screenStatusText}>
                    Name, phone, email, and contact person sync from the
                    client&apos;s own account and cannot be edited here. You can
                    still update billing address and tax fields for fleet
                    paperwork.
                  </Text>
                  {onSyncLatest ? (
                    <TouchableOpacity
                      style={styles.screenSyncButton}
                      onPress={handleSyncLatest}
                      disabled={syncing || submitting}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.screenSyncButtonText}>
                        {syncing ? "Syncing..." : "Sync latest details"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              <Pressable style={styles.screenInputCard}>
                <Text style={styles.screenInputLabel}>Organization</Text>
                <TextInput
                  style={[styles.screenInput, !canEditOrg && styles.readonlyInput]}
                  placeholder="Company or organization"
                  placeholderTextColor={Theme.textMutedDemo}
                  value={organizationName}
                  onChangeText={setOrganizationName}
                  editable={canEditOrg}
                />
              </Pressable>

              <View
                style={[
                  styles.screenTwoCol,
                  useSingleColumnFields && styles.screenTwoColStack,
                ]}
              >
                <Pressable style={styles.screenFieldCard}>
                  <Text style={styles.screenInputLabel}>
                    Contact{" "}
                    {canEditContact ? (
                      <Text style={styles.screenRequiredMark}>*</Text>
                    ) : null}
                  </Text>
                  <TextInput
                    style={[
                      styles.screenInput,
                      !canEditContact && styles.readonlyInput,
                    ]}
                    placeholder="Contact person name"
                    placeholderTextColor={Theme.textMutedDemo}
                    value={contactPerson}
                    onChangeText={setContactPerson}
                    editable={canEditContact}
                  />
                </Pressable>
                <Pressable style={styles.screenFieldCard}>
                  <Text style={styles.screenInputLabel}>Phone number</Text>
                  <TextInput
                    style={[styles.screenInput, !canEditPhone && styles.readonlyInput]}
                    placeholder={
                      isIntegrated && !normalizePhoneDisplay(phone)
                        ? "From platform"
                        : "+91 98765 43210"
                    }
                    placeholderTextColor={Theme.textMutedDemo}
                    value={phone}
                    onChangeText={(t) => setPhone(formatMobileNumber(t))}
                    editable={canEditPhone}
                    keyboardType="phone-pad"
                  />
                </Pressable>
              </View>

              <Pressable style={styles.screenInputCard}>
                <Text style={styles.screenInputLabel}>Email</Text>
                <TextInput
                  style={[
                    styles.screenInput,
                    !canEditEmail && styles.readonlyInput,
                  ]}
                  placeholder={t("email")}
                  placeholderTextColor={Theme.textMutedDemo}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={canEditEmail}
                />
              </Pressable>

              <Pressable style={styles.screenInputCardMultiline}>
                <Text style={styles.screenInputLabel}>Billing address</Text>
                <TextInput
                  style={[styles.screenInput, styles.screenInputMultiline]}
                  placeholder="Street, city, state, PIN"
                  placeholderTextColor={Theme.textMutedDemo}
                  value={address}
                  onChangeText={setAddress}
                  multiline
                  textAlignVertical="top"
                />
              </Pressable>

              {client?.organization_id && client.id ? (
                <ClientInvoicePodPolicySection
                  orgId={client.organization_id}
                  clientId={client.id}
                  rawPolicy={client.invoice_pod_policy}
                  embedded
                />
              ) : null}

              <View
                style={[
                  styles.screenTwoCol,
                  useSingleColumnFields && styles.screenTwoColStack,
                ]}
              >
                <Pressable style={styles.screenFieldCard}>
                  <Text style={styles.screenInputLabel}>GSTIN</Text>
                  <TextInput
                    style={styles.screenInput}
                    placeholder="15-character GSTIN"
                    placeholderTextColor={Theme.textMutedDemo}
                    value={gstin}
                    onChangeText={(v) => setGstin(v.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={15}
                  />
                </Pressable>
                <Pressable style={styles.screenFieldCard}>
                  <Text style={styles.screenInputLabel}>PAN</Text>
                  <TextInput
                    style={styles.screenInput}
                    placeholder="AAAAA9999A"
                    placeholderTextColor={Theme.textMutedDemo}
                    value={panNumber}
                    onChangeText={(v) => setPanNumber(v.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </Pressable>
              </View>

              {error ? (
                <View style={styles.screenErrorCard}>
                  <Text style={styles.screenErrorText}>{error}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.screenFooter,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.screenSubmitButton,
                (!canSubmit || submitting) && styles.screenButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.9}
            >
              <Text style={styles.screenSubmitButtonText}>
                {submitting ? "Saving..." : "SAVE CHANGES"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
  },
  screenHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  screenHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: -0.3,
  },
  screenScroll: {
    flex: 1,
  },
  screenScrollContent: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 20,
    gap: 24,
  },
  screenSection: {
    gap: 14,
  },
  screenSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textMutedDemo,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 4,
  },
  screenInputCard: {
    backgroundColor: Theme.screenBackground,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 88,
  },
  screenInputCardMultiline: {
    backgroundColor: Theme.screenBackground,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 120,
  },
  screenInputMultiline: {
    minHeight: 72,
    paddingTop: 4,
  },
  screenTwoCol: {
    flexDirection: "row",
    gap: 12,
  },
  screenTwoColStack: {
    flexDirection: "column",
  },
  screenFieldCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Theme.screenBackground,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 88,
  },
  screenInputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textMutedDemo,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  screenRequiredMark: {
    color: Theme.negative,
  },
  screenInput: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    paddingVertical: 0,
    minHeight: 28,
  },
  screenStatusCard: {
    backgroundColor: Theme.screenBackground,
    borderWidth: 1,
    borderColor: Theme.borderLight,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  screenStatusTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  screenStatusText: {
    fontSize: 13,
    color: Theme.textSecondary,
    lineHeight: 19,
  },
  screenSyncButton: {
    alignSelf: "flex-start",
    minHeight: Layout.minTouchTargetSize,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    backgroundColor: Theme.screenBackground,
  },
  screenSyncButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  screenErrorCard: {
    backgroundColor: Theme.screenBackground,
    borderWidth: 1,
    borderColor: Theme.negative + "30",
    borderRadius: 16,
    padding: 16,
  },
  screenErrorText: {
    fontSize: 13,
    color: Theme.negative,
    lineHeight: 19,
  },
  screenFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 16,
    backgroundColor: Theme.screenBackground,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  screenSubmitButton: {
    minHeight: Layout.minTouchTargetSize + 12,
    borderRadius: 16,
    backgroundColor: Theme.buttonMatteBlack,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  screenSubmitButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.buttonMatteBlackText,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  screenButtonDisabled: {
    opacity: 0.5,
  },
  readonlyInput: {
    color: Theme.textSecondary,
  },
});

