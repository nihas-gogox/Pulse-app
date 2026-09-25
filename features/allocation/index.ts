/**
 * Allocation / assignment UI — single import surface for trip, indent, and reassign flows.
 * Trip screens remain the reference; indent deploy and reassign consume the same shell.
 */
export { AssignmentFlowShell, AssignmentFlowWizardFooter } from "@/features/trips/components/assignment/AssignmentFlowShell";
export { AssignmentFlowFooter } from "@/features/trips/components/assignment/assignmentFlowFooter";
export { SupplyAllocationModeBar } from "@/features/trips/components/SupplyAllocationModeBar";
export { AddTripWizardProgress } from "@/features/trips/components/add-trip/AddTripWizardProgress";
export {
  assignmentShellColors,
  assignmentShellStyles,
} from "@/features/trips/styles/assignmentShellShared";
export {
  getAllocationSubSteps,
  allocationSubStepFields,
  allocationSubStepLabel,
  type AllocationSubStep,
} from "@/features/trips/components/add-trip/allocationWizardSteps";
export {
  TRIP_PHONE_WIZARD_STEPS,
  tripPhoneWizardSubtitle,
  isTripPhoneWizardStepComplete,
  type TripPhoneWizardStep,
} from "@/features/trips/components/allocation/tripPhoneAssignmentWizardSteps";
export {
  getIndentAllocationWizardSteps,
  indentAllocationStepSubtitle,
  indentAllocationStepBlockReason,
  isIndentAllocationStepComplete,
  type IndentAllocationStepId,
  type IndentWizardStep,
} from "@/features/indents/components/indentAllocationWizardSteps";
