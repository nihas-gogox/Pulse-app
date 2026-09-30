import { PartyAvatar } from "@/components/PartyAvatar";
import { TripVaultFilePreview } from "@/features/trips/components/trip-detail/TripVaultFilePreview";
import Theme from "@/constants/Theme";
import { rejectDocument, updateEntityDocumentExpiry, verifyDocument } from "@/features/compliance/services/documents.service";
import {
  guessCompliancePreviewMime,
  signCompliancePreviewUrl,
} from "@/features/tripCompliance/services/complianceDocumentView.service";
import { NoDocumentPreviewEmpty, NoTripsFoundEmpty } from "@/features/tripCompliance/components/ComplianceEmptyState";
import { COMPLIANCE_STATUS_META } from "@/features/tripCompliance/components/ComplianceStatusIcon";
import { ComplianceInputModal, type ComplianceInputField } from "@/features/tripCompliance/components/ComplianceInputModal";
import {
  CompliancePaymentConfirmModal,
  type CompliancePaymentConfirmValues,
} from "@/features/tripCompliance/components/CompliancePaymentConfirmModal";
import { ComplianceRejectRemarkModal } from "@/features/tripCompliance/components/ComplianceRejectRemarkModal";
import { setTripDocumentVerification } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import type { ComplianceLedgerCategory } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import {
  COMPLIANCE_DRIVER_DOCUMENT_TYPES,
  COMPLIANCE_VEHICLE_DOCUMENT_TYPES,
  documentRequiresExpiry,
  type ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";
import {
  formatComplianceTimestamp,
  verificationStatusVisual,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import {
  deriveComplianceDocumentRows,
  deriveEntityComplianceRows,
  deriveFinanceDocumentRows,
  financeVaultDetailLine,
  labelForDocType,
  labelForFinanceDocType,
  mergeFinanceBankDocsFromSupplier,
  requirementScopeLabel,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import { fetchSupplierBankProofBundle } from "@/features/tripCompliance/utils/supplierBankProof.util";
import {
  applyOptimisticDecision,
  canModerateComplianceRow,
  complianceDecisionButtonState,
  complianceReviewDecisionActions,
  recordOptimisticDecision,
  type OptimisticComplianceDecision,
} from "@/features/tripCompliance/utils/complianceReviewActions.util";
import type { ComplianceChange } from "@/features/tripCompliance/services/compliancePipelineSync.service";
import { classifyTripDocument, readTypedDetails } from "@/features/tripCompliance/utils/tripDocumentClassification.util";
import { deriveComplianceQueueReadiness } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { getSupplierBankAccount } from "@/features/suppliers/services/supplierVendorOnboarding.service";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import {
  COMPLIANCE_TRIP_DOC_PICKER_TYPES,
  validateComplianceTripDocumentFile,
} from "@/features/tripCompliance/utils/complianceTripDocumentFormat.util";
import { markTripHardCopyPodReceived } from "@/features/trips/services/tripDocumentLrPod.service";
import {
  formatInvoiceVaultNumberLabel,
  formatLrVaultNumberLabel,
} from "@/features/trips/components/trip-detail/tripDocTypes";
import { uploadTripDocument, type TripDocumentType } from "@/features/trips/services/tripDocuments.service";
import { splitHubRouteLocationDisplay } from "@/features/trips/utils/tripLocationDisplay.util";
import { getTripExecutionModel } from "@/features/trips/domain/tripExecutionModel";
import {
  markVehicleDocumentVerified,
  resolveVehicleDocumentsWriteTarget,
  updateVehicleDocumentExpiry,
} from "@/features/vehicles/services/vehicleDocuments.service";
import type { VehicleComplianceDocType } from "@/features/vehicles/utils/vehicleDocuments.util";
import { formatIndianVehicleNumber } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { SIGNED_URL_CACHE_TTL_MS, SIGNED_URL_EXPIRY_SEC } from "@/lib/storageSignedUrlCache";
import { useComplianceListTripFacts } from "@/features/tripCompliance/hooks/useComplianceListTripFacts";
import { getTripDisplayNumber } from "@/features/trips/services/trips.service";
import { ChevronLeft, ChevronRight, Check, Eye, Minus, Plus, RotateCcw, Upload, X } from "lucide-react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HARD_COPY_POD_FIELDS: ComplianceInputField[] = [
  { key: "courier", label: "Courier", placeholder: "e.g. BlueDart", required: true },
  { key: "awb", label: "AWB / tracking number", required: true },
  { key: "receivedBy", label: "Received by", required: true },
];

const DECLINE_FIELDS: ComplianceInputField[] = [
  {
    key: "reason",
    label: "Note — why is this document being declined?",
    placeholder: "Enter reason",
    required: true,
  },
];

/**
 * Local preview-URL reuse window. Service-level signers already cache URLs until
 * ~2 min before expiry, so a URL we receive may have only that margin left —
 * stay inside it so a cached entry can never outlive its signature.
 */
const PREVIEW_CACHE_TTL_MS = SIGNED_URL_EXPIRY_SEC * 1000 - SIGNED_URL_CACHE_TTL_MS - 30_000;

type PreviewCacheEntry = { url: string; mime: string | null; expiresAtMs: number };

function readPreviewCache(cache: Map<string, PreviewCacheEntry>, path: string): PreviewCacheEntry | null {
  const entry = cache.get(path);
  if (!entry) return null;
  if (entry.expiresAtMs <= Date.now()) {
    cache.delete(path);
    return null;
  }
  return entry;
}

function writePreviewCache(cache: Map<string, PreviewCacheEntry>, path: string, url: string, mime: string | null) {
  cache.set(path, { url, mime, expiresAtMs: Date.now() + PREVIEW_CACHE_TTL_MS });
}

type DocTab = "trip" | "vehicle" | "driver";
type ChecklistPreviewMode = "document" | "trip" | "advance" | "finance";

const TABS: { key: DocTab; label: string }[] = [
  { key: "trip", label: "Trip" },
  { key: "vehicle", label: "Vehicle" },
  { key: "driver", label: "Driver" },
];

const TAB_VAULT_COPY: Record<
  DocTab,
  { vaultLabel: string; vaultHint: string; unassignedTitle: string; unassignedHint: string }
> = {
  trip: {
    vaultLabel: "Trip vault",
    vaultHint: "Upload these from the trip asset vault to continue compliance",
    unassignedTitle: "",
    unassignedHint: "",
  },
  vehicle: {
    vaultLabel: "Vehicle vault",
    vaultHint: "Upload these from the vehicle asset vault for this trip",
    unassignedTitle: "No vehicle assigned",
    unassignedHint: "Assign a vehicle to this trip to manage vehicle compliance documents.",
  },
  driver: {
    vaultLabel: "Driver vault",
    vaultHint: "Upload these from the driver asset vault for this trip",
    unassignedTitle: "No driver assigned",
    unassignedHint: "Assign a driver to this trip to manage driver compliance documents.",
  },
};

function rowsForTab(summary: ComplianceTripSummary, tab: DocTab): ComplianceDocRow[] {
  if (tab === "vehicle") return deriveEntityComplianceRows(COMPLIANCE_VEHICLE_DOCUMENT_TYPES, summary.vehicleDocuments);
  if (tab === "driver") return deriveEntityComplianceRows(COMPLIANCE_DRIVER_DOCUMENT_TYPES, summary.driverDocuments);
  return deriveComplianceDocumentRows(summary.documents);
}

/** Entity doc approve/decline changes that vehicle's or driver's docs — shared by every trip using it. */
function entityDocumentChange(doc: { entity_type: "vehicle" | "driver"; entity_id: string }): ComplianceChange {
  return doc.entity_type === "driver"
    ? { type: "driverDocuments", driverId: doc.entity_id }
    : { type: "vehicleDocuments", vehicleId: doc.entity_id };
}

/** Row has reviewable content: a present trip doc (per classifier) or an entity file. */
function hasFile(row: ComplianceDocRow): boolean {
  if (row.doc) return classifyTripDocument(row.doc).present;
  if (row.entityDoc?.storage_path) return true;
  // Supplier bank account details (no proof scan) still open the Bank Docs panel.
  return row.type === "bank_docs" && Boolean(row.entityDoc?.notes?.trim());
}

/** Typed-details lines for a details-only trip doc; null when there is a binary to preview instead. */
function typedDetailsLines(row: ComplianceDocRow | null): { label: string; value: string }[] | null {
  const doc = row?.doc;
  if (!doc || classifyTripDocument(doc).kind !== "details") return null;
  return readTypedDetails(doc.document_number);
}

function originalDocumentSize(
  natural: { width: number; height: number },
  zoom: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(natural.width * zoom)),
    height: Math.max(1, Math.round(natural.height * zoom)),
  };
}

function OriginalDocumentPreview({
  uri,
  isPdf,
  zoom,
  label,
}: {
  uri: string;
  isPdf: boolean;
  zoom: number;
  label: string;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setNatural(null);
    if (isPdf) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setNatural({ width, height });
      },
      () => {
        if (!cancelled) setNatural(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uri, isPdf]);

  const fitted = useMemo(
    () => (natural ? originalDocumentSize(natural, zoom) : null),
    [natural, zoom],
  );
  const display =
    isPdf && box.width > 1 && box.height > 1
      ? { width: box.width, height: box.height }
      : fitted;
  const overflows = Boolean(display && (display.width > box.width + 1 || display.height > box.height + 1));

  return (
    <View
      style={styles.stageBody}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {display ? (
        <PreviewScroller box={box} contentWidth={display.width} contentHeight={display.height} overflows={overflows}>
          {isPdf ? (
            <TripVaultFilePreview
              uri={uri}
              isPdf
              showToolbar
              zoom={zoom}
              sizing="original"
              style={display}
              accessibilityLabel={label}
            />
          ) : (
            <Image
              source={{ uri }}
              style={display}
              resizeMode="contain"
              accessibilityLabel={label}
              onLoad={(event) => {
                const source = event.nativeEvent.source;
                if (source?.width > 0 && source?.height > 0) {
                  setNatural((prev) =>
                    prev?.width === source.width && prev?.height === source.height
                      ? prev
                      : { width: source.width, height: source.height },
                  );
                }
              }}
            />
          )}
        </PreviewScroller>
      ) : null}
    </View>
  );
}

const MIN_PREVIEW_ZOOM = 0.5;
const MAX_PREVIEW_ZOOM = 3;

function clampPreviewZoom(value: number): number {
  return Math.min(MAX_PREVIEW_ZOOM, Math.max(MIN_PREVIEW_ZOOM, value));
}

function clampPreviewPan(
  x: number,
  y: number,
  scale: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (scale <= 1 || width <= 0 || height <= 0) return { x: 0, y: 0 };
  const maxX = ((scale - 1) * width) / 2;
  const maxY = ((scale - 1) * height) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

/** Reads /Count from the existing PDF bytes. Does not modify the file. */
async function readPdfPageCount(uri: string): Promise<number | null> {
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const text = new TextDecoder("iso-8859-1").decode(await response.arrayBuffer());
    let count = 0;
    const pages = /\/Type\s*\/Pages\b/g;
    let match: RegExpExecArray | null;
    while ((match = pages.exec(text))) {
      const after = text.slice(match.index, match.index + 240);
      const before = text.slice(Math.max(0, match.index - 240), match.index);
      const found = after.match(/\/Count\s+(\d+)/) ?? before.match(/\/Count\s+(\d+)\D*$/);
      if (found) count = Math.max(count, Number(found[1]));
    }
    if (count > 0) return count;
    const leaves = text.match(/\/Type\s*\/Page(?!s)\b/g);
    return leaves && leaves.length > 0 ? leaves.length : null;
  } catch {
    return null;
  }
}

export function DocumentScreen({
  visible,
  uri,
  isPdf,
  title,
  onClose,
  presentation = "sheet",
}: {
  visible: boolean;
  uri: string;
  isPdf: boolean;
  title: string;
  onClose: () => void;
  /** `page` fills the screen. `sheet` stays a centered card. */
  presentation?: "sheet" | "page";
}) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const stageRef = useRef<View>(null);
  const closeRef = useRef<View>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const viewRef = useRef({ scale: 1, panX: 0, panY: 0 });
  viewRef.current = { scale, panX: pan.x, panY: pan.y };
  const compact = windowWidth < 720;
  const sheetWidth = Math.min(1080, windowWidth - Math.max(insets.left, 12) - Math.max(insets.right, 12) - (compact ? 16 : 48));
  const sheetHeight = Math.min(windowHeight - insets.top - insets.bottom - (compact ? 16 : 48), compact ? windowHeight : 880);
  const frameWidth = presentation === "page" ? windowWidth - Math.max(insets.left, 8) - Math.max(insets.right, 8) : sheetWidth;
  const frameHeight = presentation === "page" ? windowHeight - Math.max(insets.top, 8) - Math.max(insets.bottom, 8) : sheetHeight;

  const applyView = useCallback((nextScale: number, nextPan: { x: number; y: number }, size = frame) => {
    const zoom = clampPreviewZoom(nextScale);
    setScale(zoom);
    setPan(clampPreviewPan(nextPan.x, nextPan.y, zoom, size.width, size.height));
  }, [frame]);

  useEffect(() => {
    if (!visible) return;
    setScale(1);
    setPan({ x: 0, y: 0 });
    setPage(1);
    setPageCount(null);
  }, [visible, uri]);

  useEffect(() => {
    if (!visible || !isPdf) return;
    let cancelled = false;
    void readPdfPageCount(uri).then((count) => {
      if (!cancelled && count) setPageCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, isPdf, uri]);

  useEffect(() => {
    if (pageCount != null && page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const blockWheel = (event: WheelEvent) => {
      event.preventDefault();
    };
    window.addEventListener("wheel", blockWheel, { passive: false });
    const frameId = requestAnimationFrame(() => {
      const closeNode = closeRef.current as unknown as HTMLElement | null;
      closeNode?.focus?.();
    });
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("wheel", blockWheel);
      cancelAnimationFrame(frameId);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || frame.width <= 0 || Platform.OS !== "web") return;
    const node = stageRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
      const current = viewRef.current;
      const next = clampPreviewZoom(current.scale * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
      const ratio = next / current.scale;
      applyView(
        next,
        {
          x: cursorX - ratio * (cursorX - current.panX),
          y: cursorY - ratio * (cursorY - current.panY),
        },
        { width: rect.width, height: rect.height },
      );
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (isPdf) return;
      const rect = node.getBoundingClientRect();
      const current = viewRef.current;
      if (current.scale >= 1.99) {
        applyView(1, { x: 0, y: 0 }, { width: rect.width, height: rect.height });
        return;
      }
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
      const ratio = 2 / current.scale;
      applyView(
        2,
        {
          x: cursorX - ratio * (cursorX - current.panX),
          y: cursorY - ratio * (cursorY - current.panY),
        },
        { width: rect.width, height: rect.height },
      );
    };
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const current = viewRef.current;
        applyView(current.scale + 0.25, { x: current.panX, y: current.panY });
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        const current = viewRef.current;
        applyView(current.scale - 0.25, { x: current.panX, y: current.panY });
      } else if (event.key === "0") {
        event.preventDefault();
        applyView(1, { x: 0, y: 0 });
      } else if (isPdf && event.key === "ArrowLeft") {
        event.preventDefault();
        setPage((value) => Math.max(1, value - 1));
        setPan({ x: 0, y: 0 });
      } else if (isPdf && event.key === "ArrowRight") {
        event.preventDefault();
        setPage((value) => Math.min(pageCount ?? 40, value + 1));
        setPan({ x: 0, y: 0 });
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, frame.width, frame.height, isPdf, onClose, pageCount, applyView]);

  const pageLimit = pageCount ?? 40;
  const atFirstPage = page <= 1;
  const atLastPage = page >= pageLimit;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[styles.screenRoot, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 8) }]}
        accessibilityViewIsModal
      >
        <Pressable style={styles.screenBackdrop} onPress={onClose} accessibilityLabel="Close document preview" />
        <View style={[styles.screenSheet, { width: frameWidth, height: frameHeight }]}>
          <View style={[styles.screenBar, compact && styles.screenBarCompact]}>
            <Text style={styles.screenTitle} numberOfLines={1}>{title}</Text>
            {isPdf ? (
              <View style={styles.screenPages}>
                <Pressable
                  style={styles.screenTool}
                  onPress={() => {
                    setPage((value) => Math.max(1, value - 1));
                    setPan({ x: 0, y: 0 });
                  }}
                  disabled={atFirstPage}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                  accessibilityState={{ disabled: atFirstPage }}
                  {...(Platform.OS === "web" ? { title: "Previous page" } : {})}
                >
                  <ChevronLeft size={16} color={atFirstPage ? Theme.textMuted : Theme.textPrimaryDark} />
                </Pressable>
                <Text style={styles.screenPageLabel} accessibilityLabel={pageCount ? `Page ${page} of ${pageCount}` : `Page ${page}`}>
                  {pageCount ? `${page} / ${pageCount}` : `${page}`}
                </Text>
                <Pressable
                  style={styles.screenTool}
                  onPress={() => {
                    setPage((value) => Math.min(pageLimit, value + 1));
                    setPan({ x: 0, y: 0 });
                  }}
                  disabled={atLastPage}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                  accessibilityState={{ disabled: atLastPage }}
                  {...(Platform.OS === "web" ? { title: "Next page" } : {})}
                >
                  <ChevronRight size={16} color={atLastPage ? Theme.textMuted : Theme.textPrimaryDark} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.screenTools}>
              <Pressable
                style={styles.screenTool}
                onPress={() => applyView(scale - 0.25, pan)}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                {...(Platform.OS === "web" ? { title: "Zoom out" } : {})}
              >
                <Minus size={16} color={Theme.textPrimaryDark} />
              </Pressable>
              <Text style={styles.screenPercent} accessibilityLabel={`Zoom ${Math.round(scale * 100)} percent`}>
                {Math.round(scale * 100)}%
              </Text>
              <Pressable
                style={styles.screenTool}
                onPress={() => applyView(scale + 0.25, pan)}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                {...(Platform.OS === "web" ? { title: "Zoom in" } : {})}
              >
                <Plus size={16} color={Theme.textPrimaryDark} />
              </Pressable>
              <Pressable
                style={styles.screenTool}
                onPress={() => applyView(1, { x: 0, y: 0 })}
                accessibilityRole="button"
                accessibilityLabel="Reset zoom"
                {...(Platform.OS === "web" ? { title: "Reset zoom" } : {})}
              >
                <RotateCcw size={15} color={Theme.textPrimaryDark} />
              </Pressable>
              <Pressable
                ref={closeRef}
                style={styles.screenClose}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                {...(Platform.OS === "web" ? { title: "Close" } : {})}
              >
                <X size={16} color={Theme.textPrimaryDark} />
              </Pressable>
            </View>
          </View>
          <View
            ref={stageRef}
            style={[styles.screenStage, Platform.OS === "web" ? ({ cursor: scale > 1 ? "grab" : "default" } as ViewStyle) : null]}
            accessibilityLabel={isPdf ? "PDF preview. Scroll to zoom." : "Image preview. Scroll to zoom. Double-click to zoom."}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setFrame((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
            }}
            onStartShouldSetResponder={() => scale > 1}
            onResponderGrant={(event) => {
              drag.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, panX: pan.x, panY: pan.y };
            }}
            onResponderMove={(event) => {
              if (!drag.current || viewRef.current.scale <= 1) return;
              const next = clampPreviewPan(
                drag.current.panX + event.nativeEvent.pageX - drag.current.x,
                drag.current.panY + event.nativeEvent.pageY - drag.current.y,
                viewRef.current.scale,
                frame.width,
                frame.height,
              );
              setPan(next);
            }}
            onResponderRelease={() => {
              drag.current = null;
            }}
          >
            <View
              pointerEvents="none"
              style={[styles.screenPage, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }] }]}
            >
              {isPdf ? (
                <TripVaultFilePreview
                  uri={uri}
                  isPdf
                  showToolbar={false}
                  sizing="fit"
                  zoom={1}
                  page={page}
                  style={styles.screenFile}
                  accessibilityLabel={title}
                />
              ) : (
                <Image source={{ uri }} style={styles.screenFile} resizeMode="contain" accessibilityLabel={title} />
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PreviewScroller({
  box,
  contentWidth,
  contentHeight,
  overflows,
  children,
}: {
  box: { width: number; height: number };
  contentWidth: number;
  contentHeight: number;
  overflows: boolean;
  children: React.ReactNode;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.stageScroll, Platform.OS === "web" ? ({ overflow: "auto" } as ViewStyle) : null]}>
        <View style={overflows ? { width: contentWidth, height: contentHeight } : [styles.stageScrollCenter, styles.stageFill]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.stageScroll}
      nestedScrollEnabled
      contentContainerStyle={overflows ? styles.stageScrollStart : styles.stageScrollCenter}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        style={{ height: Math.max(contentHeight, box.height) }}
        contentContainerStyle={overflows ? styles.stageScrollStart : [styles.stageScrollCenter, { minWidth: box.width }]}
      >
        {children}
      </ScrollView>
    </ScrollView>
  );
}

export function ComplianceDocumentWorkspace({
  summaries,
  organizationId,
  actorId,
  canVerify,
  canViewDocuments,
  onChanged,
  stacked = false,
  style,
  canManageFinance = false,
  canManagePod = false,
  onPay,
  onConfirmPayment,
  paymentSubmitting = false,
  onRejectCompliance,
  onMarkComplianceVerified,
  selectedTripId = null,
  onReviewTripDocs,
}: {
  summaries: ComplianceTripSummary[];
  organizationId: string;
  actorId: string | null;
  canVerify: boolean;
  canViewDocuments: boolean;
  /** Exactly what changed, so the pipeline patches only the affected inputs. */
  onChanged: (change: ComplianceChange) => void;
  stacked?: boolean;
  style?: StyleProp<ViewStyle>;
  canManageFinance?: boolean;
  /** Log hard-copy POD — Compliance role (and owner/admin) only. */
  canManagePod?: boolean;
  onPay?: (summary: ComplianceTripSummary) => void;
  /** Inline Confirm payment from Advance Payment panel (no popup). */
  onConfirmPayment?: (
    summary: ComplianceTripSummary,
    category: ComplianceLedgerCategory,
    values: CompliancePaymentConfirmValues,
  ) => void | Promise<void>;
  paymentSubmitting?: boolean;
  /** Reject a verified trip with a remark (keeps Verified stage, red card). */
  onRejectCompliance?: (tripId: string, reason: string) => Promise<void>;
  /** Marks the trip Compliance Verified once all required docs are approved. */
  onMarkComplianceVerified?: (tripId: string) => Promise<void>;
  /** Trip to show when opening the card view from the table. */
  selectedTripId?: string | null;
  /** Open document review for upload — trip / vehicle / driver vault. */
  onReviewTripDocs?: (
    tripId: string,
    documentKey: string | null,
    scope?: "trip" | "vehicle" | "driver",
  ) => void;
}) {
  const listRef = useRef<ScrollView>(null);
  const scrolledTripId = useRef<string | null>(null);
  const { truckTypeByVehicleId, supplierNameByTripId } = useComplianceListTripFacts(
    summaries,
    organizationId,
  );
  const [selectedId, setSelectedId] = useState<string | null>(selectedTripId ?? summaries[0]?.trip.id ?? null);
  const [tab, setTab] = useState<DocTab>("trip");
  const [docIndex, setDocIndex] = useState(0);
  const [checklistKey, setChecklistKey] = useState<string | null>(null);
  const [checklistPreviewMode, setChecklistPreviewMode] = useState<ChecklistPreviewMode>("document");
  const [zoom, setZoom] = useState(1);
  const [screenOpen, setScreenOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingFinanceType, setUploadingFinanceType] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [expiryPrompt, setExpiryPrompt] = useState<{
    docType: string;
    resolve: (value: string | null) => void;
  } | null>(null);
  /** Optimistic decisions so Approve/Decline feel instant before pipeline refetch. */
  const [localDecisionByKey, setLocalDecisionByKey] = useState<
    Record<string, OptimisticComplianceDecision>
  >({});
  const previewCacheRef = useRef<Map<string, PreviewCacheEntry>>(new Map());
  const decisionAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summary = summaries.find((item) => item.trip.id === selectedId) ?? summaries[0] ?? null;
  const isPendingDocsTrip = Boolean(summary && verificationStatusVisual(summary).kind === "pending_docs");
  const rows = useMemo(() => (summary ? rowsForTab(summary, tab) : []), [summary, tab]);
  const entityUnassigned =
    (tab === "vehicle" && !summary?.trip.vehicle_id) ||
    (tab === "driver" && !summary?.trip.driver_id);
  /** Same dual-pane shell (tabs + upload pill + list | preview) on every tab and stage. */
  const showDocumentShell = Boolean(summary);
  const showEntityUnassigned = Boolean(summary && entityUnassigned);
  /** Trip/Vehicle/Driver list always uses vault rows inside the shared shell. */
  const checklistRows = useMemo(() => {
    if (!showDocumentShell || showEntityUnassigned) return [];
    return rows;
  }, [showDocumentShell, showEntityUnassigned, rows]);
  const [supplierBankProof, setSupplierBankProof] = useState<{
    previewPath: string | null;
    detailLine: string | null;
    kycDocId: string | null;
    supplierId: string | null;
    status: string | null;
    fileName: string | null;
    createdAt: string | null;
    accountNumber: string | null;
    ifsc: string | null;
    bankName: string | null;
    onFile: boolean;
  } | null>(null);
  const [supplierBankLoading, setSupplierBankLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const orgId = (summary?.trip.organization_id ?? organizationId ?? "").trim();
    const supplierId = (summary?.trip.supplier_id ?? "").trim();
    if (!summary || !orgId || !supplierId) {
      setSupplierBankProof(null);
      setSupplierBankLoading(false);
      return;
    }
    setSupplierBankLoading(true);
    void fetchSupplierBankProofBundle(orgId, supplierId)
      .then((bundle) => {
        if (cancelled) return;
        setSupplierBankProof({
          previewPath: bundle.previewPath,
          detailLine: bundle.detailLine,
          kycDocId: bundle.kycDoc?.id ?? null,
          supplierId,
          status: bundle.kycDoc?.status ?? null,
          fileName: bundle.kycDoc?.file_name ?? null,
          createdAt: bundle.kycDoc?.updated_at ?? bundle.kycDoc?.created_at ?? null,
          accountNumber: bundle.account?.account_number?.trim() ?? null,
          ifsc: bundle.account?.ifsc_code?.trim() ?? null,
          bankName: bundle.account?.bank_name?.trim() ?? null,
          onFile: bundle.onFile,
        });
      })
      .finally(() => {
        if (!cancelled) setSupplierBankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    summary?.trip.id,
    summary?.trip.organization_id,
    summary?.trip.supplier_id,
    organizationId,
    summary,
    checklistPreviewMode,
  ]);

  const financeRows = useMemo(() => {
    if (!summary) return [];
    const base = deriveFinanceDocumentRows(summary.documents);
    return mergeFinanceBankDocsFromSupplier(base, supplierBankProof);
  }, [summary, supplierBankProof]);
  const isFinanceMode = checklistPreviewMode === "finance";
  const listRows = isFinanceMode ? financeRows : checklistRows;
  const reviewScope: DocTab = isFinanceMode ? "trip" : tab;
  const checklistSelectedRow = useMemo(() => {
    if (!showDocumentShell || showEntityUnassigned) return null;
    if (isFinanceMode) {
      return financeRows.find((row) => row.key === checklistKey) ?? null;
    }
    return checklistRows.find((row) => row.key === checklistKey) ?? null;
  }, [
    showDocumentShell,
    showEntityUnassigned,
    isFinanceMode,
    checklistRows,
    financeRows,
    checklistKey,
  ]);
  const previewable = useMemo(() => {
    if (!showDocumentShell || showEntityUnassigned) return [];
    return listRows.filter(hasFile);
  }, [showDocumentShell, showEntityUnassigned, listRows]);
  const activeRow = !showDocumentShell || showEntityUnassigned
    ? null
    : checklistSelectedRow && hasFile(checklistSelectedRow)
      ? checklistSelectedRow
      : null;
  const effectiveActiveRow = useMemo(() => {
    if (!activeRow) return null;
    return applyOptimisticDecision(activeRow, localDecisionByKey[activeRow.key]);
  }, [activeRow, localDecisionByKey]);
  const decisionButtons = useMemo(
    () => complianceDecisionButtonState(effectiveActiveRow),
    [effectiveActiveRow],
  );
  const decisions = useMemo(() => {
    if (!effectiveActiveRow || !canModerateComplianceRow(effectiveActiveRow, reviewScope)) {
      return { canApprove: false, canDecline: false };
    }
    return complianceReviewDecisionActions(effectiveActiveRow);
  }, [effectiveActiveRow, reviewScope]);
  const canAct = Boolean(canVerify && actorId && !busy);

  useEffect(() => {
    if (selectedTripId && summaries.some((item) => item.trip.id === selectedTripId)) {
      setSelectedId(selectedTripId);
      return;
    }
    if (!summaries.some((item) => item.trip.id === selectedId)) {
      setSelectedId(summaries[0]?.trip.id ?? null);
    }
  }, [summaries, selectedId, selectedTripId]);

  useEffect(() => {
    if (decisionAdvanceTimerRef.current) {
      clearTimeout(decisionAdvanceTimerRef.current);
      decisionAdvanceTimerRef.current = null;
    }
    setDocIndex(0);
    setZoom(1);
    setChecklistPreviewMode("document");
    setDeclineOpen(false);
    setRejectOpen(false);
    setLocalDecisionByKey({});
    setExpiryPrompt((prev) => {
      prev?.resolve(null);
      return null;
    });
  }, [summary?.trip.id, tab]);

  useEffect(() => {
    return () => {
      if (decisionAdvanceTimerRef.current) {
        clearTimeout(decisionAdvanceTimerRef.current);
        decisionAdvanceTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showDocumentShell || showEntityUnassigned) {
      setChecklistKey(null);
      return;
    }
    const pool = checklistPreviewMode === "finance" ? financeRows : checklistRows;
    setChecklistKey((prev) => {
      if (prev && pool.some((row) => row.key === prev)) return prev;
      const firstWithFile = pool.find(hasFile);
      const firstMissing = pool.find((row) => row.status === "missing");
      return firstWithFile?.key ?? firstMissing?.key ?? pool[0]?.key ?? null;
    });
  }, [
    showDocumentShell,
    showEntityUnassigned,
    checklistPreviewMode,
    checklistRows,
    financeRows,
    summary?.trip.id,
    tab,
  ]);

  const activePreviewPath =
    activeRow?.doc?.storage_path ?? activeRow?.entityDoc?.storage_path ?? null;
  const activePreviewSource =
    activeRow?.entityDoc?.source === "supplier-kyc" && !activeRow?.doc
      ? "supplier-kyc"
      : reviewScope === "trip"
        ? "trip"
        : activeRow?.entityDoc?.source;
  const activePreviewEntityId =
    activeRow?.entityDoc?.entity_id ??
    (reviewScope === "vehicle" ? summary?.trip.vehicle_id : summary?.trip.driver_id) ??
    summary?.trip.id ??
    null;
  const activePreviewDocType = activeRow?.type ?? null;
  const activePreviewSourceEntityId = activeRow?.doc?.source_entity_document_id ?? null;
  const activePreviewMimeHint = activeRow?.doc?.mime_type ?? null;
  // Details-only trip docs have no binary to sign — they render via typedDetailsLines.
  const activePreviewHasBinary = !activeRow?.doc || classifyTripDocument(activeRow.doc).hasBinary;

  useEffect(() => {
    if (!activePreviewPath || !activePreviewHasBinary || !canViewDocuments || !organizationId) {
      setPreviewUrl(null);
      setPreviewMime(null);
      setLoadingPreview(false);
      return;
    }
    const cached = readPreviewCache(previewCacheRef.current, activePreviewPath);
    if (cached) {
      setPreviewUrl(cached.url);
      setPreviewMime(cached.mime);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    void signCompliancePreviewUrl({
      storagePath: activePreviewPath,
      source: activePreviewSource,
      sourceEntityDocumentId: activePreviewSourceEntityId,
      organizationId,
      entityId: activePreviewEntityId,
      docType: activePreviewDocType,
    }).then((url) => {
      if (cancelled) return;
      const mime = guessCompliancePreviewMime(activePreviewPath, activePreviewMimeHint);
      if (url) {
        writePreviewCache(previewCacheRef.current, activePreviewPath, url, mime);
      }
      setPreviewUrl(url);
      setPreviewMime(mime);
      setLoadingPreview(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activePreviewPath,
    activePreviewHasBinary,
    activePreviewSource,
    activePreviewSourceEntityId,
    activePreviewEntityId,
    activePreviewDocType,
    activePreviewMimeHint,
    canViewDocuments,
    organizationId,
  ]);

  // Prefetch the next file so Approve → Next feels instant.
  useEffect(() => {
    if (!canViewDocuments || !organizationId || previewable.length < 2) return;
    const nextRow = previewable[(docIndex + 1) % previewable.length];
    if (nextRow?.doc && !classifyTripDocument(nextRow.doc).hasBinary) return;
    const path = nextRow?.doc?.storage_path ?? nextRow?.entityDoc?.storage_path ?? null;
    if (!path || readPreviewCache(previewCacheRef.current, path)) return;
    let cancelled = false;
    void signCompliancePreviewUrl({
      storagePath: path,
      source:
        nextRow.entityDoc?.source === "supplier-kyc" && !nextRow.doc
          ? "supplier-kyc"
          : reviewScope === "trip"
            ? "trip"
            : nextRow.entityDoc?.source,
      sourceEntityDocumentId: nextRow.doc?.source_entity_document_id,
      organizationId,
      entityId:
        nextRow.entityDoc?.entity_id ??
        (reviewScope === "vehicle" ? summary?.trip.vehicle_id : summary?.trip.driver_id) ??
        summary?.trip.id,
      docType: nextRow.type,
    }).then((url) => {
      if (cancelled || !url) return;
      writePreviewCache(previewCacheRef.current, path, url, guessCompliancePreviewMime(path, nextRow.doc?.mime_type));
    });
    return () => {
      cancelled = true;
    };
  }, [
    canViewDocuments,
    organizationId,
    previewable,
    docIndex,
    reviewScope,
    summary?.trip.id,
    summary?.trip.vehicle_id,
    summary?.trip.driver_id,
  ]);

  const goNext = () => {
    if (previewable.length === 0) return;
    if (showDocumentShell) {
      const current = Math.max(
        0,
        previewable.findIndex((row) => row.key === checklistKey),
      );
      const next = previewable[(current + 1) % previewable.length];
      if (next) {
        setChecklistKey(next.key);
        setChecklistPreviewMode((prev) => (prev === "finance" ? "finance" : "document"));
      }
      setZoom(1);
      return;
    }
    setDocIndex((index) => (index + 1) % previewable.length);
    setZoom(1);
  };
  const goPrev = () => {
    if (previewable.length === 0) return;
    if (showDocumentShell) {
      const current = Math.max(
        0,
        previewable.findIndex((row) => row.key === checklistKey),
      );
      const prev = previewable[(current - 1 + previewable.length) % previewable.length];
      if (prev) {
        setChecklistKey(prev.key);
        setChecklistPreviewMode((mode) => (mode === "finance" ? "finance" : "document"));
      }
      setZoom(1);
      return;
    }
    setDocIndex((index) => (index - 1 + previewable.length) % previewable.length);
    setZoom(1);
  };

  /** Local UI follow-up only — each approve/decline branch sends its own typed ComplianceChange. */
  const finishDecision = useCallback(
    (row: ComplianceDocRow, decision: OptimisticComplianceDecision["decision"]) => {
      setLocalDecisionByKey((prev) => ({ ...prev, [row.key]: recordOptimisticDecision(row, decision) }));
      setDeclineOpen(false);
      setBusy(false);

      const advanceToNext = () => {
        if (previewable.length <= 1) return;
        if (showDocumentShell) {
          const current = Math.max(
            0,
            previewable.findIndex((item) => item.key === row.key),
          );
          const ordered = [
            ...previewable.slice(current + 1),
            ...previewable.slice(0, current),
          ];
          const next =
            ordered.find((item) => {
              if (item.key === row.key) return false;
              const status = applyOptimisticDecision(item, localDecisionByKey[item.key]).status;
              // Prefer the next file that still needs a first decision.
              return status !== "verified" && status !== "rejected";
            }) ?? ordered[0];
          if (next) {
            setChecklistKey(next.key);
            setChecklistPreviewMode((mode) => (mode === "finance" ? "finance" : "document"));
          }
        } else {
          setDocIndex((index) => (index + 1) % previewable.length);
        }
        setZoom(1);
      };

      if (decisionAdvanceTimerRef.current) {
        clearTimeout(decisionAdvanceTimerRef.current);
      }
      // Brief pause so Approve/Decline can flip to Approved/Declined before moving on.
      decisionAdvanceTimerRef.current = setTimeout(advanceToNext, 420);
    },
    [previewable, showDocumentShell, localDecisionByKey],
  );

  const promptExpiryDate = useCallback((docType: string) => {
    return new Promise<string | null>((resolve) => {
      setExpiryPrompt({ docType, resolve });
    });
  }, []);

  const approve = async () => {
    if (!summary || !activeRow || busy) return;
    if (!canVerify) {
      alertMessage("Can't approve", "You don't have permission to verify compliance documents.");
      return;
    }
    if (!actorId) {
      alertMessage("Can't approve", "Sign in again, then try Approve.");
      return;
    }
    if (!decisions.canApprove || !canModerateComplianceRow(activeRow, reviewScope)) {
      alertMessage("Can't approve", "This document isn't ready to approve yet.");
      return;
    }

    const tripId = summary.trip.id;
    const row = activeRow;
    const existingExpiry = row.entityDoc?.expiry_date?.trim() ?? "";
    let expiryDate = existingExpiry;
    let enteredNewExpiry = false;

    if (reviewScope !== "trip" && documentRequiresExpiry(row.type) && !expiryDate) {
      const entered = await promptExpiryDate(row.type);
      if (!entered) return;
      const trimmed = entered.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        alertMessage("Invalid expiry date", "Use YYYY-MM-DD (for example 2027-03-15).");
        return;
      }
      expiryDate = trimmed;
      enteredNewExpiry = true;
    }

    setBusy(true);
    try {
      if (reviewScope === "trip") {
        if (!row.doc) {
          alertMessage("Couldn't approve document", "This trip document has no uploaded file.");
          return;
        }
        const { error } = await setTripDocumentVerification({
          document: row.doc,
          organizationId,
          actorId,
          status: "verified",
        });
        if (error) {
          alertMessage("Couldn't approve document", error.message);
          return;
        }
        onChanged({ type: "tripDocumentDecision", tripId, documentId: row.doc.id, status: "verified", actorId });
      } else if (row.entityDoc?.source === "vehicle-vault" && summary.trip.vehicle_id) {
        const vehicleId = summary.trip.vehicle_id;
        if (enteredNewExpiry) {
          const { error } = await updateVehicleDocumentExpiry(
            organizationId,
            vehicleId,
            row.type as VehicleComplianceDocType,
            expiryDate,
            null,
          );
          if (error) {
            // Cross-org vault write may fail — retry against the vehicle's owning org.
            const resolved = await resolveVehicleDocumentsWriteTarget(vehicleId, [organizationId]);
            if (!resolved) {
              alertMessage(
                "Couldn't approve document",
                error.message ||
                  "Could not save the expiry date on this vehicle. Re-upload with an expiry date, then Approve.",
              );
              return;
            }
            const retry = await updateVehicleDocumentExpiry(
              resolved.orgId,
              vehicleId,
              row.type as VehicleComplianceDocType,
              expiryDate,
              resolved.documents,
            );
            if (retry.error) {
              alertMessage("Couldn't approve document", retry.error.message);
              return;
            }
          }
        }
        const marked = await markVehicleDocumentVerified(organizationId, vehicleId, row.type);
        if (marked.error) {
          alertMessage("Couldn't approve document", marked.error.message);
          return;
        }
        onChanged({ type: "vehicleDocuments", vehicleId });
      } else if (row.entityDoc?.id && row.entityDoc.source !== "driver-kyc") {
        if (enteredNewExpiry) {
          const { error: expiryError } = await updateEntityDocumentExpiry(row.entityDoc.id, expiryDate);
          if (expiryError) {
            alertMessage("Couldn't approve document", expiryError.message);
            return;
          }
        }
        const { error } = await verifyDocument(row.entityDoc.id, actorId);
        if (error) {
          alertMessage("Couldn't approve document", error.message);
          return;
        }
        onChanged(entityDocumentChange(row.entityDoc));
      } else {
        alertMessage("Couldn't approve document", "This document can't be approved from this preview.");
        return;
      }
      finishDecision(row, "verified");
    } finally {
      setBusy(false);
    }
  };

  const declineWithReason = async (reason: string) => {
    if (!summary || !activeRow || busy) return;
    if (!canVerify) {
      alertMessage("Can't decline", "You don't have permission to verify compliance documents.");
      return;
    }
    if (!actorId) {
      alertMessage("Can't decline", "Sign in again, then try Decline.");
      return;
    }
    if (!decisions.canDecline || !canModerateComplianceRow(activeRow, reviewScope)) {
      alertMessage("Can't decline", "This document isn't ready to decline yet.");
      return;
    }
    const note = reason.trim();
    if (!note) {
      alertMessage("Can't decline", "A rejection reason is required.");
      return;
    }

    const tripId = summary.trip.id;
    const row = activeRow;

    setDeclineOpen(false);
    setBusy(true);
    try {
      if (reviewScope === "trip") {
        if (!row.doc) {
          alertMessage("Couldn't decline document", "This trip document has no uploaded file.");
          return;
        }
        const { error } = await setTripDocumentVerification({
          document: row.doc,
          organizationId,
          actorId,
          status: "rejected",
          rejectionReason: note,
        });
        if (error) {
          alertMessage("Couldn't decline document", error.message);
          setDeclineOpen(true);
          return;
        }
        onChanged({
          type: "tripDocumentDecision",
          tripId,
          documentId: row.doc.id,
          status: "rejected",
          actorId,
          rejectionReason: note,
        });
      } else if (row.entityDoc?.source === "vehicle-vault") {
        alertMessage(
          "Couldn't decline document",
          "Replace this file from the vehicle vault, or upload a new copy.",
        );
        return;
      } else if (row.entityDoc?.id && row.entityDoc.source !== "driver-kyc") {
        const { error } = await rejectDocument(row.entityDoc.id, note);
        if (error) {
          alertMessage("Couldn't decline document", error.message);
          setDeclineOpen(true);
          return;
        }
        onChanged(entityDocumentChange(row.entityDoc));
      } else {
        alertMessage("Couldn't decline document", "This document can't be declined from this preview.");
        return;
      }
      finishDecision(row, "rejected");
    } finally {
      setBusy(false);
    }
  };
  const docTitle = activeRow
    ? isFinanceMode
      ? labelForFinanceDocType(activeRow.type)
      : labelForDocType(activeRow.type)
    : "No document";
  const isPdf = (previewMime ?? "").includes("pdf");
  const readiness = summary ? deriveComplianceQueueReadiness(summary) : null;
  const typedLines = typedDetailsLines(activeRow);
  const financeBankSelected =
    isFinanceMode && checklistSelectedRow?.type === "bank_docs";
  const supplierBankAccountRows =
    financeBankSelected && supplierBankProof
      ? (
          [
            {
              label: "Account number",
              value: supplierBankProof.accountNumber?.trim() || "",
            },
            { label: "IFSC", value: supplierBankProof.ifsc?.trim() || "" },
            { label: "Bank name", value: supplierBankProof.bankName?.trim() || "" },
          ] as { label: string; value: string }[]
        ).filter((row) => row.value.length > 0)
      : [];
  const showSupplierBankPanel =
    financeBankSelected &&
    (supplierBankAccountRows.length > 0 ||
      Boolean(supplierBankProof?.detailLine?.trim()) ||
      Boolean(supplierBankProof?.onFile) ||
      supplierBankLoading);
  const supplierBankVerified =
    (supplierBankProof?.status ?? "").toLowerCase() === "verified" ||
    checklistSelectedRow?.status === "verified";
  const supplierLabelForBank =
    (supplierNameByTripId[summary?.trip.id ?? ""] ?? summary?.trip.supplier_name)?.trim() || "Supplier";
  const showPay = Boolean(
    canManageFinance && readiness?.paymentReady && summary && (onConfirmPayment || onPay),
  );
  const readyPaymentCategory = readiness?.readyCategory ?? null;
  const showReject = Boolean(
    summary?.complianceVerifiedAt &&
      !summary.complianceDeclinedAt &&
      onRejectCompliance &&
      canVerify,
  );
  const showMarkVerified = Boolean(
    onMarkComplianceVerified && summary && !summary.complianceVerifiedAt && readiness?.requiredDocs.markVerifiedReady,
  );
  const [markingVerified, setMarkingVerified] = useState(false);
  const vaultCopy = TAB_VAULT_COPY[tab];
  const listMissingRows = listRows.filter((row) => row.status === "missing");
  const missingRequiredCount = listMissingRows.filter((row) => row.required).length;
  const missingOptionalCount = listMissingRows.length - missingRequiredCount;
  const uploadedCount = listRows.filter(hasFile).length;
  const missingHeadline = isFinanceMode
    ? listMissingRows.length === 0
      ? uploadedCount > 0
        ? `${uploadedCount} document${uploadedCount === 1 ? "" : "s"} on file — preview below`
        : supplierBankLoading
          ? "Loading supplier Banking…"
          : "No Trip Details documents yet"
      : missingRequiredCount > 0
        ? `${missingRequiredCount} required document${missingRequiredCount === 1 ? "" : "s"} not uploaded`
        : `${listMissingRows.length} document${listMissingRows.length === 1 ? "" : "s"} not uploaded`
    : listMissingRows.length === 0
      ? uploadedCount > 0
        ? `${uploadedCount} document${uploadedCount === 1 ? "" : "s"} on file — preview below`
        : "No documents in this vault yet"
      : missingRequiredCount > 0
        ? `${missingRequiredCount} required document${missingRequiredCount === 1 ? "" : "s"} not uploaded`
        : `${listMissingRows.length} document${listMissingRows.length === 1 ? "" : "s"} not uploaded`;
  const missingSubline = isFinanceMode
    ? "Memo · Other Documents · Bank Docs synced from supplier Banking"
    : listMissingRows.length === 0
      ? "Use the eye icon to preview, or Upload to replace a file"
      : missingOptionalCount > 0 && missingRequiredCount > 0
        ? `Plus ${missingOptionalCount} optional from this ${vaultCopy.vaultLabel.toLowerCase()}`
        : vaultCopy.vaultHint;
  const openVaultUpload = useCallback(
    (documentKey: string | null) => {
      if (!summary || !onReviewTripDocs) return;
      const uploadTab: DocTab = checklistPreviewMode === "finance" ? "trip" : tab;
      if (checklistPreviewMode !== "finance") setChecklistPreviewMode("document");
      if (documentKey) setChecklistKey(documentKey);
      onReviewTripDocs(summary.trip.id, documentKey, uploadTab);
    },
    [onReviewTripDocs, summary, tab, checklistPreviewMode],
  );
  const uploadFinanceDocument = useCallback(
    async (type: string) => {
      if (!summary) return;
      if (!actorId) {
        alertMessage("Can't upload", "Sign in again, then try Upload.");
        return;
      }
      if (uploadingFinanceType) return;
      setUploadingFinanceType(type);
      setChecklistPreviewMode("finance");
      setChecklistKey(type);
      try {
        const res = await DocumentPicker.getDocumentAsync({
          type: [...COMPLIANCE_TRIP_DOC_PICKER_TYPES],
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets[0]) return;
        const asset = res.assets[0];
        const fileName = asset.name ?? `${type}.pdf`;
        if (typeof asset.size === "number") {
          const early = validateComplianceTripDocumentFile({
            fileName,
            mimeType: asset.mimeType,
            byteLength: asset.size,
          });
          if (!early.ok) throw new Error(early.reason);
        }
        const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
        const format = validateComplianceTripDocumentFile({
          fileName,
          mimeType: asset.mimeType,
          byteLength: arrayBuffer.byteLength,
        });
        if (!format.ok) throw new Error(format.reason);
        const { error } = await uploadTripDocument(
          summary.trip.id,
          actorId,
          { arrayBuffer, fileName, mimeType: format.mimeType },
          type as TripDocumentType,
          undefined,
          { replaceExistingOfType: true },
        );
        if (error) throw error;
        setZoom(1);
        onChanged({ type: "tripDocuments", tripId: summary.trip.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed. Try again.";
        alertMessage("Couldn't upload document", message);
      } finally {
        setUploadingFinanceType(null);
      }
    },
    [actorId, onChanged, summary, uploadingFinanceType],
  );
  const previewChecklistRow = useCallback((row: ComplianceDocRow) => {
    setChecklistPreviewMode((prev) => (prev === "finance" ? "finance" : "document"));
    setChecklistKey(row.key);
    if (!hasFile(row)) return;
    setZoom(1);
  }, []);
  const tabMissingCounts = useMemo(() => {
    if (!summary) return { trip: 0, vehicle: 0, driver: 0, finance: 0 };
    const finance = deriveFinanceDocumentRows(summary.documents);
    return {
      trip: deriveComplianceDocumentRows(summary.documents).filter((row) => row.status === "missing").length,
      vehicle: summary.trip.vehicle_id
        ? deriveEntityComplianceRows(COMPLIANCE_VEHICLE_DOCUMENT_TYPES, summary.vehicleDocuments).filter(
            (row) => row.status === "missing",
          ).length
        : 0,
      driver: summary.trip.driver_id
        ? deriveEntityComplianceRows(COMPLIANCE_DRIVER_DOCUMENT_TYPES, summary.driverDocuments).filter(
            (row) => row.status === "missing",
          ).length
        : 0,
      finance: finance.filter((row) => row.status === "missing").length,
    };
  }, [summary]);

  return (
    <View style={[styles.workspace, stacked && styles.workspaceStacked, style]}>
      <View style={[styles.listPane, stacked && styles.listPaneStacked]}>
        {summaries.length === 0 ? (
          <View style={styles.listEmpty}>
            <NoTripsFoundEmpty compact={stacked} />
          </View>
        ) : (
        <ScrollView
          ref={listRef}
          style={styles.listScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          contentContainerStyle={styles.listContent}
        >
          {summaries.map((item) => (
            <View
              key={item.trip.id}
              onLayout={
                item.trip.id === selectedTripId
                  ? (event) => {
                      if (scrolledTripId.current === selectedTripId) return;
                      scrolledTripId.current = selectedTripId;
                      listRef.current?.scrollTo({
                        y: Math.max(0, event.nativeEvent.layout.y - 8),
                        animated: true,
                      });
                    }
                  : undefined
              }
            >
              <TripListRow
                summary={item}
                selected={item.trip.id === summary?.trip.id}
                organizationId={organizationId}
                truckType={
                  item.trip.vehicle_id
                    ? truckTypeByVehicleId[item.trip.vehicle_id] ?? null
                    : null
                }
                supplierName={supplierNameByTripId[item.trip.id] ?? null}
                onPress={() => {
                  setSelectedId(item.trip.id);
                  setTab("trip");
                  setDocIndex(0);
                  setZoom(1);
                }}
              />
            </View>
          ))}
        </ScrollView>
        )}
      </View>

      <View style={styles.previewPane}>
        <View style={styles.stage}>
          {showDocumentShell ? (
            <View style={[styles.checklistStage, stacked && styles.checklistStageStacked]}>
              <View style={[styles.checklistListPane, stacked && styles.checklistListPaneStacked]}>
                <View style={styles.checklistPanelToolbar}>
                  <View style={styles.checklistPanelTabs}>
                    <Pressable
                      onPress={() => {
                        setTab("trip");
                        setChecklistPreviewMode("finance");
                        setZoom(1);
                        setScreenOpen(false);
                      }}
                      style={[
                        styles.tab,
                        styles.checklistPanelTab,
                        checklistPreviewMode === "finance" && styles.tabActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: checklistPreviewMode === "finance" }}
                      accessibilityLabel="Show finance documents"
                    >
                      <Text
                        style={[
                          styles.tabText,
                          styles.checklistPanelTabText,
                          checklistPreviewMode === "finance" && styles.tabTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Finance
                      </Text>
                      {tabMissingCounts.finance > 0 ? (
                        <View
                          style={[
                            styles.tabBadge,
                            styles.checklistPanelTabBadge,
                            checklistPreviewMode === "finance" && styles.tabBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.tabBadgeText,
                              styles.checklistPanelTabBadgeText,
                              checklistPreviewMode === "finance" && styles.tabBadgeTextActive,
                            ]}
                          >
                            {tabMissingCounts.finance}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                    {TABS.map((item) => {
                      const active = tab === item.key && checklistPreviewMode !== "finance";
                      const missingCount = tabMissingCounts[item.key];
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => {
                            setTab(item.key);
                            setChecklistPreviewMode("document");
                            setZoom(1);
                            setScreenOpen(false);
                          }}
                          style={[
                            styles.tab,
                            styles.checklistPanelTab,
                            active && styles.tabActive,
                          ]}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            style={[
                              styles.tabText,
                              styles.checklistPanelTabText,
                              active && styles.tabTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {missingCount > 0 ? (
                            <View
                              style={[
                                styles.tabBadge,
                                styles.checklistPanelTabBadge,
                                active && styles.tabBadgeActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.tabBadgeText,
                                  styles.checklistPanelTabBadgeText,
                                  active && styles.tabBadgeTextActive,
                                ]}
                              >
                                {missingCount}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[styles.missingNavPill, styles.checklistUploadPill]}>
                    <Text style={[styles.missingNavLabel, styles.checklistUploadPillText]} numberOfLines={1}>
                      {showEntityUnassigned
                        ? "Unassigned"
                        : listMissingRows.length > 0
                          ? `${listMissingRows.length} to upload`
                          : `${uploadedCount} on file`}
                    </Text>
                  </View>
                </View>
                {showEntityUnassigned ? (
                  <View style={styles.missingHeader}>
                    <Text style={styles.missingTitle}>{vaultCopy.unassignedTitle}</Text>
                    <Text style={styles.missingHint}>{vaultCopy.unassignedHint}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.missingHeader}>
                      <Text style={styles.missingTitle}>
                        {isFinanceMode ? "TRIP DETAILS" : "DOCUMENTS TO UPLOAD"}
                      </Text>
                      <Text style={styles.missingSubtitle} numberOfLines={1}>
                        {missingHeadline}
                      </Text>
                      <Text style={styles.missingHint} numberOfLines={2}>
                        {missingSubline}
                      </Text>
                    </View>
                    <ScrollView
                      style={styles.checklistListScroll}
                      contentContainerStyle={styles.checklistListContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {listRows.map((row, index) => {
                        const displayRow = applyOptimisticDecision(row, localDecisionByKey[row.key]);
                        const rowHasFile = hasFile(displayRow);
                        const statusMeta = COMPLIANCE_STATUS_META[displayRow.status];
                        const selected =
                          (checklistPreviewMode === "document" || checklistPreviewMode === "finance") &&
                          checklistKey === displayRow.key;
                        const uploadLabel = displayRow.status === "missing" ? "Upload" : "Replace";
                        const rowLabel = isFinanceMode
                          ? labelForFinanceDocType(displayRow.type)
                          : labelForDocType(displayRow.type);
                        const vaultDetail = isFinanceMode ? financeVaultDetailLine(displayRow) : null;
                        const isBankDocs = isFinanceMode && displayRow.type === "bank_docs";
                        const bankVerified =
                          isBankDocs &&
                          (displayRow.status === "verified" ||
                            (supplierBankProof?.status ?? "").toLowerCase() === "verified");
                        const bankFromSupplier =
                          isBankDocs &&
                          Boolean(
                            displayRow.entityDoc?.source === "supplier-kyc" || supplierBankProof?.onFile,
                          );
                        const statusLabel =
                          displayRow.status === "missing"
                            ? isBankDocs && supplierBankLoading
                              ? "Fetching supplier Banking…"
                              : "Not uploaded"
                            : vaultDetail
                              ? vaultDetail
                              : rowHasFile
                                ? `${statusMeta.label} · ready to preview`
                                : statusMeta.label;
                        return (
                          <View
                            key={displayRow.key}
                            style={[
                              styles.missingRow,
                              index > 0 && styles.missingRowBorder,
                              selected && styles.missingRowSelected,
                            ]}
                          >
                            <Pressable
                              style={styles.missingRowCopy}
                              onPress={() => previewChecklistRow(displayRow)}
                              accessibilityRole="button"
                              accessibilityLabel={`${rowLabel} details`}
                            >
                              <View style={styles.missingTitleRow}>
                                <Text style={styles.missingDocName} numberOfLines={1}>
                                  {rowLabel.toUpperCase()}
                                </Text>
                                <View
                                  style={[
                                    styles.missingScopeTag,
                                    displayRow.required
                                      ? styles.missingScopeRequired
                                      : styles.missingScopeOptional,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.missingScopeText,
                                      displayRow.required
                                        ? styles.missingScopeTextRequired
                                        : styles.missingScopeTextOptional,
                                    ]}
                                  >
                                    {requirementScopeLabel(displayRow.required)}
                                  </Text>
                                </View>
                                {bankVerified ? (
                                  <View style={styles.bankVerifiedChip}>
                                    <Text style={styles.bankVerifiedChipText}>Verified</Text>
                                  </View>
                                ) : null}
                              </View>
                              {!(bankFromSupplier && displayRow.status !== "missing") ? (
                                <Text
                                  style={[
                                    styles.missingStatus,
                                    displayRow.status === "missing" ? null : { color: statusMeta.color },
                                  ]}
                                  numberOfLines={2}
                                >
                                  {statusLabel}
                                </Text>
                              ) : null}
                              {bankFromSupplier && displayRow.status !== "missing" ? (
                                <Text style={styles.bankSourceHint} numberOfLines={1}>
                                  Synced from supplier Banking
                                </Text>
                              ) : null}
                            </Pressable>
                            <View style={styles.missingRowActions}>
                              <TouchableOpacity
                                style={[styles.missingEyeBtn, !rowHasFile && styles.missingEyeBtnDisabled]}
                                activeOpacity={0.75}
                                disabled={!canViewDocuments || !rowHasFile}
                                onPress={() => previewChecklistRow(displayRow)}
                                accessibilityRole="button"
                                accessibilityLabel={`Preview ${rowLabel}`}
                                accessibilityState={{ disabled: !rowHasFile }}
                              >
                                <Eye
                                  size={12}
                                  color={rowHasFile ? Theme.textPrimaryDark : Theme.textMuted}
                                  strokeWidth={2.2}
                                />
                              </TouchableOpacity>
                              {onReviewTripDocs || isFinanceMode ? (
                                <TouchableOpacity
                                  style={[
                                    styles.missingUploadBtn,
                                    uploadingFinanceType === displayRow.key && styles.btnDisabled,
                                  ]}
                                  activeOpacity={0.8}
                                  disabled={Boolean(uploadingFinanceType)}
                                  onPress={() => {
                                    if (isFinanceMode) {
                                      void uploadFinanceDocument(displayRow.key);
                                      return;
                                    }
                                    openVaultUpload(displayRow.key);
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${uploadLabel} ${rowLabel}`}
                                >
                                  <Upload size={11} color={Theme.cardWhite} strokeWidth={2.4} />
                                  <Text style={styles.missingUploadBtnText}>
                                    {uploadingFinanceType === displayRow.key ? "Uploading…" : uploadLabel}
                                  </Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.checklistPreviewActionsSection}>
                      <Text style={styles.checklistPreviewActionsLabel}>PREVIEW</Text>
                      <View style={styles.checklistPreviewActionsRow}>
                        <TouchableOpacity
                          style={[
                            styles.checklistModeBtn,
                            checklistPreviewMode === "trip" && styles.checklistModeBtnActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => setChecklistPreviewMode("trip")}
                          accessibilityRole="button"
                          accessibilityState={{ selected: checklistPreviewMode === "trip" }}
                          accessibilityLabel="Show trip details"
                        >
                          <Text
                            style={[
                              styles.checklistModeBtnText,
                              checklistPreviewMode === "trip" && styles.checklistModeBtnTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            Trip Detail
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.checklistModeBtn,
                            checklistPreviewMode === "advance" && styles.checklistModeBtnActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => setChecklistPreviewMode("advance")}
                          accessibilityRole="button"
                          accessibilityState={{ selected: checklistPreviewMode === "advance" }}
                          accessibilityLabel="Show advance payment details"
                        >
                          <Text
                            style={[
                              styles.checklistModeBtnText,
                              checklistPreviewMode === "advance" && styles.checklistModeBtnTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            Advance Payment
                          </Text>
                        </TouchableOpacity>
                        {canManagePod && !isPendingDocsTrip ? (
                          <TouchableOpacity
                            style={styles.checklistModeBtn}
                            activeOpacity={0.8}
                            disabled={!summary}
                            onPress={() => setPodOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Log hardcopy POD"
                          >
                            <Text style={styles.checklistModeBtnText} numberOfLines={1}>
                              Hardcopy POD
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        {showMarkVerified && summary ? (
                          <TouchableOpacity
                            style={[styles.checklistModeBtn, styles.checklistModeBtnActive]}
                            activeOpacity={0.8}
                            disabled={markingVerified}
                            onPress={() => {
                              setMarkingVerified(true);
                              void onMarkComplianceVerified?.(summary.trip.id).finally(() =>
                                setMarkingVerified(false),
                              );
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Mark compliance verified"
                          >
                            <Text
                              style={[styles.checklistModeBtnText, styles.checklistModeBtnTextActive]}
                              numberOfLines={1}
                            >
                              {markingVerified ? "Verifying…" : "Mark verified"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.checklistListFooter}>
                      <Text style={styles.checklistFooterVaultText} numberOfLines={1}>
                        {isFinanceMode ? "Asset Vault · Trip Details" : vaultCopy.vaultLabel} ·{" "}
                        {listMissingRows.length > 0
                          ? `${listMissingRows.length} remaining`
                          : `${uploadedCount} on file`}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <View style={[styles.checklistPreviewPane, stacked && styles.checklistPreviewPaneStacked]}>
                <View style={styles.checklistPreviewBody}>
                  {checklistPreviewMode === "trip" && summary ? (
                    <ChecklistTripDetailsPanel
                      summary={summary}
                      truckType={
                        summary.trip.vehicle_id
                          ? truckTypeByVehicleId[summary.trip.vehicle_id] ?? null
                          : null
                      }
                      supplierName={supplierNameByTripId[summary.trip.id] ?? null}
                    />
                  ) : checklistPreviewMode === "advance" && summary ? (
                    <ChecklistAdvancePaymentPanel
                      summary={summary}
                      readiness={readiness}
                      canPay={showPay}
                      paymentCategory={readyPaymentCategory}
                      paymentSubmitting={paymentSubmitting}
                      onConfirmPayment={onConfirmPayment}
                      onOpenPayModal={onConfirmPayment ? undefined : onPay}
                    />
                  ) : showEntityUnassigned ? (
                    <View style={styles.checklistPreviewEmpty}>
                      <Text style={styles.checklistPreviewEmptyTitle}>{vaultCopy.unassignedTitle}</Text>
                      <Text style={styles.checklistPreviewEmptyHint}>{vaultCopy.unassignedHint}</Text>
                    </View>
                  ) : loadingPreview ? (
                    <View style={styles.checklistPreviewEmpty}>
                      <ActivityIndicator color={Theme.textPrimaryDark} />
                    </View>
                  ) : typedLines && canViewDocuments ? (
                    <ScrollView
                      contentContainerStyle={styles.checklistTypedWrap}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={styles.typedTitle}>{docTitle} · entered details (no file)</Text>
                      {typedLines.map((line, index) => (
                        <View key={`${line.label}-${index}`} style={styles.typedRow}>
                          <Text style={styles.typedLabel}>{line.label}</Text>
                          <Text style={styles.typedValue}>{line.value}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  ) : previewUrl || showSupplierBankPanel ? (
                    <View style={styles.checklistBankPreviewWrap}>
                      {previewUrl ? (
                        <View style={styles.checklistBankPreviewDoc}>
                          <OriginalDocumentPreview
                            uri={previewUrl}
                            isPdf={isPdf}
                            zoom={zoom}
                            label={docTitle}
                          />
                          <Pressable
                            style={styles.openLayer}
                            onPress={() => setScreenOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel={`Open ${docTitle}`}
                          />
                        </View>
                      ) : null}
                      {showSupplierBankPanel ? (
                        <ScrollView
                          style={
                            previewUrl
                              ? styles.checklistBankDetailsScroll
                              : styles.checklistBankDetailsScrollSolo
                          }
                          contentContainerStyle={styles.checklistBankDetailsContent}
                          showsVerticalScrollIndicator={false}
                        >
                          <View style={styles.bankCardHeader}>
                            <View style={styles.bankCardHeaderCopy}>
                              <Text style={styles.checklistBankDetailsTitle}>Bank account</Text>
                              <Text style={styles.checklistBankDetailsHint} numberOfLines={1}>
                                Payout account from {supplierLabelForBank}
                              </Text>
                            </View>
                            {supplierBankProof?.detailLine ? (
                              <Text style={styles.bankCardMeta} numberOfLines={2}>
                                {supplierBankProof.detailLine}
                              </Text>
                            ) : null}
                          </View>
                          {supplierBankLoading && supplierBankAccountRows.length === 0 ? (
                            <ActivityIndicator color={Theme.textPrimaryDark} style={{ marginVertical: 12 }} />
                          ) : (
                            <View style={styles.bankFieldsGrid}>
                              {supplierBankAccountRows.map((row) => (
                                <View key={row.label} style={styles.bankFieldCell}>
                                  <Text style={styles.bankFieldLabel}>{row.label}</Text>
                                  <Text style={styles.bankFieldValue} numberOfLines={1}>
                                    {row.value}
                                  </Text>
                                </View>
                              ))}
                              {supplierBankAccountRows.length === 0 ? (
                                <Text style={styles.checklistBankDetailsHint}>
                                  No payout account on file yet. Save bank details on the supplier profile.
                                </Text>
                              ) : null}
                            </View>
                          )}
                          <View style={styles.bankProofSection}>
                            <Text style={styles.bankProofLabel}>Proof document</Text>
                            <View style={styles.bankProofRow}>
                              <View style={styles.bankProofCopy}>
                                <Text style={styles.bankProofTitle} numberOfLines={1}>
                                  {supplierBankProof?.fileName?.trim() ||
                                    (previewUrl ? "Bank proof" : "No proof uploaded")}
                                </Text>
                                {supplierBankVerified ? (
                                  <View style={styles.bankVerifiedChip}>
                                    <Text style={styles.bankVerifiedChipText}>Verified</Text>
                                  </View>
                                ) : supplierBankProof?.previewPath ? (
                                  <View style={styles.bankPendingChip}>
                                    <Text style={styles.bankPendingChipText}>On file</Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.bankProofHint} numberOfLines={1}>
                                Synced from supplier Banking
                              </Text>
                            </View>
                          </View>
                        </ScrollView>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.checklistPreviewEmpty}>
                      <Text style={styles.checklistPreviewEmptyTitle}>
                        {checklistSelectedRow
                          ? `${
                              isFinanceMode
                                ? labelForFinanceDocType(checklistSelectedRow.type)
                                : labelForDocType(checklistSelectedRow.type)
                            } has no file to preview`
                          : "Select a document to preview"}
                      </Text>
                      <Text style={styles.checklistPreviewEmptyHint}>
                        Tap the eye icon on an uploaded document, or use Trip Detail / Advance Payment.
                      </Text>
                    </View>
                  )}
                </View>
                {(() => {
                  const previewingDocument =
                    checklistPreviewMode === "document" || checklistPreviewMode === "finance";
                  const canModerateActive =
                    Boolean(activeRow) &&
                    activeRow!.status !== "missing" &&
                    canModerateComplianceRow(activeRow!, reviewScope);
                  const showApproveDecline =
                    previewingDocument && canModerateActive && !isPendingDocsTrip;
                  const showPrimaryAction = showReject || showPay;
                  const showDocNav = previewingDocument && previewable.length >= 2;
                  const showDecisionBar =
                    previewingDocument &&
                    Boolean(activeRow) &&
                    (showApproveDecline || showPrimaryAction || showDocNav);
                  if (!showDecisionBar) return null;
                  const declineDisabled = !decisions.canDecline || !canAct;
                  const approveDisabled = !decisions.canApprove || !canAct;
                  const approveBusy = busy && decisions.canApprove;
                  const declineBusy = busy && decisions.canDecline;
                  return (
                  <View style={styles.checklistDecisionBar}>
                    {showApproveDecline ? (
                      <View style={styles.checklistDecisionActions}>
                        <TouchableOpacity
                          style={[
                            styles.checklistDecisionDecline,
                            decisionButtons.declineActive && styles.checklistDecisionDeclineActive,
                            declineDisabled && !decisionButtons.declineActive && styles.btnDisabled,
                          ]}
                          disabled={busy || declineDisabled}
                          activeOpacity={0.85}
                          onPress={() => {
                            if (!canVerify) {
                              alertMessage(
                                "Can't decline",
                                "You don't have permission to verify compliance documents.",
                              );
                              return;
                            }
                            if (!actorId) {
                              alertMessage("Can't decline", "Sign in again, then try Decline.");
                              return;
                            }
                            if (!decisions.canDecline || !canModerateComplianceRow(activeRow!, reviewScope)) {
                              alertMessage("Can't decline", "This document isn't ready to decline yet.");
                              return;
                            }
                            setDeclineOpen(true);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: busy || declineDisabled,
                            selected: decisionButtons.declineActive,
                          }}
                          accessibilityLabel={
                            decisionButtons.declineActive ? "Document declined" : "Decline document"
                          }
                        >
                          {decisionButtons.declineActive ? (
                            <View style={styles.checklistDecisionLabelRow}>
                              <X size={14} color={Theme.cardWhite} strokeWidth={2.5} />
                              <Text style={styles.checklistDecisionDeclineTextActive}>
                                {declineBusy ? "Saving…" : decisionButtons.declineLabel}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.checklistDecisionDeclineText}>
                              {declineBusy ? "Saving…" : decisionButtons.declineLabel}
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.checklistDecisionApprove,
                            decisionButtons.approveActive && styles.checklistDecisionApproveActive,
                            approveDisabled && !decisionButtons.approveActive && styles.btnDisabled,
                          ]}
                          disabled={busy || approveDisabled}
                          activeOpacity={0.85}
                          onPress={() => void approve()}
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: busy || approveDisabled,
                            selected: decisionButtons.approveActive,
                          }}
                          accessibilityLabel={
                            decisionButtons.approveActive ? "Document approved" : "Approve document"
                          }
                        >
                          {decisionButtons.approveActive ? (
                            <View style={styles.checklistDecisionLabelRow}>
                              <Check size={14} color={Theme.cardWhite} strokeWidth={2.5} />
                              <Text style={styles.checklistDecisionApproveText}>
                                {approveBusy ? "Saving…" : decisionButtons.approveLabel}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.checklistDecisionApproveText}>
                              {approveBusy ? "Saving…" : decisionButtons.approveLabel}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <View style={styles.checklistDecisionSpacer} />
                    {showReject && summary ? (
                      <TouchableOpacity
                        style={styles.checklistDecisionReject}
                        onPress={() => setRejectOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Reject trip"
                      >
                        <Text style={styles.checklistDecisionRejectText}>Reject</Text>
                      </TouchableOpacity>
                    ) : showPay && summary ? (
                      <TouchableOpacity
                        style={styles.checklistDecisionPay}
                        onPress={() => {
                          if (onConfirmPayment && readyPaymentCategory === "compliance_advance") {
                            setChecklistPreviewMode("advance");
                            return;
                          }
                          onPay?.(summary);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Pay"
                      >
                        <Text style={styles.checklistDecisionPayText}>Pay</Text>
                      </TouchableOpacity>
                    ) : null}
                    {showDocNav ? (
                      <View style={styles.checklistDecisionNavGroup}>
                        <TouchableOpacity
                          style={styles.checklistDecisionNav}
                          onPress={goPrev}
                          accessibilityRole="button"
                          accessibilityLabel="Previous document"
                        >
                          <ChevronLeft size={12} color={Theme.textPrimaryDark} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.checklistDecisionNav}
                          onPress={goNext}
                          accessibilityRole="button"
                          accessibilityLabel="Next document"
                        >
                          <ChevronRight size={12} color={Theme.textPrimaryDark} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                  );
                })()}
              </View>
            </View>
          ) : (
            <View style={styles.emptyStage}>
              <NoDocumentPreviewEmpty
                compact={stacked}
                title="No document to preview"
                hint="Select a trip to view its compliance documents here."
              />
            </View>
          )}
        </View>

        {showEntityUnassigned ? (
          <View style={styles.decisionRow}>
            <View style={styles.missingFooterMeta}>
              <Text style={styles.missingFooterText} numberOfLines={1}>
                {vaultCopy.vaultLabel} · unavailable
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      {previewUrl ? (
        <DocumentScreen
          visible={screenOpen}
          uri={previewUrl}
          isPdf={isPdf}
          title={docTitle}
          onClose={() => setScreenOpen(false)}
        />
      ) : null}
      <ComplianceInputModal
        visible={declineOpen}
        title="Decline document"
        fields={DECLINE_FIELDS}
        confirmLabel="Decline with note"
        onCancel={() => setDeclineOpen(false)}
        onSubmit={(values) => {
          void declineWithReason(values.reason ?? "");
        }}
      />
      <ComplianceRejectRemarkModal
        visible={rejectOpen}
        tripLabel={
          summary
            ? getTripDisplayNumber(summary.trip, summary.trip.organization_id ?? null)
            : "Trip"
        }
        onCancel={() => setRejectOpen(false)}
        onSubmit={async (reason) => {
          if (!summary || !onRejectCompliance) return;
          await onRejectCompliance(summary.trip.id, reason);
          setRejectOpen(false);
        }}
      />
      <ComplianceInputModal
        visible={expiryPrompt != null}
        title={`Expiry date — ${expiryPrompt ? labelForDocType(expiryPrompt.docType) : "Document"}`}
        fields={[
          {
            key: "expiry",
            label: "Expiry date (YYYY-MM-DD)",
            placeholder: "2027-03-15",
            required: true,
          },
        ]}
        confirmLabel="Continue"
        onCancel={() => {
          expiryPrompt?.resolve(null);
          setExpiryPrompt(null);
        }}
        onSubmit={(values) => {
          expiryPrompt?.resolve(values.expiry ?? null);
          setExpiryPrompt(null);
        }}
      />
      <ComplianceInputModal
        visible={podOpen}
        title="Log hardcopy POD"
        fields={HARD_COPY_POD_FIELDS}
        confirmLabel="Log hardcopy POD"
        onCancel={() => setPodOpen(false)}
        onSubmit={(values) => {
          if (!summary) return;
          void (async () => {
            const { error, alreadyReceived } = await markTripHardCopyPodReceived(summary.trip.id, {
              courier: values.courier,
              awbNumber: values.awb,
              receivedBy: values.receivedBy,
            });
            if (error) {
              alertMessage("Couldn't log hardcopy POD", error.message);
              return;
            }
            setPodOpen(false);
            if (alreadyReceived) {
              alertMessage("Hardcopy POD", "This trip already has a hardcopy POD logged.");
              return;
            }
            onChanged({ type: "tripFlags", tripId: summary.trip.id });
          })();
        }}
      />
    </View>
  );
}

function ChecklistDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.checklistDetailRow}>
      <Text style={styles.checklistDetailLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.checklistDetailValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

type TripCommercialFacts = {
  client_price?: number | null;
  supplier_rate?: number | null;
  margin?: number | null;
  load_tons?: number | null;
  sale_rate_basis?: string | null;
  sale_unit_rate?: number | null;
  supplier_rate_basis?: string | null;
};

function formatTripInr(value: number | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatLoadedWeight(tons: number | null | undefined): string {
  const value = Number(tons);
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 3 })} MT`;
}

function clientRatePerMtLabel(trip: TripCommercialFacts): string {
  const unit = Number(trip.sale_unit_rate);
  if (trip.sale_rate_basis === "per_mt" && Number.isFinite(unit) && unit > 0) {
    return formatTripInr(unit);
  }
  const tons = Number(trip.load_tons);
  const price = Number(trip.client_price);
  if (Number.isFinite(tons) && tons > 0 && Number.isFinite(price) && price > 0) {
    return formatTripInr(price / tons);
  }
  return "—";
}

function supplierRatePerMtLabel(trip: TripCommercialFacts): string {
  const rate = Number(trip.supplier_rate);
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  if (trip.supplier_rate_basis === "per_mt") return formatTripInr(rate);
  const tons = Number(trip.load_tons);
  if (Number.isFinite(tons) && tons > 0) return formatTripInr(rate / tons);
  return "—";
}

function supplierCostTotal(trip: TripCommercialFacts): number | null {
  const rate = Number(trip.supplier_rate);
  if (!Number.isFinite(rate)) return null;
  if (trip.supplier_rate_basis === "per_mt") {
    const tons = Number(trip.load_tons);
    if (Number.isFinite(tons) && tons > 0) return rate * tons;
    return null;
  }
  return rate;
}

function profitLabels(trip: TripCommercialFacts): { profit: string; percent: string } {
  const client = Number(trip.client_price);
  const cost = supplierCostTotal(trip);
  const storedMargin = Number(trip.margin);
  const profit =
    Number.isFinite(client) && cost != null
      ? client - cost
      : Number.isFinite(storedMargin)
        ? storedMargin
        : null;
  if (profit == null || !Number.isFinite(profit)) {
    return { profit: "—", percent: "—" };
  }
  const percent =
    Number.isFinite(client) && client > 0 ? `${((profit / client) * 100).toFixed(1)}%` : "—";
  return { profit: formatTripInr(profit), percent };
}

function docNumberForType(
  documents: ComplianceTripSummary["documents"],
  type: string,
): string | null {
  const matches = documents.filter((doc) => (doc.document_type ?? "").toLowerCase() === type);
  if (matches.length === 0) return null;
  const latest = [...matches].sort((a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""))[0];
  const raw = latest?.document_number ?? null;
  if (type === "lr") return formatLrVaultNumberLabel(raw);
  if (type === "invoice") return formatInvoiceVaultNumberLabel(raw);
  return raw?.trim() || null;
}

function ChecklistTripDetailsPanel({
  summary,
  truckType,
  supplierName,
}: {
  summary: ComplianceTripSummary;
  truckType: string | null;
  supplierName: string | null;
}) {
  const trip = summary.trip;
  const commercial = trip as typeof trip & TripCommercialFacts;
  const customerName = trip.client_name?.trim() || "—";
  const supplierLabel = (supplierName ?? trip.supplier_name)?.trim() || "—";
  const origin = splitHubRouteLocationDisplay(trip.pickup_area ?? "");
  const dest = splitHubRouteLocationDisplay(trip.drop_location ?? "");
  const vehicle =
    formatIndianVehicleNumber(trip.vehicle_display_number?.trim() || "").trim() ||
    trip.vehicle_display_number?.trim() ||
    "—";
  const truckLabel = truckType?.trim() || "—";
  const inTransitAt = formatComplianceTimestamp(trip.started_at);
  const executionModel = getTripExecutionModel(trip);
  const isAsset = executionModel === "asset";
  const routeLine = `${origin.city || "—"}${origin.state ? `, ${origin.state}` : ""} → ${dest.city || "—"}${
    dest.state ? `, ${dest.state}` : ""
  }`;
  const salesInvoice = docNumberForType(summary.documents, "invoice") ?? "—";
  const lrNo = docNumberForType(summary.documents, "lr") ?? "—";
  const { profit, percent: profitPercent } = profitLabels(commercial);

  const [bankDetails, setBankDetails] = useState<{
    accountNumber: string;
    beneficiaryName: string;
    ifsc: string;
    branchName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const orgId = (trip.organization_id ?? "").trim();
    const supplierId = (trip.supplier_id ?? "").trim();
    if (!orgId || !supplierId) {
      setBankDetails(null);
      return;
    }
    void getSupplierBankAccount(orgId, supplierId).then(({ account }) => {
      if (cancelled) return;
      if (!account) {
        setBankDetails(null);
        return;
      }
      setBankDetails({
        accountNumber: account.account_number?.trim() || "—",
        beneficiaryName: supplierLabel !== "—" ? supplierLabel : "—",
        ifsc: account.ifsc_code?.trim() || "—",
        branchName: account.bank_name?.trim() || "—",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [trip.organization_id, trip.supplier_id, supplierLabel]);

  const rows: { label: string; value: string }[] = [
    { label: "Trip ID", value: getTripDisplayNumber(trip, trip.organization_id ?? null) },
    { label: "Customer", value: customerName },
    { label: "Supplier", value: supplierLabel },
    { label: "Route", value: routeLine },
    { label: "Vehicle", value: vehicle },
    { label: "Truck type", value: truckLabel },
    { label: "Model", value: isAsset ? "Asset" : "Aggregate" },
    { label: "In-transit date", value: inTransitAt },
    { label: "Client sales invoice no", value: salesInvoice },
    { label: "LR no", value: lrNo },
    { label: "Loaded weight", value: formatLoadedWeight(commercial.load_tons) },
    {
      label: "Supplier rate",
      value: formatTripInr(supplierCostTotal(commercial) ?? commercial.supplier_rate),
    },
    { label: "Client rate per MT", value: clientRatePerMtLabel(commercial) },
    { label: "Client rate", value: formatTripInr(commercial.client_price) },
    { label: "Supplier rate per MT", value: supplierRatePerMtLabel(commercial) },
    { label: "Account number", value: bankDetails?.accountNumber ?? "—" },
    { label: "Beneficiary name", value: bankDetails?.beneficiaryName ?? (supplierLabel !== "—" ? supplierLabel : "—") },
    { label: "IFSC no", value: bankDetails?.ifsc ?? "—" },
    { label: "Branch name", value: bankDetails?.branchName ?? "—" },
    { label: "Profit", value: profit },
    { label: "Profit %", value: profitPercent },
  ];

  return (
    <ScrollView
      style={styles.checklistInfoScroll}
      contentContainerStyle={styles.checklistInfoContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.checklistInfoTitle}>Trip details</Text>
      <Text style={styles.checklistInfoHint}>Selected trip facts from the compliance queue</Text>
      <View style={styles.checklistInfoCard}>
        {rows.map((row, index) => (
          <View key={row.label} style={index > 0 ? styles.checklistDetailRowBorder : undefined}>
            <ChecklistDetailRow label={row.label} value={row.value} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ChecklistAdvancePaymentPanel({
  summary,
  readiness,
  canPay,
  paymentCategory,
  paymentSubmitting,
  onConfirmPayment,
  onOpenPayModal,
}: {
  summary: ComplianceTripSummary;
  readiness: ReturnType<typeof deriveComplianceQueueReadiness> | null;
  canPay: boolean;
  paymentCategory: ComplianceLedgerCategory | null;
  paymentSubmitting: boolean;
  onConfirmPayment?: (
    summary: ComplianceTripSummary,
    category: ComplianceLedgerCategory,
    values: CompliancePaymentConfirmValues,
  ) => void | Promise<void>;
  onOpenPayModal?: (summary: ComplianceTripSummary) => void;
}) {
  const advance = summary.advance;
  const lane = readiness?.advance ?? null;
  const statusLabel = advance
    ? "Advance processed"
    : lane?.status === "ready"
      ? "Ready to pay"
      : lane?.status === "blocked"
        ? "Blocked"
        : "Not posted";
  const statusTone: "ready" | "posted" | "blocked" | "pending" = advance
    ? "posted"
    : lane?.status === "ready"
      ? "ready"
      : lane?.status === "blocked"
        ? "blocked"
        : "pending";
  const advanceBlockers =
    !advance && lane?.status === "blocked"
      ? (readiness?.blockerLines ?? []).filter((line) => {
          const lower = line.toLowerCase();
          // Balance-only messaging is noise on the advance panel.
          return !lower.includes("before the balance");
        })
      : [];
  const showInlineForm =
    !advance &&
    canPay &&
    paymentCategory === "compliance_advance" &&
    Boolean(onConfirmPayment);

  return (
    <ScrollView
      style={styles.checklistInfoScroll}
      contentContainerStyle={styles.checklistInfoContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.checklistInfoTitle}>Advance payment</Text>
      <Text style={styles.checklistInfoHint}>
        {showInlineForm
          ? "Review the calculation and confirm to post through Finance"
          : "Payment status for this trip's compliance advance"}
      </Text>

      <View style={styles.checklistAdvanceStatusCard}>
        <Text style={styles.checklistAdvanceStatusLabel}>Status</Text>
        <View
          style={[
            styles.checklistAdvanceStatusPill,
            statusTone === "ready" && styles.checklistAdvanceStatusPillReady,
            statusTone === "posted" && styles.checklistAdvanceStatusPillPosted,
            statusTone === "blocked" && styles.checklistAdvanceStatusPillBlocked,
            statusTone === "pending" && styles.checklistAdvanceStatusPillPending,
          ]}
        >
          <View
            style={[
              styles.checklistAdvanceStatusDot,
              statusTone === "ready" && styles.checklistAdvanceStatusDotReady,
              statusTone === "posted" && styles.checklistAdvanceStatusDotPosted,
              statusTone === "blocked" && styles.checklistAdvanceStatusDotBlocked,
              statusTone === "pending" && styles.checklistAdvanceStatusDotPending,
            ]}
          />
          <Text
            style={[
              styles.checklistAdvanceStatusText,
              statusTone === "ready" && styles.checklistAdvanceStatusTextReady,
              statusTone === "posted" && styles.checklistAdvanceStatusTextPosted,
              statusTone === "blocked" && styles.checklistAdvanceStatusTextBlocked,
              statusTone === "pending" && styles.checklistAdvanceStatusTextPending,
            ]}
            numberOfLines={1}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      {advance ? (
        <View style={styles.checklistInfoCard}>
          <ChecklistDetailRow label="Amount" value={`₹${advance.amount.toLocaleString("en-IN")}`} />
          <View style={styles.checklistDetailRowBorder}>
            <ChecklistDetailRow label="Mode" value={advance.paymentMode?.trim() || "—"} />
          </View>
          <View style={styles.checklistDetailRowBorder}>
            <ChecklistDetailRow label="UTR" value={advance.utr?.trim() || "—"} />
          </View>
          <View style={styles.checklistDetailRowBorder}>
            <ChecklistDetailRow label="Paid at" value={formatComplianceTimestamp(advance.paidAt)} />
          </View>
        </View>
      ) : null}

      {showInlineForm ? (
        <View style={styles.checklistAdvanceFormCard}>
          <CompliancePaymentConfirmModal
            presentation="inline"
            visible
            summary={summary}
            category="compliance_advance"
            submitting={paymentSubmitting}
            onConfirm={(values) => {
              void onConfirmPayment?.(summary, "compliance_advance", values);
            }}
          />
        </View>
      ) : null}

      {!advance && canPay && !showInlineForm && onOpenPayModal ? (
        <TouchableOpacity
          style={styles.checklistPayBtn}
          activeOpacity={0.85}
          onPress={() => onOpenPayModal(summary)}
          accessibilityRole="button"
          accessibilityLabel="Pay advance"
        >
          <Text style={styles.checklistPayBtnText}>Pay advance</Text>
        </TouchableOpacity>
      ) : null}

      {advanceBlockers.length > 0 ? (
        <View style={styles.checklistBlockerBox}>
          {advanceBlockers.slice(0, 3).map((line) => (
            <Text key={line} style={styles.checklistBlockerText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function TripListRow({
  summary,
  selected,
  organizationId,
  truckType,
  supplierName,
  onPress,
}: {
  summary: ComplianceTripSummary;
  selected: boolean;
  organizationId: string;
  truckType: string | null;
  supplierName: string | null;
  onPress: () => void;
}) {
  const router = useRouter();
  const trip = summary.trip;
  const verification = verificationStatusVisual(summary);
  const isRejected = Boolean(summary.complianceVerifiedAt && summary.complianceDeclinedAt);
  const customerName = trip.client_name?.trim() || "—";
  const supplierLabel = (supplierName ?? trip.supplier_name)?.trim() || "—";
  const origin = splitHubRouteLocationDisplay(trip.pickup_area ?? "");
  const dest = splitHubRouteLocationDisplay(trip.drop_location ?? "");
  const vehicle =
    formatIndianVehicleNumber(trip.vehicle_display_number?.trim() || "").trim() ||
    trip.vehicle_display_number?.trim() ||
    "—";
  const truckLabel = truckType?.trim() || "—";
  const inTransitAt = formatComplianceTimestamp(trip.started_at);
  const executionModel = getTripExecutionModel(trip);
  const isAsset = executionModel === "asset";
  const headerName = supplierLabel !== "—" ? supplierLabel : customerName;
  const headerSeed = trip.supplier_id ?? trip.client_id ?? trip.id;
  const supplierId = (trip.supplier_id ?? "").trim();
  const canOpenSupplier =
    Boolean(supplierId) &&
    supplierLabel !== "—" &&
    supplierLabel.toLowerCase() !== "own fleet";
  const tripIdLabel = getTripDisplayNumber(trip, organizationId || null);

  const openSupplierProfile = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation?.();
      if (!canOpenSupplier) return;
      router.push(ROUTES.supplierProfile(supplierId) as Href);
    },
    [canOpenSupplier, router, supplierId],
  );

  const openTripOperations = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation?.();
      router.push(ROUTES.tripDetail(trip.id) as Href);
    },
    [router, trip.id],
  );

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        selected && styles.rowSelected,
        isRejected && styles.rowRejected,
        selected && isRejected && styles.rowRejectedSelected,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${headerName}, ${tripIdLabel}, ${verification.label}`}
    >
      <View style={styles.rowHead}>
        <View style={styles.rowPartyBlock}>
          <Pressable
            onPress={canOpenSupplier ? openSupplierProfile : undefined}
            disabled={!canOpenSupplier}
            style={({ pressed }) => [
              styles.rowSupplierHit,
              canOpenSupplier && pressed && styles.rowPartyHitPressed,
            ]}
            hitSlop={{ top: 6, bottom: 2, left: 4, right: 4 }}
            accessibilityRole={canOpenSupplier ? "link" : "none"}
            accessibilityLabel={
              canOpenSupplier ? `Open ${headerName} supplier profile` : undefined
            }
            accessibilityState={{ disabled: !canOpenSupplier }}
          >
            <PartyAvatar
              name={headerName}
              entityType={trip.supplier_id ? "supplier" : "client"}
              size={26}
              initialsColorSeed={headerSeed}
            />
            <Text
              style={[
                styles.client,
                selected && styles.clientSelected,
                canOpenSupplier && styles.clientLink,
                isRejected && styles.clientRejected,
              ]}
              numberOfLines={1}
            >
              {headerName.toUpperCase()}
            </Text>
          </Pressable>

          <View style={styles.idLine}>
            <Pressable
              onPress={openTripOperations}
              style={({ pressed }) => [
                styles.tripIdHit,
                pressed && styles.rowPartyHitPressed,
              ]}
              hitSlop={{ top: 4, bottom: 6, left: 2, right: 4 }}
              accessibilityRole="link"
              accessibilityLabel={`Open trip ${tripIdLabel} in Trip Operations`}
            >
              <Text
                style={[styles.tripIdLink, selected && styles.tripIdLinkSelected]}
                numberOfLines={1}
              >
                {tripIdLabel}
              </Text>
            </Pressable>
            <View style={[styles.modelTag, isAsset ? styles.modelTagAsset : styles.modelTagAggregate]}>
              <Text
                style={[
                  styles.modelTagText,
                  isAsset ? styles.modelTagTextAsset : styles.modelTagTextAggregate,
                ]}
              >
                {isAsset ? "Asset" : "Aggregate"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.rowMeta}>
          <View style={[styles.statusPill, { backgroundColor: verification.tone.bg }]}>
            <Text style={[styles.statusText, { color: verification.tone.fg }]} numberOfLines={1}>
              {verification.label.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {isRejected && summary.complianceDeclineReason?.trim() ? (
        <Text style={styles.rejectReasonLine} numberOfLines={2}>
          {summary.complianceDeclineReason.trim()}
        </Text>
      ) : null}

      <View style={styles.route}>
        <View style={styles.leg}>
          <Text style={[styles.city, selected && styles.citySelected]} numberOfLines={1}>
            {origin.city || "—"}
          </Text>
          <Text style={[styles.region, selected && styles.regionSelected]} numberOfLines={1}>
            {origin.state || " "}
          </Text>
        </View>
        <View style={styles.arrowSlot}>
          <Text style={[styles.arrow, selected && styles.arrowSelected]}>→</Text>
        </View>
        <View style={[styles.leg, styles.legEnd]}>
          <Text style={[styles.city, styles.alignEnd, selected && styles.citySelected]} numberOfLines={1}>
            {dest.city || "—"}
          </Text>
          <Text style={[styles.region, styles.alignEnd, selected && styles.regionSelected]} numberOfLines={1}>
            {dest.state || " "}
          </Text>
        </View>
      </View>

      <View style={[styles.facts, selected && styles.factsSelected, isRejected && styles.factsRejected]}>
        <View style={styles.factCell}>
          <Text style={[styles.factLabel, selected && styles.factLabelSelected]}>Customer</Text>
          <Text style={[styles.factValue, selected && styles.factValueSelected]} numberOfLines={1}>
            {customerName}
          </Text>
        </View>
        <View style={[styles.factCell, styles.factCellEnd]}>
          <Text style={[styles.factValueBare, styles.alignEnd, selected && styles.factValueSelected]} numberOfLines={1}>
            {vehicle}
          </Text>
        </View>
        <View style={styles.factCell}>
          <Text style={[styles.factValueBare, selected && styles.factValueSelected]} numberOfLines={1}>
            {truckLabel}
          </Text>
        </View>
        <View style={[styles.factCell, styles.factCellEnd]}>
          <Text style={[styles.factValueBare, styles.alignEnd, selected && styles.factValueSelected]} numberOfLines={1}>
            {inTransitAt}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  workspace: { flex: 1, minHeight: 0, flexDirection: "row", alignItems: "stretch", gap: 16, overflow: "hidden" },
  workspaceStacked: { flexDirection: "column" },
  listPane: {
    width: 320,
    maxWidth: "34%",
    flexShrink: 0,
    minHeight: 0,
    height: "100%",
    alignSelf: "stretch",
    backgroundColor: Theme.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    overflow: "hidden",
  },
  listPaneStacked: { width: "100%", maxWidth: "100%", height: "42%", maxHeight: "42%" },
  listEmpty: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  listScroll: { flex: 1 },
  listContent: { padding: 8, gap: 6 },
  row: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.complianceTripCardBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  rowSelected: {
    borderWidth: 1.5,
    borderColor: Theme.complianceTripCardSelectedBorder,
    backgroundColor: Theme.complianceTripCardSelectedBg,
  },
  rowRejected: {
    borderColor: Theme.complianceStageDocsFg,
    backgroundColor: Theme.complianceStageDocsBg,
  },
  rowRejectedSelected: {
    borderColor: Theme.complianceStageDocsFg,
    borderWidth: 1.5,
    backgroundColor: Theme.complianceStageDocsBg,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 0,
    maxWidth: 132,
  },
  rejectReasonLine: {
    fontSize: 10,
    fontWeight: "500",
    color: Theme.complianceStageDocsFg,
    lineHeight: 13,
  },
  clientRejected: {
    color: Theme.complianceStageDocsFg,
  },
  factsRejected: {
    borderTopColor: Theme.complianceStageDocsFg,
  },
  rowPartyBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowSupplierHit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    borderRadius: 8,
    paddingVertical: 1,
  },
  rowPartyHitPressed: { opacity: 0.85 },
  client: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: Theme.textPrimaryDark,
  },
  clientSelected: { color: Theme.complianceTripCardOnSelected },
  clientLink: {
    color: Theme.complianceBulk,
    textDecorationLine: "underline",
    textDecorationColor: Theme.complianceBulk,
  },
  idLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 34,
    minWidth: 0,
  },
  tripIdHit: {
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 4,
    paddingVertical: 1,
  },
  tripIdLink: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.15,
    color: Theme.complianceBulk,
    textDecorationLine: "underline",
    textDecorationColor: Theme.complianceBulk,
  },
  tripIdLinkSelected: {
    color: Theme.complianceTripCardOnSelected,
    textDecorationColor: Theme.complianceTripCardOnSelected,
  },
  tripId: { flexShrink: 1, fontSize: 10, fontWeight: "500", color: Theme.textSecondary },
  tripIdSelected: { color: Theme.complianceTripCardMutedOnSelected },
  modelTag: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  modelTagAsset: { backgroundColor: Theme.positiveMuted },
  modelTagAggregate: { backgroundColor: Theme.complianceStageInfoBg },
  modelTagText: { fontSize: 8, fontWeight: "600", letterSpacing: 0.2, lineHeight: 11 },
  modelTagTextAsset: { color: Theme.darkGreen },
  modelTagTextAggregate: { color: Theme.complianceStageInfoFg },
  statusPill: { maxWidth: 108, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 8, fontWeight: "600", letterSpacing: 0.3 },
  route: { flexDirection: "row", alignItems: "center" },
  leg: { flex: 1, minWidth: 0 },
  legEnd: { alignItems: "flex-end" },
  city: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
  },
  citySelected: { color: Theme.complianceTripCardOnSelected },
  region: { fontSize: 9, fontWeight: "400", color: Theme.textMuted, marginTop: 0 },
  regionSelected: { color: Theme.complianceTripCardMutedOnSelected },
  alignEnd: { textAlign: "right", alignSelf: "stretch" },
  arrowSlot: { width: 22, alignItems: "center", justifyContent: "center" },
  arrow: { fontSize: 12, fontWeight: "400", color: Theme.complianceStageInfoFg },
  arrowSelected: { color: Theme.complianceTripCardOnSelected },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    rowGap: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
    paddingTop: 6,
  },
  factsSelected: { borderTopColor: Theme.complianceTripCardDividerOnSelected },
  factCell: { width: "50%", paddingRight: 6, minWidth: 0, justifyContent: "flex-end" },
  factCellEnd: { paddingRight: 0, paddingLeft: 6, alignItems: "flex-end" },
  factLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.textMuted,
    lineHeight: 10,
  },
  factLabelSelected: { color: Theme.complianceTripCardMutedOnSelected },
  factValue: { fontSize: 10, fontWeight: "500", color: Theme.textSecondary, lineHeight: 13, marginTop: 1 },
  factValueBare: { fontSize: 10, fontWeight: "500", color: Theme.textSecondary, lineHeight: 13 },
  factValueSelected: { color: Theme.complianceTripCardMutedOnSelected },
  previewPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: Theme.cardWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  tabRow: { flexShrink: 0, height: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tabGroup: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
  tab: {
    height: 22,
    minHeight: 22,
    maxHeight: 22,
    minWidth: 58,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    overflow: "hidden",
  },
  tabActive: { backgroundColor: Theme.buttonDark, borderColor: Theme.buttonDark },
  tabText: { fontSize: 11, fontWeight: "500", lineHeight: 14, textAlign: "center", color: Theme.textPrimaryDark },
  tabTextActive: { color: Theme.buttonDarkText, fontWeight: "600" },
  tabBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.complianceStageDocsBg,
  },
  tabBadgeActive: { backgroundColor: Theme.cardWhite },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 11,
    color: Theme.complianceStageDocsFg,
  },
  tabBadgeTextActive: { color: Theme.complianceStageDocsFg },
  stage: {
    flex: 1,
    minHeight: 0,
    borderRadius: 8,
    backgroundColor: Theme.compliancePageBg,
    overflow: "hidden",
  },
  openLayer: {
    ...StyleSheet.absoluteFillObject,
    cursor: "zoom-in",
  } as ViewStyle,
  screenRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.overlayBackdrop,
  },
  screenBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  screenSheet: {
    maxWidth: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
  },
  screenBar: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Theme.cardWhite,
    borderBottomWidth: 1,
    borderBottomColor: Theme.complianceCardBorder,
  },
  screenBarCompact: {
    flexWrap: "wrap",
  },
  screenTitle: { flex: 1, minWidth: 120, fontSize: 14, fontWeight: "600", color: Theme.textPrimaryDark },
  screenPages: { flexDirection: "row", alignItems: "center", gap: 4 },
  screenPageLabel: {
    minWidth: 52,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  screenTools: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  screenPercent: { minWidth: 48, textAlign: "center", fontSize: 13, fontWeight: "600", color: Theme.textPrimaryDark },
  screenTool: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.compliancePageBg,
  },
  screenClose: {
    width: 44,
    height: 44,
    marginLeft: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.compliancePageBg,
  },
  screenStage: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.compliancePageBg,
  },
  screenPage: { width: "100%", height: "100%" },
  screenFile: { width: "100%", height: "100%" },
  previewTools: { flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  podBtn: {
    flexShrink: 0,
    height: 22,
    minHeight: 22,
    maxHeight: 22,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  podBtnText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
    color: Theme.textPrimaryDark,
  },
  zoomBar: {
    flexShrink: 0,
    height: 22,
    minHeight: 22,
    maxHeight: 22,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    borderRadius: 999,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    overflow: "hidden",
  },
  zoomBtn: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  zoomLabel: { fontSize: 10, fontWeight: "500", lineHeight: 12, color: Theme.textPrimaryDark, minWidth: 32, textAlign: "center" },
  stageBody: { flex: 1, minHeight: 0, width: "100%" },
  stageScroll: { flex: 1, width: "100%", minHeight: 0 },
  stageFill: { width: "100%", height: "100%" },
  stageScrollCenter: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  stageScrollStart: { flexGrow: 1, alignItems: "flex-start", justifyContent: "flex-start" },
  typedCard: {
    minWidth: 280,
    maxWidth: 420,
    width: "100%",
    padding: 16,
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
  },
  typedTitle: { fontSize: 13, fontWeight: "700", color: Theme.textPrimaryDark, marginBottom: 4 },
  typedRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  typedLabel: { fontSize: 12, color: Theme.textMuted },
  typedValue: { fontSize: 12, fontWeight: "600", color: Theme.textPrimaryDark },
  emptyStage: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  missingListScroll: { flexGrow: 0, flexShrink: 1, flexBasis: "auto" },
  checklistStage: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    paddingHorizontal: 6,
    paddingBottom: 6,
    paddingTop: 2,
  },
  checklistStageStacked: {
    flexDirection: "column",
  },
  checklistListPane: {
    width: 360,
    maxWidth: "46%",
    flexShrink: 0,
    minHeight: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.complianceTripCardBg,
    overflow: "hidden",
  },
  checklistListPaneStacked: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "46%",
    flexShrink: 1,
  },
  checklistPanelToolbar: {
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.complianceTripCardBg,
  },
  checklistPanelTabs: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexWrap: "nowrap",
  },
  checklistPanelTab: {
    flexShrink: 1,
    minWidth: 0,
    height: 22,
    paddingHorizontal: 5,
    paddingVertical: 0,
    gap: 3,
  },
  checklistPanelTabText: {
    fontSize: 9,
    lineHeight: 11,
  },
  checklistPanelTabBadge: {
    minWidth: 12,
    height: 12,
    paddingHorizontal: 3,
  },
  checklistPanelTabBadgeText: {
    fontSize: 8,
    lineHeight: 10,
  },
  checklistUploadPill: {
    flexShrink: 0,
    height: 22,
    paddingHorizontal: 7,
  },
  checklistUploadPillText: {
    fontSize: 8,
  },
  checklistListScroll: {
    flex: 1,
    minHeight: 0,
  },
  checklistListContent: {
    paddingVertical: 2,
  },
  checklistListFooter: {
    flexShrink: 0,
    minHeight: 28,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.compliancePageBg,
  },
  checklistPreviewActionsSection: {
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.complianceTripCardBg,
  },
  checklistPreviewActionsLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: Theme.textMuted,
  },
  checklistPreviewActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checklistModeBtn: {
    flex: 1,
    minWidth: 0,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  checklistModeBtnActive: {
    backgroundColor: Theme.buttonDark,
    borderColor: Theme.buttonDark,
  },
  checklistModeBtnText: {
    fontSize: 9,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  checklistModeBtnTextActive: {
    color: Theme.buttonDarkText,
  },
  checklistFooterVaultText: {
    fontSize: 9,
    fontWeight: "400",
    color: Theme.textMuted,
  },
  checklistInfoScroll: {
    flex: 1,
    minHeight: 0,
  },
  checklistInfoContent: {
    flexGrow: 1,
    padding: 12,
    paddingBottom: 20,
    gap: 10,
  },
  checklistInfoTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
  },
  checklistInfoHint: {
    fontSize: 9,
    fontWeight: "400",
    color: Theme.textMuted,
    marginTop: -6,
  },
  checklistAdvanceStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
  },
  checklistAdvanceFormCard: {
    width: "100%",
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  checklistAdvanceStatusLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  checklistAdvanceStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "70%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  checklistAdvanceStatusPillReady: {
    backgroundColor: Theme.positiveMuted,
    borderColor: Theme.positiveMutedDarkBorder,
  },
  checklistAdvanceStatusPillPosted: {
    backgroundColor: Theme.compliancePageBg,
    borderColor: Theme.complianceTripCardBorder,
  },
  checklistAdvanceStatusPillBlocked: {
    backgroundColor: Theme.complianceStageDocsBg,
    borderColor: Theme.complianceStageDocsFg,
  },
  checklistAdvanceStatusPillPending: {
    backgroundColor: Theme.compliancePageBg,
    borderColor: Theme.complianceTripCardBorder,
  },
  checklistAdvanceStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checklistAdvanceStatusDotReady: { backgroundColor: Theme.darkGreen },
  checklistAdvanceStatusDotPosted: { backgroundColor: Theme.textSecondary },
  checklistAdvanceStatusDotBlocked: { backgroundColor: Theme.complianceStageDocsFg },
  checklistAdvanceStatusDotPending: { backgroundColor: Theme.textMuted },
  checklistAdvanceStatusText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  checklistAdvanceStatusTextReady: { color: Theme.darkGreen },
  checklistAdvanceStatusTextPosted: { color: Theme.textPrimaryDark },
  checklistAdvanceStatusTextBlocked: { color: Theme.complianceStageDocsFg },
  checklistAdvanceStatusTextPending: { color: Theme.textSecondary },
  checklistInfoCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
  },
  checklistPayBtn: {
    height: 36,
    borderRadius: 8,
    backgroundColor: Theme.positive,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistPayBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.cardWhite,
    letterSpacing: 0.2,
  },
  checklistBlockerBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.complianceStageDocsFg,
    backgroundColor: Theme.complianceStageDocsBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  checklistBlockerText: {
    fontSize: 9,
    fontWeight: "500",
    color: Theme.complianceStageDocsFg,
    lineHeight: 12,
  },
  checklistBankPreviewWrap: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  checklistBankPreviewDoc: {
    flex: 1,
    minHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
  },
  checklistBankDetailsScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 200,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.compliancePageBg,
  },
  checklistBankDetailsScrollSolo: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.compliancePageBg,
  },
  checklistBankDetailsContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 6,
  },
  checklistBankDetailsTitle: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
  },
  checklistBankDetailsHint: {
    fontSize: 9,
    fontWeight: "400",
    color: Theme.textMuted,
    marginTop: -2,
    marginBottom: 2,
  },
  bankCardHeader: {
    gap: 4,
    marginBottom: 4,
  },
  bankCardHeaderCopy: {
    gap: 2,
  },
  bankCardMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textSecondary,
    textAlign: "left",
  },
  bankFieldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    alignItems: "stretch",
  },
  bankFieldCell: {
    minWidth: 110,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 110,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    justifyContent: "center",
  },
  bankFieldLabel: {
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  bankFieldValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.2,
    fontVariant: ["tabular-nums"],
  },
  bankProofSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
    gap: 6,
  },
  bankProofLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  bankProofRow: {
    gap: 4,
  },
  bankProofCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  bankProofTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    flexShrink: 1,
  },
  bankProofHint: {
    fontSize: 9,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  bankVerifiedChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Theme.positiveMuted,
  },
  bankVerifiedChipText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.darkGreen,
  },
  bankPendingChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Theme.compliancePageBg,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
  },
  bankPendingChipText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.textSecondary,
  },
  bankSourceHint: {
    fontSize: 9,
    fontWeight: "500",
    color: Theme.textMuted,
    marginTop: 1,
  },
  checklistDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  checklistDetailRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
  },
  checklistDetailLabel: {
    width: 128,
    flexShrink: 0,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.textMuted,
    paddingTop: 1,
  },
  checklistDetailValue: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    lineHeight: 15,
  },
  missingListContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  missingHeader: {
    gap: 2,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.complianceTripCardBorder,
  },
  missingTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: Theme.textPrimaryDark,
  },
  missingSubtitle: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
    color: Theme.complianceStageDocsFg,
  },
  missingHint: {
    fontSize: 9,
    fontWeight: "400",
    lineHeight: 12,
    marginTop: 1,
    color: Theme.textMuted,
  },
  missingCard: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.complianceTripCardBg,
    overflow: "hidden",
  },
  missingRow: {
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  missingRowSelected: {
    backgroundColor: Theme.complianceTripCardSelectedBg,
    borderLeftWidth: 1.5,
    borderLeftColor: Theme.complianceTripCardSelectedBorder,
  },
  missingRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
  },
  missingRowCopy: { flex: 1, minWidth: 0, gap: 2 },
  missingRowActions: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 0 },
  missingTitleRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  missingDocName: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: Theme.textPrimaryDark,
  },
  missingScopeTag: {
    flexShrink: 0,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  missingScopeRequired: { backgroundColor: Theme.complianceStageDocsBg },
  missingScopeOptional: { backgroundColor: Theme.complianceStageInfoBg },
  missingScopeText: { fontSize: 8, fontWeight: "600", letterSpacing: 0.2, lineHeight: 11 },
  missingScopeTextRequired: { color: Theme.complianceStageDocsFg },
  missingScopeTextOptional: { color: Theme.complianceStageInfoFg },
  missingStatus: { fontSize: 9, fontWeight: "400", color: Theme.textMuted, marginTop: 1 },
  missingEyeBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  missingEyeBtnDisabled: { opacity: 0.4 },
  missingUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: Theme.positive,
  },
  missingUploadBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.cardWhite,
  },
  checklistPreviewPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
  },
  checklistPreviewPaneStacked: {
    minHeight: 220,
    flex: 1,
  },
  checklistPreviewBody: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: Theme.compliancePageBg,
    padding: 8,
  },
  checklistDecisionBar: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
  },
  checklistDecisionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  checklistDecisionNavGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  checklistDecisionDecline: {
    minWidth: 104,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Theme.complianceStageDocsFg,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDecisionDeclineActive: {
    backgroundColor: Theme.complianceStageDocsFg,
    borderColor: Theme.complianceStageDocsFg,
  },
  checklistDecisionDeclineText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: Theme.complianceStageDocsFg,
  },
  checklistDecisionDeclineTextActive: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: Theme.cardWhite,
  },
  checklistDecisionApprove: {
    minWidth: 104,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Theme.positive,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDecisionApproveActive: {
    backgroundColor: Theme.positive,
    opacity: 1,
  },
  checklistDecisionApproveText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: Theme.cardWhite,
  },
  checklistDecisionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checklistDecisionSpacer: {
    flex: 1,
    minWidth: 8,
  },
  checklistDecisionReject: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Theme.complianceStageDocsFg,
    backgroundColor: Theme.complianceStageDocsBg,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDecisionRejectText: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.complianceStageDocsFg,
    letterSpacing: 0.2,
  },
  checklistDecisionPay: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Theme.brandBlueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistDecisionPayText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  checklistDecisionNav: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistPreviewEmpty: {
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 4,
  },
  checklistPreviewEmptyTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
    textAlign: "center",
  },
  checklistPreviewEmptyHint: {
    fontSize: 9,
    lineHeight: 12,
    color: Theme.textMuted,
    textAlign: "center",
    maxWidth: 240,
  },
  checklistTypedWrap: {
    padding: 12,
    gap: 8,
  },
  missingNavPill: {
    flexShrink: 0,
    height: 22,
    minHeight: 22,
    maxHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Theme.complianceStageDocsFg,
    backgroundColor: Theme.complianceStageDocsBg,
    alignItems: "center",
    justifyContent: "center",
  },
  missingNavLabel: {
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 11,
    color: Theme.complianceStageDocsFg,
  },
  missingFooterMeta: { flex: 1, minWidth: 0, paddingRight: 8 },
  missingFooterText: { fontSize: 9, fontWeight: "400", color: Theme.textMuted },
  missingPreviewOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 26,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
  },
  missingPreviewOpenBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textPrimaryDark,
  },
  navPill: {
    flexShrink: 1,
    minWidth: 0,
    height: 22,
    minHeight: 22,
    maxHeight: 22,
    paddingVertical: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Theme.cardWhite,
    borderRadius: 999,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    overflow: "hidden",
  },
  navLabel: { fontSize: 11, fontWeight: "500", lineHeight: 14, color: Theme.textPrimaryDark, maxWidth: 88 },
  decisionRow: {
    flexShrink: 0,
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 2,
  },
  declineBtn: {
    height: 32,
    minHeight: 32,
    paddingVertical: 0,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.negative,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: Theme.cardWhite,
  },
  declineText: { fontSize: 12, fontWeight: "600", lineHeight: 16, color: Theme.negative },
  approveBtn: {
    height: 32,
    minHeight: 32,
    paddingVertical: 0,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: Theme.positive,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  approveText: { fontSize: 12, fontWeight: "600", lineHeight: 16, color: Theme.cardWhite },
  actionEnd: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  payBtn: {
    height: 32,
    minHeight: 32,
    paddingVertical: 0,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: Theme.buttonPrimary,
    borderWidth: 1,
    borderColor: Theme.buttonPrimaryBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  payText: { fontSize: 11, fontWeight: "600", lineHeight: 14, color: Theme.buttonPrimaryText },
  navBtn: {
    height: 22,
    minHeight: 22,
    maxHeight: 22,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Theme.complianceCardBorder,
    backgroundColor: Theme.cardWhite,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "hidden",
  },
  navBtnText: { fontSize: 11, fontWeight: "500", lineHeight: 14, color: Theme.textPrimaryDark },
  btnDisabled: { opacity: 0.45 },
});
