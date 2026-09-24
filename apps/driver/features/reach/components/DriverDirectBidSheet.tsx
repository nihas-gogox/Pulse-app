/**
 * Driver / FO direct bid — Business IndentBidAmountEntry pattern:
 * full-page DecimalKeypad (FullscreenNumericEntry), no native keyboard.
 * Submits via submit_driver_direct_bid (note omitted — amount-only like Get Load).
 */
import { FullscreenNumericEntry } from '@pulse/features/components/mobile-input/FullscreenNumericEntry';
import type { NumericEntryPartyPreview } from '@pulse/domain/components/mobile-input/NumericEntryPartyBanner.types';
import { parseRawToNumber, toRawString } from '@pulse/ui/components/mobile-input/keypad';
import type { DriverReachStoryRow } from '@pulse/domain/features/reach/services/driverReferrals.service';
import { formatINR, positiveMoneyOrNull } from '@pulse/core/lib/format';
import { useCallback, useMemo, useState } from 'react';

function cityPart(label: string | null | undefined): string {
  const raw = (label ?? '').trim();
  if (!raw) return '';
  return raw.split(',')[0]?.trim() || raw;
}

export type DriverDirectBidSheetProps = {
  visible: boolean;
  story: DriverReachStoryRow | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (amount: number, note: string) => void | Promise<void>;
};

export function DriverDirectBidSheet({
  visible,
  story,
  submitting = false,
  onClose,
  onSubmit,
}: DriverDirectBidSheetProps) {
  const [validationError, setValidationError] = useState<string | undefined>();

  const target = positiveMoneyOrNull(story?.snapshot_rate_offer);
  const counter = positiveMoneyOrNull(story?.direct_bid_counter_amount);
  const isUpdate = story?.direct_bid_status === 'pending';

  const initialValue = useMemo(() => {
    if (!visible || !story) return '';
    const preexisting = story.direct_bid_amount;
    if (preexisting != null && Number.isFinite(Number(preexisting)) && Number(preexisting) > 0) {
      return toRawString(preexisting);
    }
    if (counter != null) return toRawString(Math.round(counter));
    if (target != null) return toRawString(Math.round(target));
    return '';
  }, [visible, story?.post_id, story?.direct_bid_amount, counter, target]);

  const origin = cityPart(story?.snapshot_origin);
  const destination = cityPart(story?.snapshot_destination);
  const route =
    origin && destination ? `${origin} → ${destination}` : origin || destination || undefined;
  const vehicle = story?.snapshot_vehicle_type?.trim() || undefined;

  const partySubtitle = useMemo(() => {
    const parts: string[] = [];
    if (route) parts.push(route);
    if (vehicle) parts.push(vehicle);
    if (counter != null) parts.push(`Counter ${formatINR(counter)}`);
    else if (target != null) parts.push(`Target ${formatINR(target)}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }, [route, vehicle, counter, target]);

  const partyPreview = useMemo((): NumericEntryPartyPreview | undefined => {
    if (!story) return undefined;
    const name = (story.org_name ?? '').trim() || 'Shipper';
    const detailParts: string[] = [];
    if (vehicle) detailParts.push(vehicle);
    if (counter != null) detailParts.push(`Counter ${formatINR(counter)}`);
    else if (target != null) detailParts.push(`Target ${formatINR(target)}`);
    return {
      name,
      subtitle: partySubtitle,
      heroLine: route || undefined,
      detailLine: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
      entityType: 'supplier',
      organizationImageUrl: story.org_logo_url ?? null,
    };
  }, [story, partySubtitle, route, vehicle, counter, target]);

  const matchCounterQuickFill = useMemo(() => {
    if (counter == null) return null;
    return { label: 'Match counter', amount: counter };
  }, [counter]);

  const handleSubmit = useCallback(
    (raw: string) => {
      if (submitting) return;
      setValidationError(undefined);
      const amount = parseRawToNumber(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        setValidationError('Enter a valid bid amount.');
        return;
      }
      void onSubmit(amount, '');
    },
    [onSubmit, submitting],
  );

  const handleClose = useCallback(() => {
    setValidationError(undefined);
    onClose();
  }, [onClose]);

  if (!story) return null;

  return (
    <FullscreenNumericEntry
      visible={visible}
      onClose={handleClose}
      onSubmit={handleSubmit}
      initialValue={initialValue}
      label={isUpdate ? 'Update your bid' : 'Your bid'}
      contextLine={partyPreview ? undefined : partySubtitle}
      partyPreview={partyPreview}
      type="currency"
      prefix="₹"
      placeholder="0"
      allowDecimal={false}
      maxDecimalPlaces={0}
      submitLabel={
        submitting ? (isUpdate ? 'Updating…' : 'Submitting…') : isUpdate ? 'Update bid' : 'Submit bid'
      }
      validationError={validationError}
      targetRate={target}
      quickFill={matchCounterQuickFill}
    />
  );
}
