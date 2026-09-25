import { useRouter } from "expo-router";
import { useCallback } from "react";

import { DriverExpenseChipSelect } from "./DriverExpenseChipSelect";
import {
  activeDriverExpenseCategoryValue,
  DRIVER_EXPENSE_CATEGORY_OPTIONS,
  navigateDriverExpenseCategory,
  type DriverExpenseCategoryNav,
  type DriverExpenseFormKind,
} from "@pulse/domain/features/trips/operations/shared/driverExpenseCategoryNav.util";
import type { TripOtherExpenseCategory } from "@pulse/domain/features/trips/operations/types";

type Props = {
  tripId: string;
  formKind: DriverExpenseFormKind;
  otherCategory: TripOtherExpenseCategory;
  onOtherCategoryChange: (category: TripOtherExpenseCategory) => void;
  /** In-page category switch (driver unified expense flow). */
  onCategoryNavChange?: (next: DriverExpenseCategoryNav) => void;
  lockCategorySwitch?: boolean;
};

export function DriverExpenseCategorySwitch({
  tripId,
  formKind,
  otherCategory,
  onOtherCategoryChange,
  onCategoryNavChange,
  lockCategorySwitch = false,
}: Props) {
  const router = useRouter();
  const activeValue = activeDriverExpenseCategoryValue(formKind, otherCategory);

  const handleChange = useCallback(
    (value: string) => {
      if (lockCategorySwitch) return;

      if (onCategoryNavChange) {
        if (value === "fuel" || value === "toll") {
          if (value !== formKind) onCategoryNavChange(value);
          return;
        }
        onCategoryNavChange(value as TripOtherExpenseCategory);
        onOtherCategoryChange(value as TripOtherExpenseCategory);
        return;
      }

      if (value === "fuel" || value === "toll") {
        navigateDriverExpenseCategory(router, tripId, value, formKind);
        return;
      }
      if (formKind !== "other") {
        navigateDriverExpenseCategory(
          router,
          tripId,
          value as TripOtherExpenseCategory,
          formKind,
        );
        return;
      }
      onOtherCategoryChange(value as TripOtherExpenseCategory);
    },
    [
      formKind,
      lockCategorySwitch,
      onCategoryNavChange,
      onOtherCategoryChange,
      router,
      tripId,
    ],
  );

  return (
    <DriverExpenseChipSelect
      label="Category"
      options={DRIVER_EXPENSE_CATEGORY_OPTIONS}
      value={activeValue}
      onChange={handleChange}
      columns={3}
      visualGroup="driver_expense_category"
      collapseAfterSelect
      disabled={lockCategorySwitch}
    />
  );
}
