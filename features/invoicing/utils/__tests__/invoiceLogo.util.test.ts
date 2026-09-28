import {
  isGogoxFamilyIssuerName,
  resolveInvoiceHeaderLogo,
} from "../invoiceLogo.util";

jest.mock("react-native", () => ({
  Image: {
    resolveAssetSource: () => ({ uri: "file:///bundled-gogox-mark.png" }),
  },
}));

describe("invoiceLogo.util", () => {
  it("detects Gogovan / Gogox issuer names", () => {
    expect(isGogoxFamilyIssuerName("GOGOVAN INDIA PVT LTD")).toBe(true);
    expect(isGogoxFamilyIssuerName("GOGOX")).toBe(true);
    expect(isGogoxFamilyIssuerName("Berger India")).toBe(false);
  });

  it("prefers remote branding logo when present", () => {
    expect(
      resolveInvoiceHeaderLogo({
        brandingLogoUrl: "https://cdn.example/logo.png",
        companyName: "GOGOVAN INDIA PVT LTD",
      }),
    ).toEqual({
      kind: "remote",
      src: "https://cdn.example/logo.png",
      includesMsmeCaption: false,
    });
  });

  it("falls back to bundled mark for Gogovan when remote logo missing", () => {
    expect(
      resolveInvoiceHeaderLogo({
        brandingLogoUrl: null,
        companyName: "GOGOVAN INDIA PVT LTD",
      }),
    ).toEqual({
      kind: "bundled",
      src: "file:///bundled-gogox-mark.png",
      includesMsmeCaption: true,
    });
  });

  it("does not invent a logo for unrelated issuers", () => {
    expect(
      resolveInvoiceHeaderLogo({
        brandingLogoUrl: null,
        companyName: "Acme Logistics",
      }),
    ).toBeNull();
  });
});
