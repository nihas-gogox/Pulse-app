import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@pulse/domain/contexts/AuthContext";
import { CenteredLoadingView } from "@pulse/ui/components/CenteredLoadingView";
import type { TripRow } from "@pulse/domain/features/trips/services/trips.service";

import { FuelEntryScreen } from "../fuel/FuelEntryScreen";
import { OtherExpenseEntryScreen } from "../other/OtherExpenseEntryScreen";
import { TollEntryScreen } from "../toll/TollEntryScreen";
import type { TripOtherExpenseCategory } from "@pulse/domain/features/trips/operations/types";
import {
  parseDriverExpenseCategoryParam,
  type DriverExpenseCategoryNav,
  type DriverExpenseFormKind,
} from "@pulse/domain/features/trips/operations/shared/driverExpenseCategoryNav.util";
import { resolveExpenseEntryKind } from "@pulse/domain/features/trips/operations/shared/resolveExpenseEntryKind.util";
import { useExpenseBillCapture } from "@pulse/domain/features/trips/operations/shared/useExpenseBillCapture";

type Props = {
  trip: TripRow;
  entryId?: string | null;
  initialKind?: DriverExpenseFormKind;
  initialOtherCategory?: TripOtherExpenseCategory | null;
};

/**
 * Driver expense shell — switches fuel / toll / other in-page (no route replace).
 * Bill OCR state lives here so category switches keep photo + scan progress.
 */
export function DriverUnifiedExpenseEntryScreen({
  trip,
  entryId,
  initialKind = "other",
  initialOtherCategory,
}: Props) {
  const { profile } = useAuth();
  const trimmedEntryId = entryId?.trim() ?? "";
  const isEditing = Boolean(trimmedEntryId);

  const [formKind, setFormKind] = useState<DriverExpenseFormKind>(initialKind);
  const [otherCategory, setOtherCategory] = useState<TripOtherExpenseCategory>(() =>
    parseDriverExpenseCategoryParam(initialOtherCategory ?? undefined),
  );
  const [resolvedEditKind, setResolvedEditKind] = useState<DriverExpenseFormKind | null>(
    isEditing ? null : initialKind,
  );
  const [editResolveLoading, setEditResolveLoading] = useState(isEditing);

  const billCapture = useExpenseBillCapture({
    organizationId: trip.organization_id,
    tripId: trip.id,
    createdBy: profile?.uid ?? null,
    expenseEntryId: trimmedEntryId || null,
    kind: formKind,
    permissionMessage: "Enable camera or photo library access to attach a receipt photo.",
    previewOcrUpdates: () => [],
  });

  useEffect(() => {
    if (isEditing) return;
    setFormKind(initialKind);
    setOtherCategory(parseDriverExpenseCategoryParam(initialOtherCategory ?? undefined));
  }, [initialKind, initialOtherCategory, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setEditResolveLoading(false);
      setResolvedEditKind(null);
      return;
    }

    let mounted = true;
    setEditResolveLoading(true);
    void resolveExpenseEntryKind(trimmedEntryId).then((resolved) => {
      if (!mounted) return;
      setResolvedEditKind(resolved.kind);
      setFormKind(resolved.kind);
      if (resolved.otherCategory) setOtherCategory(resolved.otherCategory);
      setEditResolveLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [isEditing, trimmedEntryId]);

  const handleCategoryNav = useCallback((next: DriverExpenseCategoryNav) => {
    if (next === "fuel") {
      setFormKind("fuel");
      return;
    }
    if (next === "toll") {
      setFormKind("toll");
      return;
    }
    setFormKind("other");
    setOtherCategory(next);
  }, []);

  const handleOtherCategoryChange = useCallback((next: TripOtherExpenseCategory) => {
    setOtherCategory(next);
  }, []);

  if (isEditing && editResolveLoading) {
    return <CenteredLoadingView message="Loading expense…" />;
  }

  /** Only pass entryId when the active form matches the stored entry type. */
  const activeEntryId =
    isEditing && formKind === (resolvedEditKind ?? formKind) ? trimmedEntryId : undefined;

  if (formKind === "fuel") {
    return (
      <FuelEntryScreen
        trip={trip}
        entryId={activeEntryId}
        otherCategory={otherCategory}
        onCategoryNavChange={handleCategoryNav}
        billCapture={billCapture}
      />
    );
  }

  if (formKind === "toll") {
    return (
      <TollEntryScreen
        trip={trip}
        entryId={activeEntryId}
        otherCategory={otherCategory}
        onCategoryNavChange={handleCategoryNav}
        billCapture={billCapture}
      />
    );
  }

  return (
    <OtherExpenseEntryScreen
      trip={trip}
      entryId={activeEntryId}
      expenseCategory={otherCategory}
      onExpenseCategoryChange={handleOtherCategoryChange}
      onCategoryNavChange={handleCategoryNav}
      billCapture={billCapture}
    />
  );
}
