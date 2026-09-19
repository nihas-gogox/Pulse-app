/**
 * BidModal — full-screen bid amount entry (ledger / GPay-style keypad).
 * Uses IndentBidAmountEntry + BidConfirmModal celebration (same as story bids).
 */
import { IndentBidAmountEntry } from "@/features/indents/components/bidding/IndentBidAmountEntry";
import {
  createDirectQuote,
  getIndentDisplayNumber,
  type DirectQuoteRow,
  type IndentRow,
} from "@/features/indents";
import { useInvalidateIndents } from "@/lib/queries";
import { queryKeys } from "@/lib/queryKeys";
import { type QueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

interface BidModalProps {
  visible: boolean;
  load: IndentRow | null;
  orgId: string | null;
  myQuoteByIndentId: Map<string, DirectQuoteRow>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  localBidHistoryByIndentId: Record<
    string,
    { amount: number; updatedAt: string }[]
  >;
  onUpdateLocalBidHistory: (
    indentId: string,
    entry: { amount: number; updatedAt: string },
  ) => void;
  queryClient: QueryClient;
  invalidateIndents: ReturnType<typeof useInvalidateIndents>;
  refetchMyQuotes: () => void;
  refetchMarketIndents: () => void;
  insets: { top: number; bottom: number };
}

export function BidModal({
  visible,
  load,
  orgId,
  myQuoteByIndentId,
  onClose,
  onSuccess,
  onUpdateLocalBidHistory,
  queryClient,
  invalidateIndents,
  refetchMyQuotes,
  refetchMarketIndents,
}: BidModalProps) {
  const [entryError, setEntryError] = useState<string | undefined>();
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const successMsgRef = useRef("Offer Published");

  const activeBidQuote = useMemo(() => {
    if (!load) return null;
    return myQuoteByIndentId.get(load.id) ?? null;
  }, [load, myQuoteByIndentId]);

  const hasExistingQuote = activeBidQuote != null;
  const isPendingQuote =
    (activeBidQuote?.status ?? "").toLowerCase() === "pending";

  const handleClose = useCallback(() => {
    setEntryError(undefined);
    onClose();
  }, [onClose]);

  const submitQuoteAmount = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!orgId || !load || submittingQuote) return false;
      const hadExistingQuote = !!myQuoteByIndentId.get(load.id);
      const existingQuoteBeforeSave = myQuoteByIndentId.get(load.id);
      try {
        setSubmittingQuote(true);
        const { error } = await createDirectQuote(
          load.id,
          orgId,
          amount,
          null,
          null,
          null,
        );
        if (error) {
          setEntryError(error.message);
          refetchMarketIndents();
          return false;
        }
        successMsgRef.current = hadExistingQuote
          ? "Quote updated"
          : "Offer Published";
        invalidateIndents(orgId);
        await Promise.allSettled([
          queryClient.invalidateQueries({
            queryKey: [...queryKeys.indents.finite(orgId), "my-direct-quotes"],
          }),
          queryClient.invalidateQueries({
            queryKey: ["indents", load.id, "direct-quotes"],
          }),
          queryClient.invalidateQueries({
            queryKey: ["indents", "quote-counts"],
          }),
          refetchMyQuotes(),
          refetchMarketIndents(),
        ]);
        if (existingQuoteBeforeSave) {
          onUpdateLocalBidHistory(load.id, {
            amount: Number(existingQuoteBeforeSave.amount ?? 0),
            updatedAt:
              existingQuoteBeforeSave.updated_at ?? new Date().toISOString(),
          });
        }
        // Keep entry open — IndentBidAmountEntry shows BidConfirmModal success.
        return true;
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Unknown error while publishing offer.";
        setEntryError(msg);
        refetchMarketIndents();
        Alert.alert("Could not publish offer", msg);
        return false;
      } finally {
        setSubmittingQuote(false);
      }
    },
    [
      orgId,
      load,
      myQuoteByIndentId,
      invalidateIndents,
      queryClient,
      refetchMyQuotes,
      refetchMarketIndents,
      onUpdateLocalBidHistory,
      submittingQuote,
    ],
  );

  if (!load) return null;

  const targetRate = Number(load.supplier_target ?? 0);
  const vehicleType = (load.vehicle_type ?? "").trim() || undefined;
  const weightLabel =
    load.weight != null && Number(load.weight) > 0
      ? `${Number(load.weight)} KG`
      : undefined;
  const material = (load.load_type ?? "").trim() || undefined;
  const ownerName =
    (load.client_name ?? "").trim() ||
    (load.creator_organization_name ?? "").trim() ||
    undefined;

  return (
    <IndentBidAmountEntry
      visible={visible}
      onClose={handleClose}
      onSubmitAmount={submitQuoteAmount}
      onSuccessDone={() => onSuccess(successMsgRef.current)}
      indentDisplayNumber={getIndentDisplayNumber(load)}
      origin={load.pickup_area}
      destination={load.drop_location}
      vehicleType={vehicleType}
      weightLabel={weightLabel}
      material={material}
      ownerName={ownerName}
      targetRateInr={targetRate > 0 ? targetRate : undefined}
      saleRateBasis={load.supplier_rate_basis}
      weightKg={load.weight}
      initialAmount={
        activeBidQuote?.amount != null ? Number(activeBidQuote.amount) : null
      }
      isUpdate={hasExistingQuote && isPendingQuote}
      validationError={entryError}
      onClearValidationError={() => setEntryError(undefined)}
      onInvalidAmount={() =>
        setEntryError("Enter an amount greater than 0.")
      }
    />
  );
}
