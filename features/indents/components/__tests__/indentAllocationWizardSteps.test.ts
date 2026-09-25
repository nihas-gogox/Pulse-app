import {
  getIndentAllocationWizardSteps,
  isIndentAllocationStepComplete,
} from "../indentAllocationWizardSteps";

const completeBase = {
  assignDriverId: null as string | null,
  assignVehicleId: undefined as string | null | undefined,
  subcontractSupplierId: null as string | null,
  subcontractRate: "",
  aggregateDriverTrackingName: "",
  aggregateDriverPhone: "",
  assignVehicleRegistration: "",
  tripDetailsReady: false,
  aggregatePhoneInTrip: false,
  aggregatePhoneLookupLoading: false,
  aggregatePhoneMatches: [] as { user_id: string }[],
  aggregatePhoneSelectedUserId: null as string | null,
  staffHandshakeAssignLater: false,
};

describe("getIndentAllocationWizardSteps", () => {
  it("starts with source then grouped fleet for asset", () => {
    expect(
      getIndentAllocationWizardSteps({ aggregate: false, assignLater: false }).map(
        (s) => s.id,
      ),
    ).toEqual(["source", "fleet", "commodity"]);
  });

  it("keeps grouped fleet when assign later is on so the switch stays on that step", () => {
    expect(
      getIndentAllocationWizardSteps({ aggregate: false, assignLater: true }).map(
        (s) => s.id,
      ),
    ).toEqual(["source", "fleet", "commodity"]);
  });

  it("mirrors trip aggregate allocation after source", () => {
    expect(
      getIndentAllocationWizardSteps({ aggregate: true, assignLater: false }).map(
        (s) => s.id,
      ),
    ).toEqual([
      "source",
      "partner",
      "rates",
      "driverPhone",
      "driverName",
      "vehicleReg",
      "commodity",
    ]);
  });
});

describe("isIndentAllocationStepComplete", () => {
  it("requires both fleet picks unless assign later", () => {
    expect(isIndentAllocationStepComplete("fleet", completeBase)).toBe(false);
    expect(
      isIndentAllocationStepComplete("fleet", {
        ...completeBase,
        assignDriverId: "d1",
        assignVehicleId: "v1",
      }),
    ).toBe(true);
    expect(
      isIndentAllocationStepComplete("fleet", {
        ...completeBase,
        staffHandshakeAssignLater: true,
      }),
    ).toBe(true);
  });
});
