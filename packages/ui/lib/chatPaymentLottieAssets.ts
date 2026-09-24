import type { LottieSource } from "@/lib/lottieSource";

/** Lottie glyphs for payment / ledger system cards in chat. */
export const CHAT_PAYMENT_LOTTIE = {
  incoming: require("@/assets/Animated folder/revenue.json"),
  outgoing: require("@/assets/Animated folder/payment.json"),
  bank: require("@/assets/Animated folder/payment-gateway.json"),
  digital: require("@/assets/Animated folder/online-payments.json"),
  cashIn: require("@/assets/Animated folder/investment-growth.json"),
  cashOut: require("@/assets/Animated folder/withdraw-cash.json"),
  synced: require("@/assets/Animated folder/check-mark.json"),
  dispute: require("@/assets/Animated folder/compare-scale.json"),
} as const;

export function resolveChatPaymentLottieSource(
  flow: "in" | "out",
  paymentMode: string,
  isAcknowledged: boolean,
  isDisputed: boolean,
): LottieSource {
  if (isDisputed) return CHAT_PAYMENT_LOTTIE.dispute;
  if (isAcknowledged) return CHAT_PAYMENT_LOTTIE.synced;
  const mode = paymentMode.toLowerCase();
  if (mode.includes("bank") || mode.includes("neft") || mode.includes("rtgs")) {
    return CHAT_PAYMENT_LOTTIE.bank;
  }
  if (
    mode.includes("upi") ||
    mode.includes("digital") ||
    mode.includes("card") ||
    mode.includes("wallet")
  ) {
    return CHAT_PAYMENT_LOTTIE.digital;
  }
  if (mode.includes("cash")) {
    return flow === "in" ? CHAT_PAYMENT_LOTTIE.cashIn : CHAT_PAYMENT_LOTTIE.cashOut;
  }
  return flow === "in" ? CHAT_PAYMENT_LOTTIE.incoming : CHAT_PAYMENT_LOTTIE.outgoing;
}
