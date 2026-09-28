/**
 * Invoice header logo resolution — frontend display only.
 * Prefer workspace/branding HTTP logo; for Gogovan/Gogox issuers without a
 * remote logo, use the bundled mark so the tax-invoice header is not blank.
 */
import { Image } from "react-native";

const BUNDLED_GOGOX_MARK = require("@/assets/invoicing/gogox-invoice-mark.png");

export function isGogoxFamilyIssuerName(name: string | null | undefined): boolean {
  const n = (name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!n) return false;
  return (
    n.includes("gogovan") ||
    n.includes("gogo van") ||
    /(^|[^a-z])gogox([^a-z]|$)/.test(n)
  );
}

function bundledMarkUri(): string | null {
  try {
    const resolved = Image.resolveAssetSource(BUNDLED_GOGOX_MARK as number);
    const uri = resolved?.uri?.trim();
    if (uri) return uri;
  } catch {
    // fall through
  }
  if (typeof BUNDLED_GOGOX_MARK === "string") return BUNDLED_GOGOX_MARK;
  return null;
}

export type InvoiceHeaderLogo =
  | { kind: "remote"; src: string; includesMsmeCaption: false }
  | { kind: "bundled"; src: string; includesMsmeCaption: true }
  | { kind: "gogox_wordmark"; includesMsmeCaption: false };

/**
 * Resolve the left-header logo for the tax invoice PDF preview.
 */
export function resolveInvoiceHeaderLogo(args: {
  brandingLogoUrl: string | null | undefined;
  companyName: string | null | undefined;
  remoteFailed?: boolean;
}): InvoiceHeaderLogo | null {
  const remote = (args.brandingLogoUrl ?? "").trim();
  if (remote && /^https?:\/\//i.test(remote) && !args.remoteFailed) {
    return { kind: "remote", src: remote, includesMsmeCaption: false };
  }

  if (!isGogoxFamilyIssuerName(args.companyName)) return null;

  const bundled = bundledMarkUri();
  if (bundled) {
    return { kind: "bundled", src: bundled, includesMsmeCaption: true };
  }

  // SVG wordmark fallback when asset URI cannot be resolved (tests / odd bundlers).
  return { kind: "gogox_wordmark", includesMsmeCaption: false };
}
