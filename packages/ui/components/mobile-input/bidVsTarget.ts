/**
 * Live bid amount vs shipper target — shared by story BidSheet,
 * FullscreenNumericEntry (Get Load / driver direct), and confirm modals.
 */
import { formatINR } from "@pulse/core/lib/format";

export type BidVsTargetTone = "over" | "under" | "match";

export type BidVsTargetDelta = {
  tone: BidVsTargetTone;
  /** Tiny caption under the amount, e.g. "+₹ 1,200 vs target". */
  caption: string;
};

/**
 * Compare typed bid amount to target rate.
 * Returns null when either side is missing / not positive.
 */
export function resolveBidVsTarget(
  amount: number,
  target: number | null | undefined,
): BidVsTargetDelta | null {
  if (target == null || !(target > 0)) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const diff = amount - target;
  if (Math.abs(diff) < 0.5) {
    return { tone: "match", caption: "At target" };
  }
  if (diff > 0) {
    return {
      tone: "over",
      caption: `+${formatINR(diff)} vs target`,
    };
  }
  return {
    tone: "under",
    caption: `−${formatINR(Math.abs(diff))} vs target`,
  };
}
