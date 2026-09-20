import { formatMarkComplianceVerifiedError } from "@/features/tripCompliance/utils/complianceMarkVerifiedError.util";

describe("formatMarkComplianceVerifiedError", () => {
  it("explains the insurance/rc trip-document RPC gate", () => {
    const message = formatMarkComplianceVerifiedError(
      "required documents not yet verified: insurance, rc",
    );
    expect(message).toContain("insurance, rc");
    expect(message).toContain("LR, E-way Bill, and Invoice");
    expect(message).toContain("server still also requires Insurance and RC");
  });

  it("passes through unrelated errors", () => {
    expect(formatMarkComplianceVerifiedError("not authorized")).toBe("not authorized");
  });
});
