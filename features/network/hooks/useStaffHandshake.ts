/**
 * useStaffHandshake — manages all state and handlers for the
 * Staff Handshake / Deploy modal (Asset roster + Aggregate ad-hoc flows).
 * FSM-style: open(load) → fill form → deployRoster/deployAdHoc → close.
 */

import { upsertTripSubcontract } from "@/features/finance/services/tripSubcontracts.service";
import { acceptAwardedQuote } from "@/features/indents/services/accept-awarded-quote.service";
import {
  createMoverAssetTrip,
  createTripFromAssignedIndent,
} from "@/features/indents/services/indentConversionService";
import { getAcceptedDirectQuoteForIndent } from "@/features/indents/services/direct-quotes.service";
import { updateIndent, type DirectQuoteRow, type IndentRow } from "@/features/indents";
import {
  resolveIndentDeployQuote,
  resolveIndentDeployQuoteWithFreshQuote,
} from "@/features/indents/utils/resolveIndentDeployQuote.util";
import {
  isDeployTripDetailsReady,
  parseTonsInputToWeightKg,
  seedDeployLoadTypeFromIndent,
  seedDeployPickupDateFromIndent,
  seedDeployVehicleTypeFromIndent,
  seedDeployWeightTonsFromIndent,
} from "@/features/indents/utils/indentDeployTripDetails.util";
import { isValidIsoDateString } from "@/lib/dateIso.util";
import { showAppAlert } from "@/lib/appAlert";
import {
  assignAggregateTripDriverByPhone,
  getDriverAvailabilityByPhoneGlobal,
  humanizeTripIdInRpcError,
  stampTripDriverPayFromTerms,
  updateTripSupplier,
} from "@/features/trips/services/trips.service";
import { generateTripOtp } from "@/features/trips/services/tripOtp.service";
import { getSupplierById } from "@/features/suppliers/services/suppliers.service";
import type { ExistingDriverMatch } from "@/features/drivers/services/drivers.service";
import { lookupDriversByPhoneVariants } from "@/features/trips/utils/driverPhoneLookup.util";
import { updateDirectQuoteAssignment } from "@/features/indents";
import type { TripRow } from "@/features/trips/services/trips.service";
import { useInvalidateIndents, useInvalidateTrips } from "@/lib/queries";
import { queryKeys } from "@/lib/queryKeys";
import { validatePhone } from "@/lib/phoneValidation";
import { formatIndianVehicleNumber } from "@/lib/format";
import { isIndianVehiclePlateComplete } from "@/lib/indianVehicleInput.util";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";

interface UseStaffHandshakeParams {
  orgId: string | null;
  myQuotes: DirectQuoteRow[];
  onSuccess: (msg: string) => void;
}

async function persistIndentDeployTripDetails(
  indentId: string,
  pickupDate: string,
  weightTons: string,
  vehicleType: string,
  loadType: string,
): Promise<{ error: Error | null }> {
  if (!isValidIsoDateString(pickupDate)) {
    return { error: new Error("Pick a valid trip start date.") };
  }
  const payload: {
    pickup_date: string;
    weight?: number;
    vehicle_type?: string;
    load_type?: string;
  } = {
    pickup_date: pickupDate.trim(),
  };
  const weightKg = parseTonsInputToWeightKg(weightTons);
  if (weightKg != null) payload.weight = weightKg;
  if (vehicleType.trim()) payload.vehicle_type = vehicleType.trim();
  if (loadType.trim()) payload.load_type = loadType.trim();
  const { error } = await updateIndent(indentId, payload);
  return { error };
}

type DeployTripAssignment = {
  driverId?: string | null;
  vehicleId?: string | null;
  vehicleDisplayNumber?: string | null;
};

function formatDeployTripError(message: string | null | undefined): string {
  const raw = (message ?? "").trim() || "Unknown error.";
  if (/fee_payment_pending/i.test(raw)) {
    return "Pay the Marketplace platform fee on this screen (cash until online checkout is live), then convert again.";
  }
  if (/approved supplier/i.test(raw)) {
    return "This award should convert without a Network supplier link. Marketplace winners are not added to the shipper network; Network loads already only go to existing suppliers. Try convert again after refresh.";
  }
  return raw;
}

async function createDeployTripFromAward(
  load: IndentRow,
  orgId: string,
  myQuotes: DirectQuoteRow[],
  assignment: DeployTripAssignment,
): Promise<{ error: Error | null; trip: TripRow | null }> {
  const cachedResolution = resolveIndentDeployQuote(load, orgId, myQuotes);
  let resolution =
    cachedResolution?.mode === "direct_quote" ? cachedResolution : null;
  if (!resolution) {
    const { quote: freshQuote } = await getAcceptedDirectQuoteForIndent(
      orgId,
      load.id,
    );
    resolution = resolveIndentDeployQuoteWithFreshQuote(
      load,
      orgId,
      myQuotes,
      freshQuote,
    );
  }
  if (!resolution) {
    return {
      error: new Error("No accepted quote found for this load."),
      trip: null,
    };
  }

  // Marketplace fee settlement happens inside create_trip_from_assigned_indent's own
  // transaction (atomic with trip creation) — a separate client-side settle call here was
  // redundant with that, and a real correctness risk: settling the fee in its own round
  // trip, then failing to create the trip for an unrelated reason, would leave the org
  // charged with no trip. The direct_quote path (Network-only, never has a market award)
  // never needed this call at all.
  if (resolution.mode === "direct_quote") {
    const { error: assignErr } = await updateDirectQuoteAssignment(
      resolution.quote.id,
      assignment.driverId ?? null,
      assignment.vehicleId ?? null,
    );
    if (assignErr) return { error: assignErr, trip: null };
    return acceptAwardedQuote(resolution.quote.id, {
      vehicle_display_number: assignment.vehicleDisplayNumber ?? undefined,
    });
  }

  return createTripFromAssignedIndent(load.id, {
    driverId: assignment.driverId ?? null,
    vehicleId: assignment.vehicleId ?? null,
    vehicleDisplayNumber: assignment.vehicleDisplayNumber ?? null,
  });
}

export interface StaffHandshakeResult {
  state: {
    isOpen: boolean;
    currentLoad: IndentRow | null;
    closingToList: boolean;
    isDeploying: boolean;
    showOtp: boolean;
    // form fields (read-only for modal display):
    useAdHocDriver: boolean;
    assignDriverId: string | null;
    assignVehicleId: string | null | undefined;
    assignVehicleRegistration: string;
    aggregateDriverTrackingName: string;
    aggregateDriverPhone: string;
    aggregatePhoneName: string | null;
    aggregatePhoneNotFound: boolean;
    aggregatePhoneInTrip: boolean;
    aggregatePhoneMatches: ExistingDriverMatch[];
    aggregatePhoneLookupLoading: boolean;
    aggregatePhoneSelectedUserId: string | null;
    subcontractSupplierId: string | null;
    subcontractRate: string;
    aggregateAdvancePaid: string;
    deployOtpCode: string | null;
    deployOtpExpiresAt: string | null;
    deployTripIdForOtp: string | null;
    staffHandshakeAssignLater: boolean;
    deployPickupDate: string;
    deployWeightTons: string;
    deployVehicleType: string;
    deployLoadType: string;
    // computed readiness flags:
    tripDetailsReady: boolean;
    rosterReady: boolean;
    adHocReady: boolean;
    aggregateTrackingFlowReady: boolean;
    aggregatePartnerHandshakeComplete: boolean;
    aggregateHasDriverName: boolean;
    aggregateHasVehicleText: boolean;
  };
  set: {
    useAdHocDriver: (v: boolean) => void;
    assignDriverId: (id: string | null) => void;
    assignVehicleId: (id: string | null | undefined) => void;
    assignVehicleRegistration: (v: string) => void;
    aggregateDriverTrackingName: (v: string) => void;
    aggregateDriverPhone: (v: string) => void;
    aggregatePhoneName: (v: string | null) => void;
    aggregatePhoneNotFound: (v: boolean) => void;
    aggregatePhoneInTrip: (v: boolean) => void;
    applyAggregatePhoneMatch: (match: ExistingDriverMatch) => void;
    subcontractSupplierId: (id: string | null) => void;
    subcontractRate: (v: string) => void;
    aggregateAdvancePaid: (v: string) => void;
    deployOtpCode: (v: string | null) => void;
    deployOtpExpiresAt: (v: string | null) => void;
    deployTripIdForOtp: (v: string | null) => void;
    staffHandshakeAssignLater: (v: boolean) => void;
    deployPickupDate: (v: string) => void;
    deployWeightTons: (v: string) => void;
    deployVehicleType: (v: string) => void;
    deployLoadType: (v: string) => void;
    aggregateDriverNameManualRef: React.MutableRefObject<boolean>;
  };
  open: (load: IndentRow) => void;
  close: () => void;
  deployRoster: () => Promise<void>;
  deployAdHoc: () => Promise<void>;
  backFromOtp: () => void;
}

export function useStaffHandshake({
  orgId,
  myQuotes,
  onSuccess,
}: UseStaffHandshakeParams): StaffHandshakeResult {
  const invalidateTrips = useInvalidateTrips();
  const invalidateIndents = useInvalidateIndents();
  const queryClient = useQueryClient();

  const refreshAfterDeploy = useCallback(
    (deployOrgId: string) => {
      invalidateTrips(deployOrgId);
      invalidateIndents(deployOrgId, { bustPartnerSupplierMarket: true });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.indents.finite(deployOrgId), "my-direct-quotes"],
      });
      queryClient.invalidateQueries({
        queryKey: ["q", "trips", "subcontracts"],
      });
    },
    [invalidateTrips, invalidateIndents, queryClient],
  );

  // FSM-style open/close state
  const [currentLoad, setCurrentLoad] = useState<IndentRow | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [closingToList, setClosingToList] = useState(false);

  // Form fields
  const [useAdHocDriver, setUseAdHocDriver] = useState(false);
  const [assignDriverId, setAssignDriverId] = useState<string | null>(null);
  const [assignVehicleId, setAssignVehicleId] = useState<
    string | null | undefined
  >(undefined);
  const [assignVehicleRegistration, setAssignVehicleRegistration] =
    useState("");
  const [aggregateDriverTrackingName, setAggregateDriverTrackingName] =
    useState("");
  const aggregateDriverNameManualRef = useRef(false);
  const [aggregateDriverPhone, setAggregateDriverPhone] = useState("");
  const [aggregatePhoneName, setAggregatePhoneName] = useState<string | null>(
    null,
  );
  const [aggregatePhoneNotFound, setAggregatePhoneNotFound] = useState(false);
  const [aggregatePhoneInTrip, setAggregatePhoneInTrip] = useState(false);
  const [aggregatePhoneMatches, setAggregatePhoneMatches] = useState<
    ExistingDriverMatch[]
  >([]);
  const [aggregatePhoneLookupLoading, setAggregatePhoneLookupLoading] =
    useState(false);
  const [aggregatePhoneSelectedUserId, setAggregatePhoneSelectedUserId] =
    useState<string | null>(null);
  const aggregatePhoneLookupTimeoutRef = useRef<number | null>(null);
  const aggregatePhoneLookupGenRef = useRef(0);
  /** Prevents double-submit on Staff Handshake (parallel creates → unique trip_number 409). */
  const staffHandshakeDeployLockRef = useRef(false);
  const [subcontractSupplierId, setSubcontractSupplierId] = useState<
    string | null
  >(null);
  const [subcontractRate, setSubcontractRate] = useState<string>("");
  const [aggregateAdvancePaid, setAggregateAdvancePaid] = useState<string>("");
  const [deployOtpCode, setDeployOtpCode] = useState<string | null>(null);
  const [deployOtpExpiresAt, setDeployOtpExpiresAt] = useState<string | null>(
    null,
  );
  const [deployTripIdForOtp, setDeployTripIdForOtp] = useState<string | null>(
    null,
  );
  const [staffHandshakeAssignLater, setStaffHandshakeAssignLater] =
    useState(false);
  const [deployPickupDate, setDeployPickupDate] = useState("");
  const [deployWeightTons, setDeployWeightTons] = useState("");
  const [deployVehicleType, setDeployVehicleType] = useState("");
  const [deployLoadType, setDeployLoadType] = useState("");

  const tripDetailsReady = isDeployTripDetailsReady(
    deployPickupDate,
    deployWeightTons,
    deployVehicleType,
    deployLoadType,
  );

  const applyAggregatePhoneMatch = useCallback((match: ExistingDriverMatch) => {
    const name = match.full_name?.trim() || "";
    setAggregatePhoneSelectedUserId(match.user_id);
    setAggregatePhoneName(name || null);
    aggregateDriverNameManualRef.current = false;
    if (name) setAggregateDriverTrackingName(name);
  }, []);

  // Phone lookup — suggest driver name(s) from platform when number is complete
  useEffect(() => {
    const trimmed = aggregateDriverPhone.trim();
    if (aggregatePhoneLookupTimeoutRef.current)
      clearTimeout(aggregatePhoneLookupTimeoutRef.current);
    aggregatePhoneLookupTimeoutRef.current = setTimeout(() => {
      aggregatePhoneLookupTimeoutRef.current = null;
      const last10 = trimmed.replace(/\D/g, "").slice(-10);
      if (last10.length < 10) {
        setAggregatePhoneMatches([]);
        setAggregatePhoneLookupLoading(false);
        setAggregatePhoneSelectedUserId(null);
        setAggregatePhoneName(null);
        setAggregatePhoneNotFound(false);
        setAggregatePhoneInTrip(false);
        return;
      }

      const gen = ++aggregatePhoneLookupGenRef.current;
      setAggregatePhoneLookupLoading(true);
      setAggregatePhoneSelectedUserId(null);
      setAggregatePhoneName(null);
      setAggregatePhoneNotFound(false);
      setAggregatePhoneInTrip(false);

      lookupDriversByPhoneVariants(trimmed).then(({ matches, error }) => {
        if (aggregatePhoneLookupGenRef.current !== gen) return;
        setAggregatePhoneLookupLoading(false);
        setAggregatePhoneMatches(matches);
        setAggregatePhoneInTrip(false);

        const foundName = matches[0]?.full_name?.trim() || null;
        setAggregatePhoneName(foundName);
        setAggregatePhoneNotFound(!error && matches.length === 0);

        if (matches.length === 1 && !aggregateDriverNameManualRef.current) {
          applyAggregatePhoneMatch(matches[0]);
        }
      });
    }, 400) as unknown as number;
    return () => {
      if (aggregatePhoneLookupTimeoutRef.current)
        clearTimeout(aggregatePhoneLookupTimeoutRef.current);
    };
  }, [aggregateDriverPhone, applyAggregatePhoneMatch]);

  // Computed readiness flags
  const rosterReady =
    !useAdHocDriver && !!assignDriverId && typeof assignVehicleId === "string";
  const adHocReady = useAdHocDriver;

  const aggregateHasDriverName = aggregateDriverTrackingName.trim().length > 0;
  const aggregateHasDriverPhone = aggregateDriverPhone.trim().length > 0;
  const aggregateHasVehicleText = isIndianVehiclePlateComplete(
    assignVehicleRegistration,
  );
  const aggregateTrackingFlowReady =
    aggregateHasDriverName && aggregateHasDriverPhone && aggregateHasVehicleText;

  const aggregatePartnerHandshakeComplete = useMemo(() => {
    const sid = (subcontractSupplierId ?? "").trim();
    const rateRaw = subcontractRate.trim();
    const rateNum = Number(rateRaw);
    return (
      sid.length > 0 &&
      rateRaw.length > 0 &&
      Number.isFinite(rateNum) &&
      rateNum >= 0
    );
  }, [subcontractSupplierId, subcontractRate]);

  /** Reset all form state to defaults */
  const resetForm = useCallback(() => {
    setUseAdHocDriver(false);
    setAssignDriverId(null);
    setAssignVehicleId(undefined);
    setAssignVehicleRegistration("");
    setAggregateDriverTrackingName("");
    setAggregateDriverPhone("");
    setAggregatePhoneName(null);
    setAggregatePhoneNotFound(false);
    setAggregatePhoneInTrip(false);
    setAggregatePhoneMatches([]);
    setAggregatePhoneLookupLoading(false);
    setAggregatePhoneSelectedUserId(null);
    setSubcontractSupplierId(null);
    setSubcontractRate("");
    setAggregateAdvancePaid("");
    setDeployOtpCode(null);
    setDeployOtpExpiresAt(null);
    setDeployTripIdForOtp(null);
    setStaffHandshakeAssignLater(false);
    setDeployPickupDate("");
    setDeployWeightTons("");
    setDeployVehicleType("");
    setDeployLoadType("");
    aggregateDriverNameManualRef.current = false;
  }, []);

  const open = useCallback(
    (load: IndentRow) => {
      resetForm();
      setDeployPickupDate(seedDeployPickupDateFromIndent(load));
      setDeployWeightTons(seedDeployWeightTonsFromIndent(load));
      setDeployVehicleType(seedDeployVehicleTypeFromIndent(load));
      setDeployLoadType(seedDeployLoadTypeFromIndent(load));
      setCurrentLoad(load);
    },
    [resetForm],
  );

  const close = useCallback(() => {
    setCurrentLoad(null);
    resetForm();
  }, [resetForm]);

  /** Stay on the allocation wizard and show the trip-created confirmation. */
  const finishDeploySuccess = useCallback(
    (opts: {
      tripId: string;
      otpCode?: string | null;
      otpExpiresAt?: string | null;
      toast?: string;
    }) => {
      if (orgId) refreshAfterDeploy(orgId);
      if (opts.otpCode) {
        setDeployOtpCode(opts.otpCode);
        setDeployOtpExpiresAt(opts.otpExpiresAt ?? null);
      }
      setDeployTripIdForOtp(opts.tripId);
      onSuccess(opts.toast ?? "Trip created");
    },
    [orgId, refreshAfterDeploy, onSuccess],
  );

  const backFromOtp = useCallback(() => {
    if (deployOtpCode) {
      setDeployOtpCode(null);
      setDeployOtpExpiresAt(null);
      setDeployTripIdForOtp(null);
      return;
    }
    close();
  }, [deployOtpCode, close]);

  const deployRoster = useCallback(async () => {
    const load = currentLoad;
    if (!load) {
      showAppAlert(
        "Cannot convert",
        "This load is no longer open. Close the wizard and open allocation again.",
      );
      return;
    }
    if (isDeploying) {
      showAppAlert("Convert in progress", "Wait for the current convert to finish.");
      return;
    }
    if (!orgId) {
      showAppAlert(
        "Cannot deploy",
        "Your organization context is missing. Please try again.",
      );
      return;
    }
    const status = (load.status || "").toLowerCase();
    if (status === "cancelled" || status === "closed") {
      showAppAlert(
        "Load unavailable",
        "This load has been cancelled or closed.",
      );
      setCurrentLoad(null);
      return;
    }
    if (!assignDriverId || typeof assignVehicleId !== "string") {
      showAppAlert(
        "Select driver and vehicle",
        "Please select a driver and a vehicle from your org to assign trip.",
      );
      return;
    }
    if (!tripDetailsReady) {
      showAppAlert(
        "Trip details required",
        "Set vehicle arrival date before deploying. Vehicle type, product, and weight come from the indent.",
      );
      return;
    }
    if (staffHandshakeDeployLockRef.current) {
      showAppAlert("Convert in progress", "Wait for the current convert to finish.");
      return;
    }
    staffHandshakeDeployLockRef.current = true;
    try {
      setIsDeploying(true);
      const { error: detailsErr } = await persistIndentDeployTripDetails(
        load.id,
        deployPickupDate,
        deployWeightTons,
        deployVehicleType,
        deployLoadType,
      );
      if (detailsErr) {
        showAppAlert("Could not save trip details", detailsErr.message);
        return;
      }
      const { error: tripErr, trip } = await createDeployTripFromAward(
        load,
        orgId,
        myQuotes,
        {
          driverId: assignDriverId,
          vehicleId: assignVehicleId,
        },
      );
      if (tripErr || !trip) {
        showAppAlert(
          "Could not create trip",
          formatDeployTripError(tripErr?.message),
        );
        return;
      }
      /**
       * Freeze the driver's pay now, from their agreed terms. Otherwise the
       * figure is recomputed live on every read and editing the driver's
       * percentage later silently re-prices this already-assigned trip.
       * Non-fatal: the trip exists and is assigned, so a failure here is
       * surfaced and the assigner can set pay from the trip screen.
       */
      /**
       * Quote conversion already creates the mover's asset trip. Assigned-indent
       * conversion does not. The driver's pay belongs on the mover's trip.
       * The shipper trip is the market payable (supplier_rate), not driver pay.
       */
      let payTripId = trip.id;
      if (trip.organization_id && trip.organization_id !== orgId) {
        const mover = await createMoverAssetTrip(load.id, {
          driverId: assignDriverId,
          vehicleId: assignVehicleId,
        });
        if (!mover.error && mover.trip) payTripId = mover.trip.id;
      }
      // Independent writes (driver pay on the trip vs. the indent's own completion status)
      // — no data dependency between them, so run them together instead of serially.
      // Matches the pattern deployAdHoc already uses for its own subcontract+indent pair.
      const [{ error: payErr }] = await Promise.all([
        stampTripDriverPayFromTerms(payTripId, assignDriverId, orgId),
        updateIndent(load.id, { status: "completed" }),
      ]);
      if (payErr) {
        showAppAlert(
          "Trip created — driver pay not saved",
          "Set the driver's pay from the trip screen so it is not estimated.",
        );
      }
      finishDeploySuccess({
        tripId: trip.id,
        toast: "Voyage authorized — trip created.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error.";
      showAppAlert("Could not deploy", msg);
    } finally {
      staffHandshakeDeployLockRef.current = false;
      setIsDeploying(false);
    }
  }, [
    currentLoad,
    isDeploying,
    orgId,
    myQuotes,
    assignDriverId,
    assignVehicleId,
    deployPickupDate,
    deployWeightTons,
    deployVehicleType,
    deployLoadType,
    tripDetailsReady,
    finishDeploySuccess,
  ]);

  const deployAdHoc = useCallback(async () => {
    const load = currentLoad;
    if (!load) {
      showAppAlert(
        "Cannot convert",
        "This load is no longer open. Close the wizard and open allocation again.",
      );
      return;
    }
    if (isDeploying) {
      showAppAlert("Convert in progress", "Wait for the current convert to finish.");
      return;
    }
    if (!orgId) {
      showAppAlert(
        "Cannot deploy",
        "Your organization context is missing. Please try again.",
      );
      return;
    }
    const status = (load.status || "").toLowerCase();
    if (status === "cancelled" || status === "closed") {
      showAppAlert(
        "Load unavailable",
        "This load has been cancelled or closed.",
      );
      setCurrentLoad(null);
      return;
    }
    const handshakeSubSupplierId = (subcontractSupplierId ?? "").trim();
    const handshakeSubRateRaw = subcontractRate.trim();
    const handshakeSubRateNum = Number(handshakeSubRateRaw);
    if (!handshakeSubSupplierId) {
      showAppAlert(
        "Partner required",
        "Select the associated partner (sub-supplier) for this trip.",
      );
      return;
    }
    if (
      handshakeSubRateRaw === "" ||
      !Number.isFinite(handshakeSubRateNum) ||
      handshakeSubRateNum < 0
    ) {
      showAppAlert(
        "Partner rate required",
        "Enter the rate you will pay this partner (₹).",
      );
      return;
    }
    const deferHandshakeAssignment = staffHandshakeAssignLater;
    const nameTrimmed = deferHandshakeAssignment
      ? ""
      : aggregateDriverTrackingName.trim();
    const phoneTrimmed = deferHandshakeAssignment
      ? ""
      : aggregateDriverPhone.trim();
    const regTrimmed = deferHandshakeAssignment
      ? ""
      : formatIndianVehicleNumber(assignVehicleRegistration).trim();
    if (!deferHandshakeAssignment && nameTrimmed.length === 0) {
      showAppAlert(
        "Driver name required",
        "Enter driver name (tracking) to continue.",
      );
      return;
    }
    if (!deferHandshakeAssignment && phoneTrimmed.length === 0) {
      showAppAlert(
        "Driver phone required",
        "Enter driver phone (tracking) to continue.",
      );
      return;
    }
    if (!deferHandshakeAssignment && regTrimmed.length === 0) {
      showAppAlert(
        "Vehicle number required",
        "Enter vehicle number to continue.",
      );
      return;
    }
    const phoneErr = phoneTrimmed ? validatePhone(phoneTrimmed) : null;
    if (!deferHandshakeAssignment && phoneErr) {
      showAppAlert("Invalid driver phone", phoneErr);
      return;
    }
    if (!tripDetailsReady) {
      showAppAlert(
        "Trip details required",
        "Set vehicle arrival date before deploying. Vehicle type, product, and weight come from the indent.",
      );
      return;
    }
    if (staffHandshakeDeployLockRef.current) {
      showAppAlert("Convert in progress", "Wait for the current convert to finish.");
      return;
    }
    staffHandshakeDeployLockRef.current = true;
    try {
      setIsDeploying(true);
      const { error: detailsErr } = await persistIndentDeployTripDetails(
        load.id,
        deployPickupDate,
        deployWeightTons,
        deployVehicleType,
        deployLoadType,
      );
      if (detailsErr) {
        showAppAlert("Could not save trip details", detailsErr.message);
        return;
      }
      const vehicleIdForQuote = deferHandshakeAssignment
        ? null
        : typeof assignVehicleId === "string"
          ? assignVehicleId
          : null;
      const regNum = deferHandshakeAssignment ? "" : regTrimmed;
      const { error: tripErr, trip } = await createDeployTripFromAward(
        load,
        orgId,
        myQuotes,
        {
          driverId: null,
          vehicleId: vehicleIdForQuote,
          vehicleDisplayNumber: regNum || null,
        },
      );
      if (tripErr || !trip) {
        showAppAlert(
          "Could not create trip",
          formatDeployTripError(tripErr?.message),
        );
        return;
      }
      const subSupplierId = handshakeSubSupplierId;
      const subRateNum = handshakeSubRateNum;
      const shouldSaveSubcontract =
        subSupplierId !== "" &&
        handshakeSubRateRaw !== "" &&
        Number.isFinite(subRateNum) &&
        subRateNum >= 0;

      const saveSubcontract = async () => {
        if (!shouldSaveSubcontract) return;
        const isTripOwner = trip.organization_id === orgId;
        const { supplier: partnerRow } = await getSupplierById(
          orgId,
          subSupplierId,
        );
        const partnerName = (
          partnerRow?.company_name ||
          partnerRow?.name ||
          partnerRow?.contact_person ||
          ""
        ).trim() || null;

        if (isTripOwner) {
          const { error: supplierUpdateErr } = await updateTripSupplier(
            trip.id,
            {
              supplier_id: subSupplierId,
              supplier_rate: subRateNum,
              supplier_name: partnerName,
              trip_payout_mode: "market",
            },
          );
          if (supplierUpdateErr) {
            showAppAlert(
              "Trip created",
              `Partner was saved, but trip supplier link could not be updated. ${supplierUpdateErr.message}`,
            );
          }
        }

        const { error: subErr } = await upsertTripSubcontract({
          viewerOrgId: orgId,
          tripId: trip.id,
          supplierId: subSupplierId,
          rate: subRateNum,
        });
        if (subErr)
          showAppAlert(
            "Trip created",
            `Partner could not be saved. ${subErr.message}`,
          );
        queryClient.invalidateQueries({
          queryKey: ["q", "trips", "subcontracts", orgId],
        });
      };

      if (deferHandshakeAssignment || !phoneTrimmed || phoneErr) {
        await Promise.all([
          saveSubcontract(),
          updateIndent(load.id, { status: "completed" }),
        ]);
        finishDeploySuccess({
          tripId: trip.id,
          toast: deferHandshakeAssignment
            ? "Trip created — add driver and vehicle on trip detail when ready."
            : "Trip created (OTP not generated)",
        });
        return;
      }
      const { error: availabilityError, result: availability } =
        await getDriverAvailabilityByPhoneGlobal(phoneTrimmed, {
          excludeTripId: trip.id,
          anyOpenTripBlocks: true,
          requireAuthoritativeRpc: true,
        });
      if (availabilityError) {
        throw availabilityError;
      }
      if (availability.isBusy) {
        await Promise.all([
          saveSubcontract(),
          updateIndent(load.id, { status: "completed" }),
        ]);
        finishDeploySuccess({
          tripId: trip.id,
          toast: "Trip created — driver is already on another trip.",
        });
        showAppAlert(
          "Trip created",
          `Driver is already assigned to ${availability.ongoingTripLabel ?? "another ongoing trip"}.\n\nComplete or unassign that trip before assigning this one.`,
        );
        return;
      }

      const { error: assignAggErr, driverLinked } =
        await assignAggregateTripDriverByPhone(
          trip.id,
          orgId,
          phoneTrimmed,
          regNum || null,
          null,
          null,
          nameTrimmed,
        );
      if (assignAggErr) {
        await Promise.all([
          saveSubcontract(),
          updateIndent(load.id, { status: "completed" }),
        ]);
        finishDeploySuccess({
          tripId: trip.id,
          toast: "Trip created — assign driver from trip detail.",
        });
        showAppAlert(
          "Trip created",
          `Driver could not be assigned. ${humanizeTripIdInRpcError(assignAggErr.message, trip)}\n\nAssign driver from trip detail to generate OTP.`,
        );
        return;
      }

      // A driver who already has a linked account (e.g. used the app on a
      // prior trip) has nothing left to prove — the OTP exists solely to
      // link a phone number to a real person. Skip generating/showing one
      // here so the dispatcher isn't shown a code that will never be
      // consumed and looks like a pending step that doesn't actually apply.
      let otpCode: string | null = null;
      let otpExpiresAt: string | null = null;
      if (!driverLinked) {
        const { error: otpErr, code, expires_at } = await generateTripOtp(trip.id);
        if (otpErr || !code) {
          showAppAlert(
            "Trip created",
            "OTP could not be generated. Get OTP from the trip detail screen.",
          );
        } else {
          otpCode = code;
          otpExpiresAt = expires_at;
        }
      }

      await Promise.all([
        saveSubcontract(),
        updateIndent(load.id, { status: "completed" }),
      ]);
      finishDeploySuccess({
        tripId: trip.id,
        otpCode,
        otpExpiresAt,
        toast: driverLinked
          ? "Trip created"
          : otpCode
            ? "OTP generated"
            : "Trip created",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error.";
      showAppAlert("Could not deploy", msg);
    } finally {
      staffHandshakeDeployLockRef.current = false;
      setIsDeploying(false);
    }
  }, [
    currentLoad,
    isDeploying,
    orgId,
    myQuotes,
    subcontractSupplierId,
    subcontractRate,
    staffHandshakeAssignLater,
    aggregateDriverTrackingName,
    aggregateDriverPhone,
    assignVehicleRegistration,
    assignVehicleId,
    deployPickupDate,
    deployWeightTons,
    deployVehicleType,
    deployLoadType,
    tripDetailsReady,
    queryClient,
    finishDeploySuccess,
  ]);

  return {
    state: {
      isOpen: currentLoad !== null,
      currentLoad,
      closingToList,
      isDeploying,
      showOtp: deployOtpCode !== null,
      useAdHocDriver,
      assignDriverId,
      assignVehicleId,
      assignVehicleRegistration,
      aggregateDriverTrackingName,
      aggregateDriverPhone,
      aggregatePhoneName,
      aggregatePhoneNotFound,
      aggregatePhoneInTrip,
      aggregatePhoneMatches,
      aggregatePhoneLookupLoading,
      aggregatePhoneSelectedUserId,
      subcontractSupplierId,
      subcontractRate,
      aggregateAdvancePaid,
      deployOtpCode,
      deployOtpExpiresAt,
      deployTripIdForOtp,
      staffHandshakeAssignLater,
      deployPickupDate,
      deployWeightTons,
      deployVehicleType,
      deployLoadType,
      tripDetailsReady,
      rosterReady,
      adHocReady,
      aggregateTrackingFlowReady,
      aggregatePartnerHandshakeComplete,
      aggregateHasDriverName,
      aggregateHasVehicleText,
    },
    set: {
      useAdHocDriver: setUseAdHocDriver,
      assignDriverId: setAssignDriverId,
      assignVehicleId: setAssignVehicleId,
      assignVehicleRegistration: setAssignVehicleRegistration,
      aggregateDriverTrackingName: setAggregateDriverTrackingName,
      aggregateDriverPhone: setAggregateDriverPhone,
      aggregatePhoneName: setAggregatePhoneName,
      aggregatePhoneNotFound: setAggregatePhoneNotFound,
      aggregatePhoneInTrip: setAggregatePhoneInTrip,
      applyAggregatePhoneMatch,
      subcontractSupplierId: setSubcontractSupplierId,
      subcontractRate: setSubcontractRate,
      aggregateAdvancePaid: setAggregateAdvancePaid,
      deployOtpCode: setDeployOtpCode,
      deployOtpExpiresAt: setDeployOtpExpiresAt,
      deployTripIdForOtp: setDeployTripIdForOtp,
      staffHandshakeAssignLater: setStaffHandshakeAssignLater,
      deployPickupDate: setDeployPickupDate,
      deployWeightTons: setDeployWeightTons,
      deployVehicleType: setDeployVehicleType,
      deployLoadType: setDeployLoadType,
      aggregateDriverNameManualRef,
    },
    open,
    close,
    deployRoster,
    deployAdHoc,
    backFromOtp,
  };
}
