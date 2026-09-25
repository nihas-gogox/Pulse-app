/**
 * Full-screen indent deploy — asset and aggregate allocation wizards.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Switch, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";

import { CenteredLoadingView } from "@/components/CenteredLoadingView";
import {
  fullPageWizardStyles,
  WizardPartyContextRow,
  WizardPriorSelections,
  type WizardPriorSelectionItem,
} from "@/components/full-page-wizard";
import { useOrganization } from "@/contexts/OrganizationContext";
import { IndentAggregateAllocationStep } from "@/features/indents/components/IndentAggregateAllocationStep";
import { IndentAllocationConfirmSummary } from "@/features/indents/components/IndentAllocationConfirmSummary";
import { IndentAllocationSourceStep } from "@/features/indents/components/IndentAllocationSourceStep";
import { IndentAllocationTripDetailsStep } from "@/features/indents/components/IndentAllocationTripDetailsStep";
import { IndentAssetAllocationStep } from "@/features/indents/components/IndentAssetAllocationStep";
import { IndentDeployOtpPanel } from "@/features/indents/components/IndentDeployOtpPanel";
import {
  AssignmentFlowFooter,
  AssignmentFlowShell,
  getIndentAllocationWizardSteps,
  indentAllocationStepSubtitle,
  isIndentAllocationStepComplete,
  type IndentAllocationStepId,
} from "@/features/allocation";
import { useStaffHandshake } from "@/features/network/hooks/useStaffHandshake";
import {
  seedDeployLoadTypeFromIndent,
  seedDeployPickupDateFromIndent,
  seedDeployVehicleTypeFromIndent,
  seedDeployWeightTonsFromIndent,
} from "@/features/indents/utils/indentDeployTripDetails.util";
import { formatIsoDateForDisplay, isValidIsoDateString } from "@/lib/dateIso.util";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { ListTodo } from "lucide-react-native";
import { createTripDesktopStyles as tripS } from "@/features/trips/components/add-trip/createTripDesktop.styles";
import { resolveMarketIndentShipperLabel } from "@/features/indents/utils/indentPartyDisplay.util";
import { ROUTES } from "@/lib/routes";
import {
  useClientsQuery,
  useDriversQuery,
  useInvalidateIndents,
  useMyDirectQuotesQuery,
  useSuppliersQuery,
  useVisibleIndentQuery,
  useVehiclesQuery,
} from "@/lib/queries";
import { useLoadChainAncestorsQuery } from "@/lib/queries/useLoadChainAncestorsQuery";
import { getChainBlockReason } from "@/features/trips/services/loadChainGuard.service";

export type IndentAllocationFlowFocus = "driver" | "vehicle";

export interface IndentAllocationFlowScreenProps {
  indentId: string;
  /** From award modal “Assign vehicle” — open fleet vehicle step first. */
  initialFocus?: IndentAllocationFlowFocus;
  onBack: () => void;
}

export function IndentAllocationFlowScreen({
  indentId,
  initialFocus,
  onBack,
}: IndentAllocationFlowScreenProps) {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;
  const invalidateIndents = useInvalidateIndents();
  const [step, setStep] = useState<IndentAllocationStepId>(
    initialFocus ? "fleet" : "source",
  );

  const {
    data: indent,
    isPending: indentPending,
    isError: indentError,
  } = useVisibleIndentQuery(orgId, indentId);

  const { data: myQuotes = [] } = useMyDirectQuotesQuery(orgId);
  const { data: drivers = [] } = useDriversQuery(orgId);
  const { data: vehicles = [] } = useVehiclesQuery(orgId);
  const { data: suppliers = [] } = useSuppliersQuery(orgId);
  const { data: myClients = [] } = useClientsQuery(orgId);

  const activeDrivers = useMemo(
    () => drivers.filter((d) => !d.left_at),
    [drivers],
  );

  // Load-chain loop guard: a load must not be sub-contracted back to an org
  // already upstream in its chain (the cargo owner, or a broker that handled
  // it). Those partners stay visible but greyed, with the reason.
  const { data: chainAncestors = [] } = useLoadChainAncestorsQuery(indentId);
  // This load's own shipper org, resolved without the ancestor RPC:
  // - Viewer is the awarded supplier (indent.organization_id is some other
  //   org): that other org IS the shipper directly.
  // - Viewer owns the indent themselves (the common case — they typed the
  //   shipper as free-text `client_name`): resolve it via their own CRM
  //   `clients` row for that name, same match the RPC does server-side, but
  //   synchronous and independent of it.
  const shipperOrgId = useMemo(() => {
    if (!indent) return "";
    const indentOwnerOrgId = String(indent.organization_id ?? "").trim();
    if (orgId && indentOwnerOrgId && indentOwnerOrgId !== orgId) {
      return indentOwnerOrgId;
    }
    const wantedName = String(indent.client_name ?? "").trim().toLowerCase();
    if (!wantedName) return "";
    const match = myClients.find(
      (c) =>
        String(c.name ?? "").trim().toLowerCase() === wantedName &&
        !!c.linked_organization_id,
    );
    return String(match?.linked_organization_id ?? "").trim();
  }, [indent, orgId, myClients]);
  const blockedPartnerReasons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const supplier of suppliers) {
      if (shipperOrgId) {
        const linkedOrg = String(supplier.linked_organization_id ?? "").trim();
        if (linkedOrg && linkedOrg === shipperOrgId) {
          const label =
            supplier.company_name?.trim() || supplier.name?.trim() || "This partner";
          map[supplier.id] = `${label} is the shipper on this load and cannot also be its supplier.`;
          continue;
        }
      }
      if (chainAncestors.length > 0) {
        const reason = getChainBlockReason(supplier, chainAncestors, orgId);
        if (reason) map[supplier.id] = reason.message;
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [suppliers, chainAncestors, orgId, shipperOrgId]);

  const handshake = useStaffHandshake({
    orgId,
    myQuotes,
    onSuccess: () => {
      if (orgId) {
        invalidateIndents(orgId, { bustPartnerSupplierMarket: true });
      }
    },
  });

  const { open, close, state, set, deployRoster, deployAdHoc, backFromOtp } = handshake;
  const {
    currentLoad,
    isDeploying,
    useAdHocDriver,
    assignDriverId,
    assignVehicleId,
    staffHandshakeAssignLater,
    deployOtpCode,
    deployPickupDate,
    deployWeightTons,
    deployVehicleType,
    deployLoadType,
    tripDetailsReady,
    subcontractSupplierId,
    subcontractRate,
    aggregateDriverTrackingName,
    aggregateDriverPhone,
    assignVehicleRegistration,
    aggregatePhoneInTrip,
    aggregatePhoneMatches,
    aggregatePhoneLookupLoading,
    aggregatePhoneSelectedUserId,
    deployTripIdForOtp,
    deployOtpExpiresAt,
  } = state;

  const flowSteps = useMemo(
    () =>
      getIndentAllocationWizardSteps({
        aggregate: useAdHocDriver,
        assignLater: staffHandshakeAssignLater,
      }),
    [useAdHocDriver, staffHandshakeAssignLater],
  );

  const stepIndex = flowSteps.findIndex((s) => s.id === step);
  const isLastStep = stepIndex >= 0 && stepIndex === flowSteps.length - 1;

  const openedIndentKeyRef = useRef<string | null>(null);
  const seededIndentKeyRef = useRef<string | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!indent) return;
    const openKey = `${indent.id}:${initialFocus ?? ""}`;
    if (openedIndentKeyRef.current === openKey) return;
    openedIndentKeyRef.current = openKey;
    open(indent);
    /** Award “Assign driver/vehicle” deep-links skip source and open grouped fleet. */
    if (initialFocus === "vehicle" || initialFocus === "driver") {
      set.useAdHocDriver(false);
      setStep("fleet");
    } else {
      setStep("source");
    }
  }, [indent, open, initialFocus, set]);

  useEffect(() => {
    if (!indent || !currentLoad || currentLoad.id !== indent.id) return;
    const seedKey = [
      indent.id,
      indent.weight ?? "",
      indent.vehicle_type ?? "",
      indent.load_type ?? "",
      indent.pickup_date ?? "",
    ].join("|");
    if (seededIndentKeyRef.current === seedKey) return;
    seededIndentKeyRef.current = seedKey;
    if (!deployWeightTons) {
      const weight = seedDeployWeightTonsFromIndent(indent);
      if (weight) set.deployWeightTons(weight);
    }
    if (!deployVehicleType) {
      const vehicleType = seedDeployVehicleTypeFromIndent(indent);
      if (vehicleType) set.deployVehicleType(vehicleType);
    }
    if (!deployLoadType) {
      const loadType = seedDeployLoadTypeFromIndent(indent);
      if (loadType) set.deployLoadType(loadType);
    }
    if (!deployPickupDate) {
      const pickup = seedDeployPickupDateFromIndent(indent);
      if (pickup) set.deployPickupDate(pickup);
    }
  }, [
    indent,
    currentLoad,
    deployWeightTons,
    deployVehicleType,
    deployLoadType,
    deployPickupDate,
    set,
  ]);

  /**
   * Seed the subcontract partner + rate from the indent's own award — but
   * only when THIS org is the indent's owner (organization_id), i.e. they
   * are the one who awarded the load and are now deploying it to the
   * partner they already chose. assigned_supplier_id is an organizations
   * FK naming who won the award, so match it against
   * suppliers.linked_organization_id to find this account's own tracking
   * record for that real org.
   *
   * When the viewer org is instead the AWARDED supplier itself (e.g.
   * Paperkraft, having won this indent from nihas logs, now sub-deploying
   * to its own chosen partner further down the chain), assigned_supplier_id
   * equals the viewer's own org — there is no "partner to preselect" here,
   * because the partner on this screen is whoever Paperkraft is
   * sub-contracting to, unrelated to who awarded Paperkraft. Pre-filling in
   * that case would be wrong: assigned_supplier_rate is what Paperkraft
   * RECEIVES from nihas logs, not what they PAY their own sub-supplier —
   * those are two different figures and must not be conflated.
   */
  const awardSeededIndentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!indent || !orgId || suppliers.length === 0) return;
    if (awardSeededIndentIdRef.current === indent.id) return;
    if (!indent.assigned_supplier_id) return;
    // Only seed when this viewer is the indent's own owner awarding it out —
    // never when the viewer IS the awarded org sub-deploying further.
    if (indent.organization_id !== orgId) return;
    const awardedSupplier = suppliers.find(
      (s) => s.linked_organization_id === indent.assigned_supplier_id,
    );
    if (!awardedSupplier) return;
    awardSeededIndentIdRef.current = indent.id;
    set.subcontractSupplierId(awardedSupplier.id);
    if (indent.assigned_supplier_rate != null) {
      set.subcontractRate(String(indent.assigned_supplier_rate));
    }
  }, [indent, orgId, suppliers, set]);

  /**
   * Reference figure for the rates step: what THIS org itself bid & won on
   * the indent, shown as a fixed "You won" strip next to whatever rate it's
   * now typing for its own sub-supplier. Only meaningful when the viewer
   * org IS the awarded supplier (assigned_supplier_id === orgId) — the
   * scenario the seeding effect above deliberately skips, since that
   * receivable figure is never the same as the payable rate being entered.
   */
  const awardedRate =
    indent && orgId && indent.assigned_supplier_id === orgId
      ? indent.assigned_supplier_rate ?? null
      : null;

  useEffect(() => {
    return () => {
      openedIndentKeyRef.current = null;
      closeRef.current();
    };
  }, []);

  useEffect(() => {
    if (!orgId || !indentId || indentPending) return;
    if (!indent || indentError) onBack();
  }, [orgId, indentId, indent, indentPending, indentError, onBack]);

  // Defensive: a blocked supplier (this load's own shipper) must never survive
  // as the deploy target — clears it even if it was selected before this
  // guard existed, or if a later step is reached without revisiting Partner.
  useEffect(() => {
    if (!subcontractSupplierId) return;
    if (blockedPartnerReasons?.[subcontractSupplierId]) {
      set.subcontractSupplierId(null);
    }
  }, [subcontractSupplierId, blockedPartnerReasons, set]);

  useEffect(() => {
    if (flowSteps.some((s) => s.id === step)) return;
    setStep(flowSteps[0]?.id ?? "source");
  }, [flowSteps, step]);

  const advanceToRates = useCallback(() => {
    setStep("rates");
  }, []);

  const handleClose = useCallback(() => {
    close();
    onBack();
  }, [close, onBack]);

  const selectedDriver = activeDrivers.find((d) => String(d.id) === assignDriverId);
  const driverLabel =
    selectedDriver?.name ?? selectedDriver?.phone ?? "Not selected";
  const selectedVehicle =
    typeof assignVehicleId === "string"
      ? vehicles.find((v) => String(v.id) === assignVehicleId)
      : null;
  const vehicleLabel = selectedVehicle?.vehicle_number ?? "Not selected";

  const selectedPartner = suppliers.find((s) => s.id === subcontractSupplierId);
  const partnerLabel =
    selectedPartner?.company_name?.trim() ||
    selectedPartner?.name?.trim() ||
    "Not selected";

  const tripDateLabel = deployPickupDate
    ? formatIsoDateForDisplay(deployPickupDate)
    : "—";

  const shipperLabel = currentLoad
    ? resolveMarketIndentShipperLabel(currentLoad)
    : "Shipper";
  const loadRouteSubtitle = currentLoad
    ? `${currentLoad.pickup_area || "—"} → ${currentLoad.drop_location || "—"}`
    : null;

  const priorSelections = useMemo((): WizardPriorSelectionItem[] => {
    if (!currentLoad || deployOtpCode) return [];
    /** Final date step uses IndentAllocationConfirmSummary instead. */
    if (step === "commodity") return [];
    const items: WizardPriorSelectionItem[] = [];

    if (useAdHocDriver) {
      /**
       * Phone → Load: one tiny strip (shipper · rate · phone · name · vehicle).
       * No stacked cards / no live driver-name preview in chrome.
       */
      const summarySteps = new Set([
        "driverPhone",
        "driverName",
        "vehicleReg",
      ]);
      if (summarySteps.has(step)) {
        items.push({
          id: "shipper",
          label: "Shipper",
          name: shipperLabel,
        });

        const rateRaw = subcontractRate.trim();
        if (rateRaw) {
          items.push({
            id: "rate",
            label: "Rate",
            name: `₹${Number(rateRaw).toLocaleString("en-IN")}`,
            onPress: () => setStep("rates"),
          });
        }

        if (
          (step === "driverName" || step === "vehicleReg") &&
          aggregateDriverPhone.trim()
        ) {
          items.push({
            id: "phone",
            label: "Phone",
            name: aggregateDriverPhone.trim(),
            onPress: () => setStep("driverPhone"),
          });
        }

        if (step === "vehicleReg" && aggregateDriverTrackingName.trim()) {
          items.push({
            id: "name",
            label: "Driver",
            name: aggregateDriverTrackingName.trim(),
            onPress: () => setStep("driverName"),
          });
        }

        return items;
      }
    }

    return items;
  }, [
    currentLoad,
    deployOtpCode,
    useAdHocDriver,
    step,
    shipperLabel,
    subcontractRate,
    aggregateDriverPhone,
    aggregateDriverTrackingName,
  ]);

  const confirmAllocationRows = useMemo(() => {
    const editable = !deployOtpCode;
    const rows: {
      id: string;
      label: string;
      value: string;
      onEdit?: () => void;
    }[] = [
      {
        id: "shipper",
        label: "Shipper",
        value: shipperLabel,
      },
    ];

    if (useAdHocDriver) {
      rows.push({
        id: "partner",
        label: "Partner",
        value: subcontractSupplierId ? partnerLabel : "—",
        onEdit: editable ? () => setStep("partner") : undefined,
      });
      const rateRaw = subcontractRate.trim();
      rows.push({
        id: "rate",
        label: "Rate",
        value: rateRaw
          ? `₹${Number(rateRaw).toLocaleString("en-IN")}`
          : "—",
        onEdit: editable ? () => setStep("rates") : undefined,
      });
      if (!staffHandshakeAssignLater) {
        rows.push({
          id: "phone",
          label: "Driver phone",
          value: aggregateDriverPhone.trim() || "—",
          onEdit: editable ? () => setStep("driverPhone") : undefined,
        });
        rows.push({
          id: "driver",
          label: "Driver",
          value: aggregateDriverTrackingName.trim() || "—",
          onEdit: editable ? () => setStep("driverName") : undefined,
        });
        rows.push({
          id: "vehicle",
          label: "Vehicle",
          value: assignVehicleRegistration.trim() || "—",
          onEdit: editable ? () => setStep("vehicleReg") : undefined,
        });
      }
    } else if (!staffHandshakeAssignLater) {
      rows.push({
        id: "driver",
        label: "Driver",
        value: assignDriverId ? driverLabel : "—",
        onEdit: editable ? () => setStep("fleet") : undefined,
      });
      rows.push({
        id: "vehicle",
        label: "Vehicle",
        value:
          typeof assignVehicleId === "string" ? vehicleLabel : "—",
          onEdit: editable ? () => setStep("fleet") : undefined,
      });
    }

    if (deployOtpCode) {
      rows.push({
        id: "arrival",
        label: "Vehicle arrival",
        value: tripDateLabel,
      });
    }

    if (deployVehicleType.trim()) {
      rows.push({
        id: "vehicleType",
        label: "Vehicle type",
        value: deployVehicleType.trim(),
      });
    }
    if (deployLoadType.trim()) {
      rows.push({
        id: "product",
        label: "Product",
        value: deployLoadType.trim(),
      });
    }
    if (deployWeightTons.trim()) {
      rows.push({
        id: "weight",
        label: "Weight",
        value: `${deployWeightTons.trim()} t`,
      });
    }

    return rows;
  }, [
    deployOtpCode,
    shipperLabel,
    useAdHocDriver,
    staffHandshakeAssignLater,
    subcontractSupplierId,
    partnerLabel,
    subcontractRate,
    aggregateDriverPhone,
    aggregateDriverTrackingName,
    assignVehicleRegistration,
    assignDriverId,
    driverLabel,
    assignVehicleId,
    vehicleLabel,
    tripDateLabel,
    deployVehicleType,
    deployLoadType,
    deployWeightTons,
  ]);

  const allocationContextRow = useMemo(() => {
    if (deployOtpCode || !currentLoad) return null;
    /** Final confirm step uses IndentAllocationConfirmSummary. */
    if (step === "commodity") return null;

    const left = {
      label: "Shipper",
      name: shipperLabel,
      subtitle: loadRouteSubtitle,
      entityType: "client" as const,
    };

    if (useAdHocDriver) {
      /**
       * After rates, chrome is the compact prior strip only (no duplicate
       * shipper / live driver-name card that overlaps the field).
       */
      if (
        step === "driverPhone" ||
        step === "driverName" ||
        step === "vehicleReg"
      ) {
        return null;
      }

      const partnerSteps = new Set<IndentAllocationStepId>([
        "partner",
        "rates",
      ]);
      if (partnerSteps.has(step)) {
        const partnerCell = {
          label: "Partner",
          name:
            selectedPartner && subcontractSupplierId
              ? partnerLabel
              : step === "partner"
                ? "Select partner"
                : "—",
          subtitle: selectedPartner
            ? [selectedPartner.supplier_type, selectedPartner.phone]
                .filter(Boolean)
                .join(" · ")
            : null,
          entityType: "supplier" as const,
          avatarUrl:
            (selectedPartner as { avatar_url?: string | null })?.avatar_url ??
            null,
          avatarSeed:
            (selectedPartner as { avatar_seed?: string | null })?.avatar_seed ??
            null,
          /** Rates / later steps: tap to change partner (back to picker). */
          onPress:
            step !== "partner" && selectedPartner
              ? () => setStep("partner")
              : undefined,
          showChevron: step !== "partner" && Boolean(selectedPartner),
          changeAffordance:
            step === "rates" ? ("change" as const) : ("chevron" as const),
        };

        /**
         * Rates: Partner is primary (with change chevron). Shipper secondary.
         * Partner step: Shipper left, Partner picker summary right.
         */
        if (step === "rates" && selectedPartner) {
          return {
            left: partnerCell,
            right: {
              label: "Shipper",
              name: shipperLabel,
              subtitle: loadRouteSubtitle,
              entityType: "client" as const,
            },
          };
        }

        return {
          left,
          right: partnerCell,
        };
      }

      return { left, right: null };
    }

    if (step === "fleet") {
      return {
        left,
        right: {
          label: "Driver",
          name:
            assignDriverId && selectedDriver ? driverLabel : "Select driver",
          subtitle: selectedDriver
            ? [selectedDriver.phone, selectedDriver.email]
                .filter(Boolean)
                .join(" · ")
            : null,
          entityType: "driver" as const,
          avatarUrl:
            (selectedDriver as { avatar_url?: string | null })?.avatar_url ??
            null,
          avatarSeed:
            (selectedDriver as { avatar_seed?: string | null })?.avatar_seed ??
            null,
        },
      };
    }

    if (step === "source") {
      return { left, right: null };
    }

    return null;
  }, [
    deployOtpCode,
    currentLoad,
    shipperLabel,
    loadRouteSubtitle,
    useAdHocDriver,
    step,
    selectedPartner,
    subcontractSupplierId,
    partnerLabel,
    assignDriverId,
    selectedDriver,
    driverLabel,
  ]);

  const stepComplete = isIndentAllocationStepComplete(step, {
    assignDriverId,
    assignVehicleId,
    subcontractSupplierId,
    subcontractRate,
    aggregateDriverTrackingName,
    aggregateDriverPhone,
    assignVehicleRegistration,
    tripDetailsReady,
    aggregatePhoneInTrip,
    aggregatePhoneLookupLoading,
    aggregatePhoneMatches,
    aggregatePhoneSelectedUserId,
    staffHandshakeAssignLater,
  });

  const stepSubtitle = deployOtpCode
    ? "Share this code with the driver to claim the trip"
    : indentAllocationStepSubtitle(step, useAdHocDriver);

  const footerSummary = useMemo(() => {
    if (deployOtpCode) return "";
    /** Final step: confirmation lives in the body, not the footer. */
    if (step === "commodity") return "";
    if (step === "source") return useAdHocDriver ? "Aggregate" : "Asset fleet";
    if (useAdHocDriver) {
      if (step === "partner") return partnerLabel;
      if (step === "rates") return subcontractRate.trim() ? `₹${subcontractRate.trim()}` : "—";
      if (step === "driverPhone") return aggregateDriverPhone.trim() || "—";
      if (step === "driverName") return aggregateDriverTrackingName.trim() || "—";
      if (step === "vehicleReg") return assignVehicleRegistration.trim() || "—";
      return partnerLabel;
    }
    if (step === "fleet") return `${driverLabel} · ${vehicleLabel}`;
    return `${driverLabel} · ${vehicleLabel}`;
  }, [
    deployOtpCode,
    step,
    useAdHocDriver,
    partnerLabel,
    subcontractRate,
    aggregateDriverTrackingName,
    aggregateDriverPhone,
    assignVehicleRegistration,
    driverLabel,
    vehicleLabel,
  ]);

  const handlePrimary = useCallback(() => {
    if (deployOtpCode) {
      handleClose();
      return;
    }
    if (!stepComplete) return;
    if (!isLastStep) {
      const next = flowSteps[stepIndex + 1];
      if (next) setStep(next.id);
      return;
    }
    if (useAdHocDriver) {
      void deployAdHoc();
    } else {
      void deployRoster();
    }
  }, [
    deployOtpCode,
    stepComplete,
    isLastStep,
    flowSteps,
    stepIndex,
    useAdHocDriver,
    deployAdHoc,
    deployRoster,
    handleClose,
  ]);

  const primaryDisabled = deployOtpCode
    ? false
    : !stepComplete || isDeploying;

  const primaryLabel = deployOtpCode
    ? "Done"
    : isLastStep
      ? "Convert to trip"
      : "Continue";

  const showBack = !deployOtpCode && stepIndex > 0;

  const handleBack = useCallback(() => {
    if (deployOtpCode) {
      backFromOtp();
      return;
    }
    const prev = flowSteps[stepIndex - 1];
    if (prev) setStep(prev.id);
  }, [deployOtpCode, backFromOtp, flowSteps, stepIndex]);

  const pickupDateError =
    deployPickupDate && !isValidIsoDateString(deployPickupDate)
      ? "Use a valid date (YYYY-MM-DD)."
      : null;

  const isCompactLayout = windowWidth < Layout.webDesktopMinWidth;

  const showAssignLaterOnPartner = !deployOtpCode && step === "partner";

  const onAddPartner = useCallback(() => {
    handleClose();
    setTimeout(
      () => {
        router.push("/(modals)/add-supplier" as import("expo-router").Href);
      },
      Platform.OS === "ios" ? 100 : 0,
    );
  }, [handleClose, router]);

  const fillBodyStep =
    step === "rates" ||
    step === "driverPhone" ||
    step === "driverName" ||
    step === "vehicleReg";

  /** Final confirm: Convert to trip only in the footer (Edit rows / header back to change). */
  const showFooterBack = showBack && !isLastStep && !fillBodyStep;

  /** Dense summary strip after rates (shipper · rate · …). */
  const compactChrome =
    step === "driverPhone" ||
    step === "driverName" ||
    step === "vehicleReg";

  const applySupplyMode = useCallback(
    (aggregate: boolean) => {
      set.useAdHocDriver(aggregate);
      if (aggregate) {
        set.assignDriverId(null);
        set.assignVehicleId(undefined);
      } else {
        set.aggregateDriverPhone("");
        set.aggregateDriverTrackingName("");
        set.subcontractSupplierId(null);
        set.subcontractRate("");
        set.assignVehicleRegistration("");
        set.aggregateDriverNameManualRef.current = false;
      }
    },
    [set],
  );

  const applyAssignLater = useCallback(
    (v: boolean) => {
      set.staffHandshakeAssignLater(v);
      if (v) {
        set.assignDriverId(null);
        set.assignVehicleId(undefined);
        set.aggregateDriverPhone("");
        set.aggregateDriverTrackingName("");
        set.assignVehicleRegistration("");
      }
    },
    [set],
  );

  const hasFlowChrome =
    Boolean(allocationContextRow) ||
    priorSelections.length > 0 ||
    showAssignLaterOnPartner ||
    (staffHandshakeAssignLater && step === "commodity");

  if (state.closingToList) {
    return null;
  }

  if (!currentLoad) {
    return <CenteredLoadingView message="Loading allocation…" />;
  }

  return (
    <AssignmentFlowShell
      fullScreen
      fillBody={fillBodyStep}
      scrollBody={!fillBodyStep}
      title={deployOtpCode ? "Trip claim code" : "Deploy load"}
      subtitle={
        deployOtpCode
          ? "Share this code with the driver to claim the trip."
          : stepSubtitle
      }
      stepIndex={undefined}
      stepTotal={undefined}
      steppedLayout={!isCompactLayout}
      onClose={() => (deployOtpCode ? backFromOtp() : handleClose())}
      onBack={showBack ? handleBack : undefined}
      showBack={showBack}
      footer={
        <AssignmentFlowFooter
          summary={
            deployOtpCode || fillBodyStep || isLastStep
              ? undefined
              : footerSummary
          }
          primaryLabel={primaryLabel}
          onPrimaryPress={handlePrimary}
          primaryDisabled={primaryDisabled}
          loading={isDeploying}
          secondaryLabel={showFooterBack ? "Back" : undefined}
          onSecondaryPress={showFooterBack ? handleBack : undefined}
        />
      }
      submitting={isDeploying}
    >
      {deployOtpCode ? (
        <View style={styles.otpStack}>
          <IndentAllocationConfirmSummary
            title="Allocation"
            hint={null}
            rows={confirmAllocationRows}
          />
          <IndentDeployOtpPanel
            code={deployOtpCode}
            expiresAt={deployOtpExpiresAt}
            tripId={deployTripIdForOtp}
            onCodeChange={(code, expiresAt) => {
              set.deployOtpCode(code);
              set.deployOtpExpiresAt(expiresAt);
            }}
          />
        </View>
      ) : (
        <View
          style={[
            styles.flowBody,
            fillBodyStep ? styles.flowBodyKeypad : fullPageWizardStyles.wizardStepBody,
          ]}
        >
          {hasFlowChrome ? (
            <View
              style={
                fillBodyStep
                  ? fullPageWizardStyles.wizardKeypadChromePad
                  : styles.flowChrome
              }
            >
              {allocationContextRow ? (
                <WizardPartyContextRow
                  left={allocationContextRow.left}
                  right={allocationContextRow.right}
                  compact={compactChrome}
                />
              ) : null}

              {priorSelections.length > 0 ? (
                <WizardPriorSelections
                  items={priorSelections}
                  compact={compactChrome}
                />
              ) : null}

              {showAssignLaterOnPartner ? (
                <View
                  style={[
                    tripS.inputBoxClean,
                    tripS.allocAssignLaterBox,
                    isCompactLayout && tripS.compactAssignLaterBox,
                  ]}
                >
                  <ListTodo size={16} color={Theme.textRouteCard} strokeWidth={2} />
                  <View style={tripS.allocAssignLaterCopy}>
                    <Text style={tripS.allocAssignLaterTitle}>Assign later</Text>
                    <Text style={tripS.allocAssignLaterSub}>
                      Add vehicle & driver phone on trip detail
                    </Text>
                  </View>
                  <Switch
                    value={staffHandshakeAssignLater}
                    onValueChange={applyAssignLater}
                    trackColor={{
                      false: Theme.borderLight,
                      true: Theme.textPrimaryDark,
                    }}
                    thumbColor={Theme.cardWhite}
                  />
                </View>
              ) : null}

              {staffHandshakeAssignLater && step === "commodity" ? (
                <View style={fullPageWizardStyles.shipperWarningCard}>
                  <Text style={fullPageWizardStyles.shipperWarningText}>
                    {useAdHocDriver
                      ? "Partner and rate are required now. Add driver and vehicle on the trip screen before the trip starts."
                      : "Assign vehicle and driver on the trip screen before the trip starts."}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View
            style={
              fillBodyStep
                ? fullPageWizardStyles.wizardKeypadStepFill
                : styles.flowStep
            }
          >
            {step === "source" ? (
              <IndentAllocationSourceStep
                compact={isCompactLayout}
                mode={useAdHocDriver ? "aggregate" : "asset"}
                onModeChange={(mode) => applySupplyMode(mode === "aggregate")}
              />
            ) : null}

            {useAdHocDriver &&
            step !== "commodity" &&
            (step === "partner" ||
              step === "rates" ||
              step === "driverName" ||
              step === "driverPhone" ||
              step === "vehicleReg") ? (
              <IndentAggregateAllocationStep
                step={step}
                suppliers={suppliers}
                state={state}
                set={set}
                onAddPartner={onAddPartner}
                blockedReasonBySupplierId={blockedPartnerReasons}
                onPartnerSelected={advanceToRates}
                awardedRate={awardedRate}
              />
            ) : null}

            {step === "commodity" ? (
              <View style={styles.confirmStep}>
                <IndentAllocationConfirmSummary
                  rows={confirmAllocationRows}
                />
                <IndentAllocationTripDetailsStep
                  pickupDate={deployPickupDate}
                  onPickupDateChange={set.deployPickupDate}
                  pickupDateError={pickupDateError}
                />
              </View>
            ) : null}

            {!useAdHocDriver && step === "fleet" ? (
              <IndentAssetAllocationStep
                compact={isCompactLayout}
                orgId={orgId}
                drivers={activeDrivers}
                vehicles={vehicles}
                assignDriverId={assignDriverId}
                assignVehicleId={assignVehicleId}
                assignLater={staffHandshakeAssignLater}
                onAssignLaterChange={applyAssignLater}
                onSelectDriver={(id) =>
                  set.assignDriverId(assignDriverId === id ? null : id)
                }
                onSelectVehicle={(id) =>
                  set.assignVehicleId(assignVehicleId === id ? undefined : id)
                }
                onAddDriver={() => {
                  router.push({
                    pathname: "/(modals)/add-driver",
                    params: { returnTo: ROUTES.indentAllocation(indentId) },
                  });
                }}
                onAddVehicle={() => {
                  router.push({
                    pathname: "/(modals)/add-vehicle",
                    params: { returnTo: ROUTES.indentAllocation(indentId) },
                  });
                }}
              />
            ) : null}
          </View>
        </View>
      )}
    </AssignmentFlowShell>
  );
}

const styles = StyleSheet.create({
  flowBody: {
    width: "100%",
    alignSelf: "stretch",
    minWidth: 0,
    flexGrow: 1,
  },
  flowBodyKeypad: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    gap: 6,
    overflow: "hidden",
  },
  flowChrome: {
    width: "100%",
    gap: 14,
    flexShrink: 0,
    backgroundColor: Theme.screenBackground,
    zIndex: 2,
    paddingBottom: 8,
  },
  flowStep: {
    width: "100%",
    minWidth: 0,
    gap: 12,
  },
  confirmStep: {
    width: "100%",
    gap: 16,
  },
  otpStack: {
    width: "100%",
    gap: 16,
  },
});
