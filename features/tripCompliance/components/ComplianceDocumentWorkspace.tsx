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
import { setTripDocumentVerification } from "@/features/tripCompliance/services/tripComplianceWrite.service";
import {
  COMPLIANCE_DRIVER_DOCUMENT_TYPES,
  COMPLIANCE_VEHICLE_DOCUMENT_TYPES,
  documentRequiresExpiry,
  type ComplianceTripSummary,
} from "@/features/tripCompliance/tripCompliance.types";
import {
  complianceTripDisplayId,
  formatComplianceTimestamp,
  verificationStatusVisual,
} from "@/features/tripCompliance/utils/complianceCardVisual.util";
import {
  deriveComplianceDocumentRows,
  deriveEntityComplianceRows,
  deriveFinanceDocumentRows,
  labelForDocType,
  requirementScopeLabel,
  type ComplianceDocRow,
} from "@/features/tripCompliance/utils/complianceDocumentRows.util";
import {
  applyOptimisticDecision,
  canModerateComplianceRow,
  complianceReviewDecisionActions,
  recordOptimisticDecision,
  type OptimisticComplianceDecision,
} from "@/features/tripCompliance/utils/complianceReviewActions.util";
import type { ComplianceChange } from "@/features/tripCompliance/services/compliancePipelineSync.service";
import { classifyTripDocument, readTypedDetails } from "@/features/tripCompliance/utils/tripDocumentClassification.util";
import { deriveComplianceQueueReadiness, paymentReadinessLabel } from "@/features/tripCompliance/utils/complianceReadiness.util";
import { alertMessage } from "@/features/tripCompliance/utils/crossPlatformAlert.util";
import { markTripHardCopyPodReceived } from "@/features/trips/services/tripDocumentLrPod.service";
import { splitHubRouteLocationDisplay } from "@/features/trips/utils/tripLocationDisplay.util";
import { getTripExecutionModel } from "@/features/trips/domain/tripExecutionModel";
import {
  markVehicleDocumentVerified,
  resolveVehicleDocumentsWriteTarget,
  updateVehicleDocumentExpiry,
} from "@/features/vehicles/services/vehicleDocuments.service";
import type { VehicleComplianceDocType } from "@/features/vehicles/utils/vehicleDocuments.util";
import { formatIndianVehicleNumber } from "@/lib/format";
import { SIGNED_URL_CACHE_TTL_MS, SIGNED_URL_EXPIRY_SEC } from "@/lib/storageSignedUrlCache";
import { useComplianceListTripFacts } from "@/features/tripCompliance/hooks/useComplianceListTripFacts";
import { ChevronLeft, ChevronRight, Eye, Minus, Plus, RotateCcw, Upload, X } from "lucide-react-native";
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
  return Boolean(row.entityDoc?.storage_path);
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
  const [declineOpen, setDeclineOpen] = useState(false);
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

  const summary = summaries.find((item) => item.trip.id === selectedId) ?? summaries[0] ?? null;
  const isPendingDocsTrip = Boolean(summary && verificationStatusVisual(summary).kind === "pending_docs");
  const rows = useMemo(() => (summary ? rowsForTab(summary, tab) : []), [summary, tab]);
  const missingUploadRows = useMemo(
    () => rows.filter((row) => row.status === "missing"),
    [rows],
  );
  const entityUnassigned =
    (tab === "vehicle" && !summary?.trip.vehicle_id) ||
    (tab === "driver" && !summary?.trip.driver_id);
  const showVaultChecklist =
    !entityUnassigned &&
    rows.length > 0 &&
    (tab !== "trip" || isPendingDocsTrip) &&
    (missingUploadRows.length > 0 || rows.some(hasFile));
  const showEntityUnassigned = Boolean(summary && entityUnassigned);
  const checklistRows = showVaultChecklist ? rows : [];
  const financeRows = useMemo(
    () => (summary ? deriveFinanceDocumentRows(summary.documents) : []),
    [summary],
  );
  const checklistSelectedRow = useMemo(() => {
    if (!showVaultChecklist) return null;
    return (
      checklistRows.find((row) => row.key === checklistKey) ??
      financeRows.find((row) => row.key === checklistKey) ??
      null
    );
  }, [showVaultChecklist, checklistRows, financeRows, checklistKey]);
  const previewable = useMemo(() => {
    if (showEntityUnassigned) return [];
    if (showVaultChecklist) return checklistRows.filter(hasFile);
    return rows.filter(hasFile);
  }, [rows, showVaultChecklist, showEntityUnassigned, checklistRows]);
  const activeRow = showEntityUnassigned
    ? null
    : showVaultChecklist
      ? checklistSelectedRow && hasFile(checklistSelectedRow)
        ? checklistSelectedRow
        : null
      : previewable[docIndex] ?? rows[docIndex] ?? null;
  const effectiveActiveRow = useMemo(() => {
    if (!activeRow) return null;
    return applyOptimisticDecision(activeRow, localDecisionByKey[activeRow.key]);
  }, [activeRow, localDecisionByKey]);
  const decisions = useMemo(() => {
    if (!effectiveActiveRow || !canModerateComplianceRow(effectiveActiveRow, tab)) {
      return { canApprove: false, canDecline: false };
    }
    return complianceReviewDecisionActions(effectiveActiveRow);
  }, [effectiveActiveRow, tab]);
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
    setDocIndex(0);
    setZoom(1);
    setChecklistPreviewMode("document");
    setDeclineOpen(false);
    setLocalDecisionByKey({});
    setExpiryPrompt((prev) => {
      prev?.resolve(null);
      return null;
    });
  }, [summary?.trip.id, tab]);

  useEffect(() => {
    if (!showVaultChecklist) {
      setChecklistKey(null);
      return;
    }
    setChecklistKey((prev) => {
      if (prev && checklistRows.some((row) => row.key === prev)) return prev;
      const firstWithFile = checklistRows.find(hasFile);
      const firstMissing = checklistRows.find((row) => row.status === "missing");
      return firstWithFile?.key ?? firstMissing?.key ?? checklistRows[0]?.key ?? null;
    });
  }, [showVaultChecklist, checklistRows, summary?.trip.id, tab]);

  const activePreviewPath =
    activeRow?.doc?.storage_path ?? activeRow?.entityDoc?.storage_path ?? null;
  const activePreviewSource = tab === "trip" ? "trip" : activeRow?.entityDoc?.source;
  const activePreviewEntityId =
    activeRow?.entityDoc?.entity_id ??
    (tab === "vehicle" ? summary?.trip.vehicle_id : summary?.trip.driver_id) ??
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
      source: tab === "trip" ? "trip" : nextRow.entityDoc?.source,
      sourceEntityDocumentId: nextRow.doc?.source_entity_document_id,
      organizationId,
      entityId:
        nextRow.entityDoc?.entity_id ??
        (tab === "vehicle" ? summary?.trip.vehicle_id : summary?.trip.driver_id) ??
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
    tab,
    summary?.trip.id,
    summary?.trip.vehicle_id,
    summary?.trip.driver_id,
  ]);

  const goNext = () => {
    if (previewable.length === 0) return;
    setDocIndex((index) => (index + 1) % previewable.length);
    setZoom(1);
  };
  const goPrev = () => {
    if (previewable.length === 0) return;
    setDocIndex((index) => (index - 1 + previewable.length) % previewable.length);
    setZoom(1);
  };

  /** Local UI follow-up only — each approve/decline branch sends its own typed ComplianceChange. */
  const finishDecision = useCallback(
    (row: ComplianceDocRow, decision: OptimisticComplianceDecision["decision"]) => {
      setLocalDecisionByKey((prev) => ({ ...prev, [row.key]: recordOptimisticDecision(row, decision) }));
      setDeclineOpen(false);
      setBusy(false);
      if (previewable.length > 1) {
        setDocIndex((index) => (index + 1) % previewable.length);
        setZoom(1);
      }
    },
    [previewable.length],
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
    if (!decisions.canApprove || !canModerateComplianceRow(activeRow, tab)) {
      alertMessage("Can't approve", "This document isn't ready to approve yet.");
      return;
    }

    const tripId = summary.trip.id;
    const row = activeRow;
    const existingExpiry = row.entityDoc?.expiry_date?.trim() ?? "";
    let expiryDate = existingExpiry;
    let enteredNewExpiry = false;

    if (tab !== "trip" && documentRequiresExpiry(row.type) && !expiryDate) {
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
      if (tab === "trip") {
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
    if (!decisions.canDecline || !canModerateComplianceRow(activeRow, tab)) {
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
      if (tab === "trip") {
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
  const docTitle = activeRow ? labelForDocType(activeRow.type) : "No document";
  const isPdf = (previewMime ?? "").includes("pdf");
  const readiness = summary ? deriveComplianceQueueReadiness(summary) : null;
  const typedLines = typedDetailsLines(activeRow);
  const showPay = Boolean(canManageFinance && readiness?.paymentReady && onPay && summary);
  const showMarkVerified = Boolean(
    onMarkComplianceVerified && summary && !summary.complianceVerifiedAt && readiness?.requiredDocs.markVerifiedReady,
  );
  const [markingVerified, setMarkingVerified] = useState(false);
  const vaultCopy = TAB_VAULT_COPY[tab];
  const missingRequiredCount = missingUploadRows.filter((row) => row.required).length;
  const missingOptionalCount = missingUploadRows.length - missingRequiredCount;
  const uploadedCount = checklistRows.filter(hasFile).length;
  const missingHeadline =
    missingUploadRows.length === 0
      ? uploadedCount > 0
        ? `${uploadedCount} document${uploadedCount === 1 ? "" : "s"} on file — preview below`
        : "No documents in this vault yet"
      : missingRequiredCount > 0
        ? `${missingRequiredCount} required document${missingRequiredCount === 1 ? "" : "s"} not uploaded`
        : `${missingUploadRows.length} document${missingUploadRows.length === 1 ? "" : "s"} not uploaded`;
  const missingSubline =
    missingUploadRows.length === 0
      ? "Use the eye icon to preview, or Upload to replace a file"
      : missingOptionalCount > 0 && missingRequiredCount > 0
        ? `Plus ${missingOptionalCount} optional from this ${vaultCopy.vaultLabel.toLowerCase()}`
        : vaultCopy.vaultHint;
  const openVaultUpload = useCallback(
    (documentKey: string | null) => {
      if (!summary || !onReviewTripDocs) return;
      setChecklistPreviewMode("document");
      if (documentKey) setChecklistKey(documentKey);
      onReviewTripDocs(summary.trip.id, documentKey, tab);
    },
    [onReviewTripDocs, summary, tab],
  );
  const previewChecklistRow = useCallback((row: ComplianceDocRow) => {
    setChecklistPreviewMode("document");
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
        {!showVaultChecklist ? (
        <View style={styles.tabRow}>
          <View style={styles.tabGroup}>
            {TABS.map((item) => {
              const active = tab === item.key;
              const missingCount = tabMissingCounts[item.key];
              const showTabBadge =
                missingCount > 0 &&
                (item.key !== "trip" || isPendingDocsTrip);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[styles.tab, active && styles.tabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
                  {showTabBadge ? (
                    <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                        {missingCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <View style={styles.previewTools}>
            {canManagePod && !isPendingDocsTrip ? (
              <Pressable
                style={[styles.podBtn, !summary && styles.btnDisabled]}
                disabled={!summary}
                onPress={() => setPodOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Log hardcopy POD"
              >
                <Text style={styles.podBtnText} numberOfLines={1}>
                  Log hardcopy POD
                </Text>
              </Pressable>
            ) : null}
            {showEntityUnassigned ? (
              <View style={styles.missingNavPill}>
                <Text style={styles.missingNavLabel} numberOfLines={1}>
                  Unassigned
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.navPill}>
                  <Pressable onPress={goPrev} hitSlop={8} accessibilityLabel="Previous document" disabled={previewable.length < 2}>
                    <ChevronLeft size={12} color={Theme.textPrimaryDark} />
                  </Pressable>
                  <Text style={styles.navLabel} numberOfLines={1}>{docTitle}</Text>
                  <Pressable onPress={goNext} hitSlop={8} accessibilityLabel="Next document" disabled={previewable.length < 2}>
                    <ChevronRight size={12} color={Theme.textPrimaryDark} />
                  </Pressable>
                </View>
                <View style={styles.zoomBar}>
                  <Pressable style={styles.zoomBtn} onPress={() => setZoom((value) => Math.max(0.6, Number((value - 0.2).toFixed(2))))} accessibilityLabel="Zoom out">
                    <Minus size={12} color={Theme.textPrimaryDark} />
                  </Pressable>
                  <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
                  <Pressable style={styles.zoomBtn} onPress={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))} accessibilityLabel="Zoom in">
                    <Plus size={12} color={Theme.textPrimaryDark} />
                  </Pressable>
                  <Pressable style={styles.zoomBtn} onPress={() => setZoom(1)} accessibilityLabel="Reset zoom">
                    <RotateCcw size={12} color={Theme.textPrimaryDark} />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
        ) : null}

        <View style={styles.stage}>
          {showEntityUnassigned ? (
            <View style={styles.emptyStage}>
              <View style={styles.missingHeader}>
                <Text style={styles.missingTitle}>{vaultCopy.unassignedTitle}</Text>
                <Text style={styles.missingHint}>{vaultCopy.unassignedHint}</Text>
              </View>
            </View>
          ) : showVaultChecklist ? (
            <View style={[styles.checklistStage, stacked && styles.checklistStageStacked]}>
              <View style={[styles.checklistListPane, stacked && styles.checklistListPaneStacked]}>
                <View style={styles.checklistPanelToolbar}>
                  <View style={styles.checklistPanelTabs}>
                    <Pressable
                      onPress={() => setChecklistPreviewMode("finance")}
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
                      const showTabBadge =
                        missingCount > 0 &&
                        (item.key !== "trip" || isPendingDocsTrip);
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => {
                            setTab(item.key);
                            setChecklistPreviewMode("document");
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
                          {showTabBadge ? (
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
                      {missingUploadRows.length > 0
                        ? `${missingUploadRows.length} to upload`
                        : `${uploadedCount} on file`}
                    </Text>
                  </View>
                </View>
                <View style={styles.missingHeader}>
                  <Text style={styles.missingTitle}>DOCUMENTS TO UPLOAD</Text>
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
                  {checklistRows.map((row, index) => {
                    const rowHasFile = hasFile(row);
                    const statusMeta = COMPLIANCE_STATUS_META[row.status];
                    const selected = checklistKey === row.key;
                    const uploadLabel = row.status === "missing" ? "Upload" : "Replace";
                    const statusLabel =
                      row.status === "missing"
                        ? "Not uploaded yet"
                        : rowHasFile
                          ? `${statusMeta.label} · ready to preview`
                          : statusMeta.label;
                    return (
                      <View
                        key={row.key}
                        style={[
                          styles.missingRow,
                          index > 0 && styles.missingRowBorder,
                          selected && styles.missingRowSelected,
                        ]}
                      >
                        <Pressable
                          style={styles.missingRowCopy}
                          onPress={() => previewChecklistRow(row)}
                          accessibilityRole="button"
                          accessibilityLabel={`${labelForDocType(row.type)} details`}
                        >
                          <View style={styles.missingTitleRow}>
                            <Text style={styles.missingDocName} numberOfLines={1}>
                              {labelForDocType(row.type).toUpperCase()}
                            </Text>
                            <View
                              style={[
                                styles.missingScopeTag,
                                row.required ? styles.missingScopeRequired : styles.missingScopeOptional,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.missingScopeText,
                                  row.required
                                    ? styles.missingScopeTextRequired
                                    : styles.missingScopeTextOptional,
                                ]}
                              >
                                {requirementScopeLabel(row.required)}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.missingStatus,
                              row.status === "missing" ? null : { color: statusMeta.color },
                            ]}
                            numberOfLines={1}
                          >
                            {statusLabel}
                          </Text>
                        </Pressable>
                        <View style={styles.missingRowActions}>
                          <TouchableOpacity
                            style={[styles.missingEyeBtn, !rowHasFile && styles.missingEyeBtnDisabled]}
                            activeOpacity={0.75}
                            disabled={!canViewDocuments || !rowHasFile}
                            onPress={() => previewChecklistRow(row)}
                            accessibilityRole="button"
                            accessibilityLabel={`Preview ${labelForDocType(row.type)}`}
                            accessibilityState={{ disabled: !rowHasFile }}
                          >
                            <Eye
                              size={12}
                              color={rowHasFile ? Theme.textPrimaryDark : Theme.textMuted}
                              strokeWidth={2.2}
                            />
                          </TouchableOpacity>
                          {onReviewTripDocs ? (
                            <TouchableOpacity
                              style={styles.missingUploadBtn}
                              activeOpacity={0.8}
                              onPress={() => openVaultUpload(row.key)}
                              accessibilityRole="button"
                              accessibilityLabel={`${uploadLabel} ${labelForDocType(row.type)}`}
                            >
                              <Upload size={11} color={Theme.cardWhite} strokeWidth={2.4} />
                              <Text style={styles.missingUploadBtnText}>{uploadLabel}</Text>
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
                  </View>
                </View>
                <View style={styles.checklistListFooter}>
                  <Text style={styles.checklistFooterVaultText} numberOfLines={1}>
                    {vaultCopy.vaultLabel} ·{" "}
                    {missingUploadRows.length > 0
                      ? `${missingUploadRows.length} remaining`
                      : `${uploadedCount} on file`}
                  </Text>
                </View>
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
                      onPay={onPay}
                    />
                  ) : checklistPreviewMode === "finance" && summary ? (
                    <ChecklistFinanceDocsPanel
                      rows={financeRows}
                      onPreview={previewChecklistRow}
                    />
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
                  ) : previewUrl ? (
                    <>
                      <OriginalDocumentPreview uri={previewUrl} isPdf={isPdf} zoom={zoom} label={docTitle} />
                      <Pressable
                        style={styles.openLayer}
                        onPress={() => setScreenOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${docTitle}`}
                      />
                    </>
                  ) : (
                    <View style={styles.checklistPreviewEmpty}>
                      <Text style={styles.checklistPreviewEmptyTitle}>
                        {checklistSelectedRow
                          ? `${labelForDocType(checklistSelectedRow.type)} has no file to preview`
                          : "Select a document to preview"}
                      </Text>
                      <Text style={styles.checklistPreviewEmptyHint}>
                        Tap the eye icon on an uploaded document, or use Finance / Trip Detail / Advance Payment.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : loadingPreview ? (
            <View style={styles.stageBody}>
              <ActivityIndicator color={Theme.textPrimaryDark} />
            </View>
          ) : typedLines && canViewDocuments ? (
            <View style={styles.emptyStage}>
              <View style={styles.typedCard}>
                <Text style={styles.typedTitle}>{docTitle} · entered details (no file)</Text>
                {typedLines.map((line, index) => (
                  <View key={`${line.label}-${index}`} style={styles.typedRow}>
                    <Text style={styles.typedLabel}>{line.label}</Text>
                    <Text style={styles.typedValue}>{line.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : previewUrl ? (
            <>
              <OriginalDocumentPreview uri={previewUrl} isPdf={isPdf} zoom={zoom} label={docTitle} />
              <Pressable
                style={styles.openLayer}
                onPress={() => setScreenOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${docTitle}`}
              />
            </>
          ) : (
            <View style={styles.emptyStage}>
              <NoDocumentPreviewEmpty
                compact={stacked}
                title={activeRow ? `${docTitle} has no file to preview.` : "No document to preview"}
                hint={activeRow ? undefined : "Select a document from the list to view its details here."}
              />
            </View>
          )}
        </View>

        {showVaultChecklist ? null : showEntityUnassigned ? (
          <View style={styles.decisionRow}>
            <View style={styles.missingFooterMeta}>
              <Text style={styles.missingFooterText} numberOfLines={1}>
                {vaultCopy.vaultLabel} · unavailable
              </Text>
            </View>
          </View>
        ) : (
        <View style={styles.decisionRow}>
          <Pressable
            style={[styles.declineBtn, (!decisions.canDecline || !canAct) && styles.btnDisabled]}
            // Keep pressable when gated — `disabled` swallows onPress so permission
            // / readiness alerts never fire and the buttons look "broken".
            disabled={busy}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            onPress={() => {
              if (!canVerify) {
                alertMessage("Can't decline", "You don't have permission to verify compliance documents.");
                return;
              }
              if (!actorId) {
                alertMessage("Can't decline", "Sign in again, then try Decline.");
                return;
              }
              if (!decisions.canDecline || !activeRow || !canModerateComplianceRow(activeRow, tab)) {
                alertMessage("Can't decline", "This document isn't ready to decline yet.");
                return;
              }
              setDeclineOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Decline document"
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable
            style={[styles.approveBtn, (!decisions.canApprove || !canAct) && styles.btnDisabled]}
            disabled={busy}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            onPress={() => void approve()}
            accessibilityRole="button"
            accessibilityLabel="Approve document"
          >
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
          <View style={styles.actionEnd}>
            {showMarkVerified && summary ? (
              <Pressable
                style={[styles.payBtn, markingVerified && styles.btnDisabled]}
                disabled={markingVerified}
                onPress={() => {
                  setMarkingVerified(true);
                  void onMarkComplianceVerified?.(summary.trip.id).finally(() => setMarkingVerified(false));
                }}
                accessibilityRole="button"
                accessibilityLabel="Mark compliance verified"
              >
                <Text style={styles.payText}>{markingVerified ? "Verifying…" : "Mark verified"}</Text>
              </Pressable>
            ) : null}
            {showPay && summary ? (
              <Pressable
                style={styles.payBtn}
                onPress={() => onPay?.(summary)}
                accessibilityRole="button"
                accessibilityLabel="Pay"
              >
                <Text style={styles.payText}>Pay</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.navBtn, previewable.length < 2 && styles.btnDisabled]}
              onPress={goPrev}
              disabled={previewable.length < 2}
              accessibilityRole="button"
              accessibilityLabel="Previous"
            >
              <ChevronLeft size={12} color={Theme.textPrimaryDark} />
              <Text style={styles.navBtnText}>Previous</Text>
            </Pressable>
            <Pressable
              style={[styles.navBtn, previewable.length < 2 && styles.btnDisabled]}
              onPress={goNext}
              disabled={previewable.length < 2}
              accessibilityRole="button"
              accessibilityLabel="Next"
            >
              <Text style={styles.navBtnText}>Next</Text>
              <ChevronRight size={12} color={Theme.textPrimaryDark} />
            </Pressable>
          </View>
        </View>
        )}
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
      <Text style={styles.checklistDetailLabel}>{label}</Text>
      <Text style={styles.checklistDetailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ChecklistFinanceDocsPanel({
  rows,
  onPreview,
}: {
  rows: ComplianceDocRow[];
  onPreview: (row: ComplianceDocRow) => void;
}) {
  return (
    <ScrollView
      style={styles.checklistInfoScroll}
      contentContainerStyle={styles.checklistInfoContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.checklistInfoTitle}>Finance documents</Text>
      <Text style={styles.checklistInfoHint}>
        Memo, POD, and other documents from the trip asset vault
      </Text>
      <View style={styles.checklistInfoCard}>
        {rows.length === 0 ? (
          <View style={styles.checklistDetailRow}>
            <Text style={styles.checklistDetailValue}>No finance documents on this trip</Text>
          </View>
        ) : (
          rows.map((row, index) => {
            const statusMeta = COMPLIANCE_STATUS_META[row.status];
            const rowHasFile = hasFile(row);
            const statusLabel =
              row.status === "missing"
                ? "Not uploaded yet"
                : rowHasFile
                  ? `${statusMeta.label} · ready to preview`
                  : statusMeta.label;
            return (
              <View
                key={row.key}
                style={[styles.checklistFinanceRow, index > 0 && styles.checklistDetailRowBorder]}
              >
                <View style={styles.checklistFinanceRowMain}>
                  <View style={styles.checklistFinanceRowTitleRow}>
                    <Text style={styles.checklistFinanceDocName} numberOfLines={1}>
                      {labelForDocType(row.type).toUpperCase()}
                    </Text>
                    <View
                      style={[
                        styles.missingScopeTag,
                        row.required ? styles.missingScopeRequired : styles.missingScopeOptional,
                      ]}
                    >
                      <Text
                        style={[
                          styles.missingScopeText,
                          row.required
                            ? styles.missingScopeTextRequired
                            : styles.missingScopeTextOptional,
                        ]}
                      >
                        {requirementScopeLabel(row.required)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.checklistFinanceStatus} numberOfLines={1}>
                    {statusLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.missingEyeBtn, !rowHasFile && styles.missingEyeBtnDisabled]}
                  activeOpacity={0.75}
                  disabled={!rowHasFile}
                  onPress={() => onPreview(row)}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${labelForDocType(row.type)}`}
                  accessibilityState={{ disabled: !rowHasFile }}
                >
                  <Eye
                    size={12}
                    color={rowHasFile ? Theme.textPrimaryDark : Theme.textMuted}
                    strokeWidth={2.2}
                  />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
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
  const verification = verificationStatusVisual(summary);
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

  const rows: { label: string; value: string }[] = [
    { label: "Trip ID", value: complianceTripDisplayId(trip) },
    { label: "Customer", value: customerName },
    { label: "Supplier", value: supplierLabel },
    { label: "Route", value: routeLine },
    { label: "Vehicle", value: vehicle },
    { label: "Truck type", value: truckLabel },
    { label: "Model", value: isAsset ? "Asset" : "Aggregate" },
    { label: "In-transit", value: inTransitAt },
    { label: "Status", value: verification.label },
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
  onPay,
}: {
  summary: ComplianceTripSummary;
  readiness: ReturnType<typeof deriveComplianceQueueReadiness> | null;
  canPay: boolean;
  onPay?: (summary: ComplianceTripSummary) => void;
}) {
  const advance = summary.advance;
  const payMeta = readiness ? paymentReadinessLabel(readiness) : null;
  const lane = readiness?.advance ?? null;

  return (
    <ScrollView
      style={styles.checklistInfoScroll}
      contentContainerStyle={styles.checklistInfoContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.checklistInfoTitle}>Advance payment</Text>
      <Text style={styles.checklistInfoHint}>Payment status for this trip's compliance advance</Text>
      <View style={styles.checklistInfoCard}>
        {advance ? (
          <>
            <ChecklistDetailRow label="Status" value="Advance processed" />
            <View style={styles.checklistDetailRowBorder}>
              <ChecklistDetailRow label="Amount" value={`₹${advance.amount.toLocaleString("en-IN")}`} />
            </View>
            <View style={styles.checklistDetailRowBorder}>
              <ChecklistDetailRow label="Mode" value={advance.paymentMode?.trim() || "—"} />
            </View>
            <View style={styles.checklistDetailRowBorder}>
              <ChecklistDetailRow label="UTR" value={advance.utr?.trim() || "—"} />
            </View>
            <View style={styles.checklistDetailRowBorder}>
              <ChecklistDetailRow label="Paid at" value={formatComplianceTimestamp(advance.paidAt)} />
            </View>
          </>
        ) : (
          <>
            <ChecklistDetailRow label="Status" value={lane?.status === "ready" ? "Ready to pay" : "Not posted"} />
            <View style={styles.checklistDetailRowBorder}>
              <ChecklistDetailRow label="Readiness" value={payMeta?.label ?? "—"} />
            </View>
            <View style={styles.checklistDetailRowBorder}>
              <ChecklistDetailRow
                label="Detail"
                value={lane?.reason?.trim() || payMeta?.detail?.trim() || readiness?.nextAction?.trim() || "—"}
              />
            </View>
          </>
        )}
      </View>
      {!advance && canPay && onPay ? (
        <TouchableOpacity
          style={styles.checklistPayBtn}
          activeOpacity={0.85}
          onPress={() => onPay(summary)}
          accessibilityRole="button"
          accessibilityLabel="Pay advance"
        >
          <Text style={styles.checklistPayBtnText}>Pay advance</Text>
        </TouchableOpacity>
      ) : null}
      {!advance && readiness?.blockerLines?.length ? (
        <View style={styles.checklistBlockerBox}>
          {readiness.blockerLines.slice(0, 4).map((line) => (
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
  truckType,
  supplierName,
  onPress,
}: {
  summary: ComplianceTripSummary;
  selected: boolean;
  truckType: string | null;
  supplierName: string | null;
  onPress: () => void;
}) {
  const trip = summary.trip;
  const verification = verificationStatusVisual(summary);
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

  return (
    <Pressable onPress={onPress} style={[styles.row, selected && styles.rowSelected]} accessibilityRole="button">
      <View style={styles.rowHead}>
        <PartyAvatar
          name={headerName}
          entityType={trip.supplier_id ? "supplier" : "client"}
          size={26}
          initialsColorSeed={headerSeed}
        />
        <View style={styles.rowTitle}>
          <Text style={[styles.client, selected && styles.clientSelected]} numberOfLines={1}>
            {headerName.toUpperCase()}
          </Text>
          <View style={styles.idLine}>
            <Text style={[styles.tripId, selected && styles.tripIdSelected]} numberOfLines={1}>
              {complianceTripDisplayId(trip)}
            </Text>
            <View style={[styles.modelTag, isAsset ? styles.modelTagAsset : styles.modelTagAggregate]}>
              <Text style={[styles.modelTagText, isAsset ? styles.modelTagTextAsset : styles.modelTagTextAggregate]}>
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

      <View style={[styles.facts, selected && styles.factsSelected]}>
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
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { flex: 1, minWidth: 0, gap: 0 },
  client: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2, color: Theme.textPrimaryDark },
  clientSelected: { color: Theme.complianceTripCardOnSelected },
  idLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1, minWidth: 0 },
  tripId: { flexShrink: 1, fontSize: 10, fontWeight: "500", color: Theme.textSecondary },
  tripIdSelected: { color: Theme.complianceTripCardMutedOnSelected },
  modelTag: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  modelTagAsset: { backgroundColor: Theme.positiveMuted },
  modelTagAggregate: { backgroundColor: Theme.complianceStageInfoBg },
  modelTagText: { fontSize: 8, fontWeight: "600", letterSpacing: 0.2, lineHeight: 11 },
  modelTagTextAsset: { color: Theme.darkGreen },
  modelTagTextAggregate: { color: Theme.complianceStageInfoFg },
  rowMeta: { maxWidth: 108, alignItems: "flex-end", justifyContent: "center" },
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
  checklistFinanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  checklistFinanceRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checklistFinanceRowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checklistFinanceDocName: {
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    letterSpacing: 0.2,
  },
  checklistFinanceStatus: {
    fontSize: 9,
    fontWeight: "400",
    color: Theme.textMuted,
  },
  checklistInfoScroll: {
    flex: 1,
    minHeight: 0,
  },
  checklistInfoContent: {
    padding: 12,
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
  checklistInfoCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.complianceTripCardBorder,
    backgroundColor: Theme.cardWhite,
    overflow: "hidden",
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
    width: 88,
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
    fontWeight: "500",
    color: Theme.textPrimaryDark,
    lineHeight: 14,
  },
  checklistPayBtn: {
    height: 32,
    borderRadius: 6,
    backgroundColor: Theme.positive,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistPayBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.cardWhite,
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
    borderRadius: 10,
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
