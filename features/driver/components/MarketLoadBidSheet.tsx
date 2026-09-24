/**
 * Full-page Market bid amount entry — same FullscreenNumericEntry +
 * BidConfirmModal flow as business IndentBidAmountEntry / Get Load.
 */
import { FullscreenNumericEntry } from '@/components/mobile-input/FullscreenNumericEntry';
import type { NumericEntryPartyPreview } from '@/components/mobile-input/NumericEntryPartyBanner';
import { parseRawToNumber, toRawString } from '@/components/mobile-input/keypad';
import {
  BidConfirmModal,
  type BidConfirmPhase,
  type MarketplaceFeePreview,
} from '@/features/network/components/bidding/BidConfirmModal';
import { splitLocationParts } from '@/features/network/utils/storyDisplay';
import { calculateMarketplacePlatformFee } from '@/features/network/services/marketBids.service';
import { formatINR } from '@/lib/format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MarketLoadBidSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Persist the bid. Return true on success — sheet shows celebration. */
  onSubmitAmount: (amountInr: number) => Promise<boolean>;
  onSuccessDone?: () => void;
  shipperName?: string | null;
  pickup?: string | null;
  drop?: string | null;
  vehicleType?: string | null;
  loadType?: string | null;
  targetRateInr?: number | null;
  indentDisplayId?: string | null;
  validationError?: string;
  onClearValidationError?: () => void;
};

function cityOf(value?: string | null): string | undefined {
  const city = splitLocationParts(value).city;
  if (!city || city === '—') return undefined;
  return city;
}

function cleanSpec(value?: string | null): string | undefined {
  const v = (value ?? '').trim();
  if (!v || v === '—') return undefined;
  return v;
}

export function MarketLoadBidSheet({
  visible,
  onClose,
  onSubmitAmount,
  onSuccessDone,
  shipperName,
  pickup,
  drop,
  vehicleType,
  loadType,
  targetRateInr,
  indentDisplayId,
  validationError,
  onClearValidationError,
}: MarketLoadBidSheetProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhase, setConfirmPhase] = useState<BidConfirmPhase>('review');
  const [pendingAmount, setPendingAmount] = useState(0);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [feePreview, setFeePreview] = useState<MarketplaceFeePreview | undefined>(undefined);
  const feeRequestRef = useRef(0);
  const celebrationLockRef = useRef(false);

  useEffect(() => {
    if (visible) return;
    celebrationLockRef.current = false;
    setConfirmOpen(false);
    setConfirmPhase('review');
    setConfirmSubmitting(false);
    setPendingAmount(0);
    setFeePreview(undefined);
  }, [visible]);

  const originCity = cityOf(pickup);
  const destinationCity = cityOf(drop);
  const vehicle = cleanSpec(vehicleType);
  const material = cleanSpec(loadType);
  const owner =
    (shipperName ?? '').trim() ||
    ((indentDisplayId ?? '').trim() ? `Load ${indentDisplayId}` : 'Shipper');

  const route =
    originCity && destinationCity
      ? `${originCity} → ${destinationCity}`
      : originCity || destinationCity || undefined;

  const target =
    targetRateInr != null && Number.isFinite(targetRateInr) && targetRateInr > 0
      ? targetRateInr
      : null;

  const initialValue = useMemo(() => {
    if (!visible) return '';
    if (target != null) return toRawString(Math.round(target));
    return '';
  }, [visible, target]);

  const partyPreview = useMemo((): NumericEntryPartyPreview | undefined => {
    const detailParts = [
      vehicle,
      material,
      target != null ? `Target ${formatINR(target)}` : undefined,
    ].filter(Boolean) as string[];
    return {
      name: owner,
      subtitle: [route, vehicle].filter(Boolean).join(' · ') || undefined,
      heroLine: route,
      detailLine: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
      entityType: 'client',
    };
  }, [owner, route, vehicle, material, target]);

  const requestConfirm = useCallback(
    (raw: string) => {
      onClearValidationError?.();
      const amount = parseRawToNumber(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }
      setPendingAmount(amount);
      setConfirmPhase('review');
      setConfirmOpen(true);

      // A11.1 — computed once per confirm, not per keystroke, mirroring the
      // one-shot precedent already used elsewhere in this screen tree. A
      // request token guards against a stale response landing after the
      // sheet was cancelled/reopened with a different amount.
      const requestId = ++feeRequestRef.current;
      setFeePreview({ status: 'loading' });
      void calculateMarketplacePlatformFee(amount).then(({ error, calc }) => {
        if (feeRequestRef.current !== requestId) return;
        if (error || !calc) {
          setFeePreview({ status: 'error' });
          return;
        }
        if (!calc.is_active_config_found) {
          setFeePreview({ status: 'inactive' });
          return;
        }
        setFeePreview({
          status: 'active',
          amount: calc.resolved_fee,
          capped: Boolean(calc.capped),
        });
      });
    },
    [onClearValidationError],
  );

  const handleConfirm = useCallback(async () => {
    if (confirmSubmitting || pendingAmount <= 0) return;
    setConfirmSubmitting(true);
    onClearValidationError?.();
    try {
      const ok = await onSubmitAmount(pendingAmount);
      if (!ok) {
        celebrationLockRef.current = false;
        setConfirmOpen(false);
        setConfirmPhase('review');
        return;
      }
      celebrationLockRef.current = true;
      setConfirmPhase('success');
    } finally {
      setConfirmSubmitting(false);
    }
  }, [confirmSubmitting, pendingAmount, onClearValidationError, onSubmitAmount]);

  const finishAfterSuccess = useCallback(() => {
    celebrationLockRef.current = false;
    setConfirmOpen(false);
    setConfirmPhase('review');
    setPendingAmount(0);
    onSuccessDone?.();
    onClose();
  }, [onSuccessDone, onClose]);

  const handleCancelConfirm = useCallback(() => {
    if (confirmSubmitting || confirmPhase !== 'review') return;
    celebrationLockRef.current = false;
    setConfirmOpen(false);
    setConfirmPhase('review');
  }, [confirmSubmitting, confirmPhase]);

  const handleCloseEntry = useCallback(() => {
    if (confirmSubmitting) return;
    celebrationLockRef.current = false;
    setConfirmOpen(false);
    setConfirmPhase('review');
    onClose();
  }, [confirmSubmitting, onClose]);

  return (
    <FullscreenNumericEntry
      visible={visible}
      onClose={handleCloseEntry}
      onSubmit={requestConfirm}
      initialValue={initialValue}
      label="Place your bid"
      contextLine={undefined}
      partyPreview={partyPreview}
      type="currency"
      prefix="₹"
      placeholder="0"
      allowDecimal={false}
      maxDecimalPlaces={0}
      submitLabel="Submit bid"
      validationError={
        confirmSubmitting ? 'Submitting…' : validationError
      }
      targetRate={target}
      overlay={
        confirmOpen ? (
          <BidConfirmModal
            embedded
            visible={confirmOpen}
            phase={confirmPhase}
            isEditMode={false}
            amount={pendingAmount}
            ownerName={owner}
            origin={originCity}
            destination={destinationCity}
            vehicle={vehicle}
            material={material}
            targetRate={target}
            submitting={confirmSubmitting}
            marketplaceFee={feePreview}
            onCancel={handleCancelConfirm}
            onConfirm={() => {
              void handleConfirm();
            }}
            onSuccessDone={finishAfterSuccess}
          />
        ) : null
      }
    />
  );
}
