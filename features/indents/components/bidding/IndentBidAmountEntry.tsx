/**
 * Full-page bid amount entry (Get Load / Load Center) with the same
 * review → success celebration as story BidSheet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  FullscreenNumericEntry,
  parseRawToNumber,
  toRawString,
} from "@/components/mobile-input";
import type { NumericEntryPartyPreview } from "@/components/mobile-input";
import {
  BidConfirmModal,
  type BidConfirmPhase,
} from "@/features/network/components/bidding/BidConfirmModal";
import { PerMtBidGuidance } from "@/features/network/components/bidding/PerMtBidGuidance";
import {
  resolveExpectedTripValue,
  resolveVehiclePayloadTonnes,
  storedBidFromUnitRate,
  unitRateFromStoredBid,
} from "@/features/network/utils/bidding/perMtBidPresentation.util";
import { resolveCommercialPricing } from "@/features/marketplace/domain/commercialPricing";
import { formatINR } from "@/lib/format";

export interface IndentBidAmountEntryProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Persist the bid. Return true on success — entry shows celebration.
   * Do not close the entry yourself; celebration Done calls onClose.
   */
  onSubmitAmount: (amountInr: number) => Promise<boolean>;
  /** Optional toast / refresh after success celebration dismisses. */
  onSuccessDone?: () => void;
  indentDisplayNumber: string;
  origin?: string | null;
  destination?: string | null;
  /** e.g. Container / Trailer */
  vehicleType?: string | null;
  /** e.g. 30 t / 30000 KG */
  weightLabel?: string | null;
  material?: string | null;
  /** Load owner / client shown on confirm card. */
  ownerName?: string | null;
  /**
   * Supplier target as stored on the indent. When `saleRateBasis` is
   * `"per_mt"` this is the ₹/MT unit rate, not a trip total.
   */
  targetRateInr?: number;
  saleRateBasis?: "per_mt" | "per_trip" | string | null;
  /** Indent weight in KG — expands a per-MT target and stored bid. */
  weightKg?: number | null;
  /** Pre-fill when updating an existing quote. */
  initialAmount?: number | null;
  isUpdate?: boolean;
  validationError?: string;
  onClearValidationError?: () => void;
  onInvalidAmount?: () => void;
}

function routeSubtitle(
  origin?: string | null,
  destination?: string | null,
): string | undefined {
  const o = (origin ?? "").trim();
  const d = (destination ?? "").trim();
  if (!o && !d) return undefined;
  if (!o) return d;
  if (!d) return o;
  return `${o} → ${d}`;
}

function cleanSpec(value?: string | null): string | undefined {
  const v = (value ?? "").trim();
  if (!v || v === "—") return undefined;
  return v;
}

export function IndentBidAmountEntry({
  visible,
  onClose,
  onSubmitAmount,
  onSuccessDone,
  indentDisplayNumber,
  origin,
  destination,
  vehicleType,
  weightLabel,
  material,
  ownerName,
  targetRateInr,
  saleRateBasis,
  weightKg,
  initialAmount,
  isUpdate = false,
  validationError,
  onClearValidationError,
  onInvalidAmount,
}: IndentBidAmountEntryProps) {
  const title = isUpdate ? "Update your bid" : "Place your bid";

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhase, setConfirmPhase] = useState<BidConfirmPhase>("review");
  const [pendingAmount, setPendingAmount] = useState(0);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [estimateTonnes, setEstimateTonnes] = useState<number | null>(null);
  const [liveRaw, setLiveRaw] = useState("");
  const celebrationLockRef = useRef(false);

  const isPerMt = saleRateBasis === "per_mt";
  const pricing = useMemo(
    () =>
      resolveCommercialPricing({
        supplierTarget: targetRateInr,
        saleRateBasis: saleRateBasis ?? null,
        weightKg: weightKg ?? null,
        bidCount: 0,
      }),
    [targetRateInr, saleRateBasis, weightKg],
  );
  const unitRateInr = isPerMt ? pricing.unitRateInr : null;
  const indentTonnes = isPerMt ? pricing.tonnes : null;
  const compareTarget = isPerMt ? unitRateInr : targetRateInr;

  useEffect(() => {
    if (!visible) {
      celebrationLockRef.current = false;
      setConfirmOpen(false);
      setConfirmPhase("review");
      setConfirmSubmitting(false);
      setPendingAmount(0);
      setEstimateTonnes(null);
      setLiveRaw("");
      return;
    }
    setEstimateTonnes(resolveVehiclePayloadTonnes(vehicleType) ?? null);
  }, [visible, vehicleType]);

  const initialValue = useMemo(() => {
    if (initialAmount != null && Number(initialAmount) > 0) {
      const stored = Math.round(Number(initialAmount));
      const seed = isPerMt
        ? unitRateFromStoredBid(stored, indentTonnes)
        : stored;
      return seed > 0 ? toRawString(seed) : "";
    }
    return "";
  }, [visible, initialAmount, isPerMt, indentTonnes]);

  const partyPreview = useMemo((): NumericEntryPartyPreview | undefined => {
    const route = routeSubtitle(origin, destination);
    const specParts = [
      cleanSpec(vehicleType),
      cleanSpec(weightLabel) ??
        (isPerMt ? "Weight at loading" : undefined),
      cleanSpec(material),
    ].filter(Boolean) as string[];
    const displayName =
      (ownerName ?? "").trim() || `Indent ${indentDisplayNumber}`;
    return {
      name: displayName,
      heroLine: route,
      detailLine: specParts.length > 0 ? specParts.join(" · ") : undefined,
      subtitle: route,
      entityType: "client",
    };
  }, [
    indentDisplayNumber,
    origin,
    destination,
    vehicleType,
    weightLabel,
    material,
    ownerName,
    isPerMt,
  ]);

  const originCity = cleanSpec(origin);
  const destinationCity = cleanSpec(destination);
  const vehicle = cleanSpec(vehicleType);
  const weight =
    cleanSpec(weightLabel) ?? (isPerMt ? "Weight at loading" : undefined);
  const materialClean = cleanSpec(material);
  const owner =
    (ownerName ?? "").trim() ||
    `Indent ${indentDisplayNumber}`;

  const requestConfirm = useCallback(
    (raw: string) => {
      onClearValidationError?.();
      const amount = parseRawToNumber(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        onInvalidAmount?.();
        return;
      }
      celebrationLockRef.current = true;
      setPendingAmount(amount);
      setConfirmPhase("review");
      setConfirmOpen(true);
    },
    [onClearValidationError, onInvalidAmount],
  );

  const handleConfirm = useCallback(async () => {
    if (confirmSubmitting || pendingAmount <= 0) return;
    const stored = isPerMt
      ? storedBidFromUnitRate(pendingAmount, indentTonnes)
      : pendingAmount;
    if (!Number.isFinite(stored) || stored <= 0) return;
    setConfirmSubmitting(true);
    onClearValidationError?.();
    try {
      const ok = await onSubmitAmount(stored);
      if (!ok) {
        celebrationLockRef.current = false;
        setConfirmOpen(false);
        setConfirmPhase("review");
        return;
      }
      celebrationLockRef.current = true;
      setConfirmPhase("success");
    } finally {
      setConfirmSubmitting(false);
    }
  }, [
    confirmSubmitting,
    pendingAmount,
    onClearValidationError,
    onSubmitAmount,
    isPerMt,
    indentTonnes,
  ]);

  const finishAfterSuccess = useCallback(() => {
    celebrationLockRef.current = false;
    setConfirmOpen(false);
    setConfirmPhase("review");
    setPendingAmount(0);
    onSuccessDone?.();
    onClose();
  }, [onSuccessDone, onClose]);

  const handleCancelConfirm = useCallback(() => {
    if (confirmSubmitting || confirmPhase !== "review") return;
    celebrationLockRef.current = false;
    setConfirmOpen(false);
    setConfirmPhase("review");
  }, [confirmSubmitting, confirmPhase]);

  const handleCloseEntry = useCallback(() => {
    if (confirmSubmitting || celebrationLockRef.current) return;
    onClose();
  }, [confirmSubmitting, onClose]);

  const expectedTrip = useMemo(() => {
    if (!isPerMt) return null;
    const typed = parseRawToNumber(liveRaw);
    const rateForMath =
      typed > 0 ? typed : pendingAmount > 0 ? pendingAmount : unitRateInr;
    return resolveExpectedTripValue({
      unitRateInr: rateForMath,
      indentTonnes,
      vehicleType: vehicle,
      estimateTonnes,
    });
  }, [
    isPerMt,
    liveRaw,
    pendingAmount,
    unitRateInr,
    indentTonnes,
    vehicle,
    estimateTonnes,
  ]);

  const expectedTripLabel =
    expectedTrip != null
      ? `${expectedTrip.source === "indent_weight" ? "" : "≈ "}${formatINR(expectedTrip.amountInr)} at ${expectedTrip.tonnes}T`
      : undefined;

  const typedUnitRate = parseRawToNumber(liveRaw);

  return (
    <>
      <FullscreenNumericEntry
        visible={visible}
        onClose={handleCloseEntry}
        onSubmit={requestConfirm}
        initialValue={initialValue}
        label={title}
        contextLine={undefined}
        partyPreview={partyPreview}
        type="currency"
        prefix="₹"
        suffix={isPerMt ? "/MT" : undefined}
        placeholder="0"
        allowDecimal={false}
        maxDecimalPlaces={0}
        submitLabel={isUpdate ? "Update bid" : "Submit bid"}
        validationError={
          confirmSubmitting
            ? isUpdate
              ? "Updating…"
              : "Submitting…"
            : validationError
        }
        targetRate={
          compareTarget != null && compareTarget > 0 ? compareTarget : null
        }
        targetSuffix={isPerMt ? "/MT" : undefined}
        onValueChange={setLiveRaw}
        aboveAmount={
          isPerMt ? (
            <PerMtBidGuidance
              parts="banner"
              targetUnitRateInr={unitRateInr}
              typedUnitRateInr={typedUnitRate}
              expected={expectedTrip}
              showEstimateChips={false}
              estimateTonnes={estimateTonnes}
              vehicleType={vehicle}
              onEstimateTonnesChange={setEstimateTonnes}
            />
          ) : null
        }
        belowAmount={
          isPerMt ? (
            <PerMtBidGuidance
              parts="estimate"
              targetUnitRateInr={unitRateInr}
              typedUnitRateInr={typedUnitRate}
              expected={expectedTrip}
              showEstimateChips={false}
              estimateTonnes={estimateTonnes}
              vehicleType={vehicle}
              onEstimateTonnesChange={setEstimateTonnes}
            />
          ) : null
        }
      />

      <BidConfirmModal
        visible={confirmOpen}
        phase={confirmPhase}
        isEditMode={isUpdate}
        amount={pendingAmount}
        ownerName={owner}
        origin={originCity}
        destination={destinationCity}
        vehicle={vehicle}
        weight={weight}
        material={materialClean}
        targetRate={
          compareTarget != null && compareTarget > 0 ? compareTarget : null
        }
        targetSuffix={isPerMt ? "/MT" : undefined}
        amountSuffix={isPerMt ? "/MT" : undefined}
        rateBasisLabel={isPerMt ? "Per MT" : undefined}
        expectedTripLabel={expectedTripLabel}
        submitting={confirmSubmitting}
        onCancel={handleCancelConfirm}
        onConfirm={() => {
          void handleConfirm();
        }}
        onSuccessDone={finishAfterSuccess}
      />
    </>
  );
}
