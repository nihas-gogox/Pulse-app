import { serializeElrDocumentNumber, type ElrSnapshot } from "@/features/trips/services/elrSnapshot.util";
import { serializeLrFieldValues } from "@/features/trips/services/lrDocumentOcr.util";
import {
  lrNumberFromStoredDocumentNumber,
  normalizeOrgLrNumber,
  ORG_LR_DUPLICATE_MESSAGE,
} from "@/features/trips/services/orgLrNumber.util";

const snapshot = {
  tripId: "t1",
  lrNumber: "ELR-TRP027",
  generatedAt: "2026-09-29T00:00:00.000Z",
  consignor: { name: "A" },
  transporter: { name: "B" },
  vehicle: { registrationNumber: "TN 01" },
  route: { origin: "Mumbai", destination: "Delhi" },
  trip: { tripId: "t1", tripNumber: "TRP027", tripDate: "2026-09-29" },
} as ElrSnapshot;

describe("org LR number identity", () => {
  it("treats spacing and case as the same number", () => {
    expect(normalizeOrgLrNumber(" elr-trp027 ")).toBe("ELR-TRP027");
    expect(normalizeOrgLrNumber("ELR  TRP027")).toBe("ELR TRP027");
  });

  it("reads vault JSON, E-LR JSON, and plain numbers", () => {
    expect(lrNumberFromStoredDocumentNumber("ELR-TRP027")).toBe("ELR-TRP027");
    expect(
      lrNumberFromStoredDocumentNumber(
        serializeLrFieldValues({
          lrNumber: "elr-trp027",
          date: "29/09/2026",
          invoice: "INV-1",
        }),
      ),
    ).toBe("ELR-TRP027");
    expect(
      lrNumberFromStoredDocumentNumber(serializeElrDocumentNumber(snapshot)),
    ).toBe("ELR-TRP027");
  });

  it("uses workspace-scoped duplicate copy, not a Pulse-global message", () => {
    expect(ORG_LR_DUPLICATE_MESSAGE).toMatch(/workspace/i);
    expect(ORG_LR_DUPLICATE_MESSAGE).not.toMatch(/globally/i);
  });
});
