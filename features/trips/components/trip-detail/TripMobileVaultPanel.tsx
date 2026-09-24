/**
 * Mobile vault tab — order-list style document cards (reference: Orders & Refunds).
 * Same upload / view handlers as TripAssetVaultPanel; chrome only changes.
 */
import { LoadingIndicator } from "@/components/LoadingIndicator";
import Theme from "@/constants/Theme";
import { canMutateTripVaultDoc, formatLrVaultDateLabel, formatLrVaultNumberLabel, isEwayBillVaultDoc, isLrVaultDoc, type TripDocItem, VAULT_DOC_LIMIT_HINT, vaultDocHasPreviewableFile } from "@/features/trips/components/trip-detail/tripDocTypes";
import {
  EwayBillLrStrip,
  type EwayBillStripRow,
  type EwayFieldValues,
} from "@/features/trips/components/trip-detail/EwayBillVaultTab";
import { getDocumentViewUrls } from "@/features/trips/services/tripDocuments.service";
import { getVehicleDocumentViewUrls } from "@/features/vehicles/services/vehicleDocuments.service";
import { getComplianceDocumentSignedUrl } from "@/features/compliance/services/documents.service";
import { VEHICLE_COMPLIANCE_TYPE_HINT } from "@/features/vehicles/utils/vehicleDocuments.util";
import { DRIVER_IDENTITY_TYPE_HINT } from "@/features/drivers/utils/driverIdentityDocuments.util";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Feather from "@expo/vector-icons/Feather";
import { createElement, memo, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const LINK = "#2874F0";
const CANVAS = "#F5F5F5";
const MUTED = "#9E9E9E";
const BODY = "#616161";
const INK = "#212121";
const PAD = 14;
const THUMB = 52;

type Props = {
  docs: TripDocItem[];
  canUploadTripDocs: boolean;
  tripCompleted?: boolean;
  uploadingDocId: string | null;
  vehicleId: string | null;
  onCardPress: (doc: TripDocItem) => void;
  onAddMore?: (doc: TripDocItem) => void;
  ewayStripRows?: EwayBillStripRow[];
  onViewEwayBill?: (rowId: string) => void;
  onUploadEwayBill?: (rowId: string) => void;
  canUploadEwayBill?: boolean;
  canEditEwayBill?: boolean;
  onSaveEwayBill?: (values: EwayFieldValues[]) => Promise<boolean>;
  tripIdLabel: string;
  createdAtLabel: string;
};

type Tone = "ok" | "warn" | "miss";

function statusCopy(status: TripDocItem["status"] | string): {
  title: string;
  detail: string;
  tone: Tone;
} {
  if (status === "Missing") {
    return {
      title: "Missing",
      detail: "Required document not uploaded yet",
      tone: "miss",
    };
  }
  if (status === "Pending") {
    return {
      title: "Pending upload",
      detail: "Tap to upload or open",
      tone: "warn",
    };
  }
  return {
    title: "Uploaded",
    detail: "Document on file — tap to view",
    tone: "ok",
  };
}

function isPdfDoc(doc: TripDocItem): boolean {
  if (doc.type === "PDF") return true;
  const path = (doc.storagePath ?? "").toLowerCase();
  return path.endsWith(".pdf");
}

function StatusGlyph({ tone }: { tone: Tone }) {
  return (
    <Feather
      name={
        tone === "miss"
          ? "alert-triangle"
          : tone === "ok"
            ? "check"
            : "file-text"
      }
      size={16}
      color={
        tone === "miss"
          ? Theme.teslaRed
          : tone === "ok"
            ? Theme.positive
            : BODY
      }
    />
  );
}

const VaultDocThumb = memo(function VaultDocThumb({
  doc,
  tone,
  signedUrl,
  signing,
}: {
  doc: TripDocItem;
  tone: Tone;
  signedUrl: string | null;
  signing: boolean;
}) {
  const storagePath = doc.storagePath?.trim() || "";
  const canPreview = tone === "ok" && !!storagePath;
  const pdf = useMemo(() => isPdfDoc(doc), [doc]);
  const url = (signedUrl ?? "").trim() || null;
  const loading = canPreview && signing;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [url]);

  if (!canPreview) {
    return (
      <View
        style={[
          styles.thumb,
          tone === "ok" && styles.thumbOk,
          tone === "miss" && styles.thumbMiss,
          tone === "warn" && styles.thumbWarn,
        ]}
      >
        <StatusGlyph tone={tone} />
      </View>
    );
  }

  const showImage = !!url && !pdf && !imageFailed;
  const showWebPdf = !!url && pdf && Platform.OS === "web";

  return (
    <View style={[styles.thumb, styles.thumbPreview]}>
      {loading ? (
        <LoadingIndicator size="small" color={MUTED} />
      ) : showImage ? (
        <Image
          source={{ uri: url }}
          style={styles.thumbImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
          accessibilityLabel={`${doc.label} preview`}
        />
      ) : showWebPdf ? (
        <View style={styles.pdfClip} pointerEvents="none">
          {createElement("iframe", {
            src: `${url}#page=1&view=FitH&toolbar=0&navpanes=0`,
            title: `${doc.label} preview`,
            style: {
              width: THUMB * 3.2,
              height: THUMB * 4.2,
              border: "none",
              transform: "scale(0.3125)",
              transformOrigin: "top left",
              backgroundColor: "#fff",
            },
          })}
          <View style={styles.pdfBadge}>
            <Text style={styles.pdfBadgeText}>PDF</Text>
          </View>
        </View>
      ) : (
        <View style={styles.thumbFallback}>
          <FontAwesome
            name={pdf ? "file-pdf-o" : "file-image-o"}
            size={18}
            color={pdf ? Theme.teslaRed : Theme.primary}
          />
          <Text style={styles.thumbFallbackLabel}>{pdf ? "PDF" : "DOC"}</Text>
        </View>
      )}
    </View>
  );
});

export const TripMobileVaultPanel = memo(function TripMobileVaultPanel({
  docs,
  canUploadTripDocs,
  tripCompleted = false,
  uploadingDocId,
  vehicleId,
  onCardPress,
  onAddMore,
  ewayStripRows = [],
  onViewEwayBill,
  onUploadEwayBill,
  canUploadEwayBill,
  canEditEwayBill,
  onSaveEwayBill,
  tripIdLabel,
  createdAtLabel,
}: Props) {
  const cardDocs = useMemo(
    () => docs.filter((doc) => !isEwayBillVaultDoc(doc)),
    [docs],
  );
  const verifiedCount = cardDocs.filter((d) => d.status !== "Pending").length;
  const headline =
    cardDocs.length === 0
      ? "No documents yet"
      : verifiedCount === cardDocs.length
        ? "All documents ready"
        : `${verifiedCount} of ${cardDocs.length} documents ready`;

  const thumbPaths = useMemo(() => {
    const vehicle: string[] = [];
    const trip: string[] = [];
    const compliance: string[] = [];
    for (const doc of cardDocs) {
      if (doc.status === "Pending") continue;
      const path = doc.storagePath?.trim();
      if (!path) continue;
      if (doc.docSource === "vehicle") vehicle.push(path);
      else if (doc.docSource === "compliance") compliance.push(path);
      else trip.push(path);
    }
    return { vehicle, trip, compliance };
  }, [cardDocs]);

  const [thumbUrls, setThumbUrls] = useState<Record<string, string | null>>({});
  const [thumbSigning, setThumbSigning] = useState(false);

  useLayoutEffect(() => {
    const vehicle = thumbPaths.vehicle;
    const trip = thumbPaths.trip;
    const compliance = thumbPaths.compliance;
    if (vehicle.length === 0 && trip.length === 0 && compliance.length === 0) {
      setThumbUrls({});
      setThumbSigning(false);
      return;
    }

    let alive = true;
    setThumbSigning(true);
    void Promise.all([
      vehicle.length > 0
        ? getVehicleDocumentViewUrls(vehicle)
        : Promise.resolve({} as Record<string, string | null>),
      trip.length > 0
        ? getDocumentViewUrls(trip)
        : Promise.resolve({} as Record<string, string | null>),
      compliance.length > 0
        ? Promise.all(
            compliance.map(async (path) => {
              const { url } = await getComplianceDocumentSignedUrl(path);
              return [path, url] as const;
            }),
          ).then((entries) => {
            const byPath: Record<string, string | null> = {};
            for (const [path, url] of entries) byPath[path] = url;
            return byPath;
          })
        : Promise.resolve({} as Record<string, string | null>),
    ])
      .then(([vehicleUrls, tripUrls, complianceUrls]) => {
        if (!alive) return;
        setThumbUrls({ ...vehicleUrls, ...tripUrls, ...complianceUrls });
        setThumbSigning(false);
      })
      .catch(() => {
        if (!alive) return;
        setThumbSigning(false);
      });

    return () => {
      alive = false;
    };
  }, [thumbPaths]);

  return (
    <View style={styles.root}>
      <View style={[styles.block, styles.blockFirst]}>
        <Text style={styles.heroTitle}>{headline}</Text>
        <Text style={styles.heroSub}>
          Vault · {verifiedCount}/{cardDocs.length || 0} on file
        </Text>
        {canUploadTripDocs ? (
          <Text style={styles.limitsHint}>{VAULT_DOC_LIMIT_HINT}</Text>
        ) : null}
      </View>

      <View style={styles.listPad}>
        {cardDocs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No vault items</Text>
            <Text style={styles.emptyBody}>
              Trip documents will appear here when available.
            </Text>
          </View>
        ) : (
          cardDocs.map((doc) => {
            const copy = statusCopy(doc.status);
            const isUploading = uploadingDocId === doc.id;
            const isPending = doc.status === "Pending";
            const canUploadThis = canMutateTripVaultDoc({
              doc,
              canUploadTripDocs,
              tripCompleted,
            });
            const showPreviewBtn = vaultDocHasPreviewableFile(doc);
            const showAddMore = canUploadThis && !!onAddMore;
            const lrNumber = isLrVaultDoc(doc)
              ? formatLrVaultNumberLabel(doc.documentNumber)
              : null;
            const lrDate = isLrVaultDoc(doc)
              ? formatLrVaultDateLabel(doc.documentDate)
              : null;

            return (
              <View key={doc.id} style={styles.card}>
                <TouchableOpacity
                  onPress={() => {
                    if (showPreviewBtn) onCardPress(doc);
                  }}
                  activeOpacity={0.88}
                  disabled={isUploading || !showPreviewBtn}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isUploading || !showPreviewBtn,
                  }}
                  accessibilityLabel={
                    showPreviewBtn
                      ? `Preview ${doc.label}`
                      : `${doc.label} preview unavailable — no document on file`
                  }
                >
                  <View style={styles.cardMain}>
                    <VaultDocThumb
                      doc={doc}
                      tone={copy.tone}
                      signedUrl={
                        thumbUrls[doc.storagePath?.trim() || ""] ?? null
                      }
                      signing={
                        thumbSigning &&
                        !Object.prototype.hasOwnProperty.call(
                          thumbUrls,
                          doc.storagePath?.trim() || "",
                        )
                      }
                    />
                    <View style={styles.cardBody}>
                      <Text
                        style={[
                          styles.cardStatus,
                          copy.tone === "miss" && styles.cardStatusMiss,
                          copy.tone === "ok" && styles.cardStatusOk,
                        ]}
                        numberOfLines={1}
                      >
                        {copy.title}
                      </Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {doc.label}
                      </Text>
                      {!isPending && (lrNumber || lrDate) ? (
                        <>
                          {lrNumber ? (
                            <Text style={styles.cardLrNumber} numberOfLines={1}>
                              {lrNumber}
                            </Text>
                          ) : null}
                          {lrDate ? (
                            <Text style={styles.cardLrDate} numberOfLines={1}>
                              {lrDate}
                            </Text>
                          ) : null}
                        </>
                      ) : (
                        <Text style={styles.cardDetail} numberOfLines={2}>
                          {doc.id === "vehicle-documents"
                            ? isPending
                              ? VEHICLE_COMPLIANCE_TYPE_HINT
                              : doc.files?.length
                                ? doc.files.map((file) => file.label).join(" · ")
                                : doc.type
                            : doc.id === "driver-documents"
                              ? isPending
                                ? DRIVER_IDENTITY_TYPE_HINT
                                : doc.files?.length
                                  ? doc.files.map((file) => file.label).join(" · ")
                                  : doc.type
                            : doc.documentNumber?.trim()
                                ? `No. ${doc.documentNumber.trim()}`
                                : (doc.files?.length ?? 0) > 1
                                  ? `${doc.files?.length} files on file — tap to view`
                                  : copy.detail}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.cardAction,
                          !showPreviewBtn && styles.cardActionDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        {isUploading ? "Uploading…" : "Preview"}
                      </Text>
                    </View>
                    <View style={styles.chevronWrap}>
                      {isUploading ? (
                        <LoadingIndicator size="small" color={MUTED} />
                      ) : (
                        <FontAwesome name="chevron-right" size={12} color={MUTED} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                {showAddMore ? (
                  <TouchableOpacity
                    onPress={() => onAddMore(doc)}
                    style={styles.addMoreBtn}
                    activeOpacity={0.85}
                    disabled={isUploading}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${doc.label}`}
                  >
                    <FontAwesome name="plus" size={12} color={LINK} />
                    <Text style={styles.addMoreText}>Add</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
        {cardDocs.some((doc) => isLrVaultDoc(doc)) ? (
          <View style={styles.ewayWrap}>
            <EwayBillLrStrip
              rows={ewayStripRows}
              onView={onViewEwayBill ?? (() => undefined)}
              onUpload={onUploadEwayBill}
              canUpload={canUploadEwayBill}
              canEdit={canEditEwayBill}
              onSave={onSaveEwayBill}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.bottomText} numberOfLines={1}>
          Trip ID: <Text style={styles.bottomStrong}>{tripIdLabel}</Text>
        </Text>
        <Text style={styles.bottomTextEnd} numberOfLines={1}>
          Placed On: <Text style={styles.bottomStrong}>{createdAtLabel}</Text>
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    width: "100%",
    backgroundColor: CANVAS,
  },
  block: {
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: PAD,
    paddingTop: 12,
    paddingBottom: 14,
  },
  blockFirst: {
    paddingTop: 10,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: INK,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  heroSub: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "400",
    color: MUTED,
  },
  limitsHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "500",
    color: MUTED,
    lineHeight: 16,
  },
  listPad: {
    paddingHorizontal: PAD,
    paddingTop: 8,
    gap: 8,
  },
  ewayWrap: {
    width: "100%",
  },
  emptyCard: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 8,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: INK,
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 12,
    color: BODY,
    lineHeight: 16,
  },
  card: {
    backgroundColor: Theme.cardWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EEEEEE",
  },
  addMoreBtn: {
    marginTop: 10,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  addMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: LINK,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbPreview: {
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E0E0E0",
  },
  thumbOk: {
    backgroundColor: "rgba(21, 128, 61, 0.12)",
  },
  thumbMiss: {
    backgroundColor: "rgba(232, 33, 39, 0.1)",
  },
  thumbWarn: {
    backgroundColor: "#F5F5F5",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  pdfClip: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  pdfBadge: {
    position: "absolute",
    right: 3,
    bottom: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "rgba(33, 33, 33, 0.72)",
  },
  pdfBadgeText: {
    fontSize: 7,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  thumbFallbackLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.4,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardStatus: {
    fontSize: 13,
    fontWeight: "700",
    color: INK,
    marginBottom: 2,
  },
  cardStatusOk: {
    color: Theme.positive,
  },
  cardStatusMiss: {
    color: Theme.teslaRed,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: BODY,
  },
  cardLrNumber: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.2,
  },
  cardLrDate: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  cardDetail: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "400",
    color: MUTED,
    lineHeight: 15,
  },
  cardAction: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
    color: LINK,
  },
  cardActionDisabled: {
    color: MUTED,
  },
  chevronWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bottomBar: {
    marginTop: 8,
    backgroundColor: "#EEEEEE",
    paddingHorizontal: PAD,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  bottomText: {
    fontSize: 10,
    fontWeight: "400",
    color: BODY,
    flexShrink: 1,
  },
  bottomTextEnd: {
    fontSize: 10,
    fontWeight: "400",
    color: BODY,
    flexShrink: 1,
    textAlign: "right",
  },
  bottomStrong: {
    fontWeight: "500",
    color: INK,
  },
});
