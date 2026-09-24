/**
 * A8.7 — Razorpay Standard Checkout, loaded inside the existing
 * NativeHtmlWebView (react-native-webview under the hood) rather than a
 * native Razorpay SDK — no new native module, works in the current dev
 * client build.
 *
 * IMPORTANT: this component's own success/dismissal signal is advisory
 * only, used purely to know when to close the sheet and trigger a refetch.
 * It is NEVER treated as proof of payment — only a server-confirmed
 * market_bids.fee_payment_status (flipped by the razorpay-webhook edge
 * function, via confirm_marketplace_fee_payment()) is authoritative. See
 * A8.6.2/A8.7's access-gate design.
 */
import { NativeHtmlWebView } from "@pulse/ui/components/NativeHtmlWebView";
import Theme from "@pulse/core/constants/Theme";
import { useCallback, useMemo } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

export type RazorpayCheckoutResult = { status: "success" | "dismissed" | "error" };

export interface RazorpayCheckoutSheetProps {
  visible: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  description?: string;
  onClose: (result: RazorpayCheckoutResult) => void;
}

function buildCheckoutHtml(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
}): string {
  // Razorpay's checkout.js posts messages back to the WebView host via
  // window.ReactNativeWebView.postMessage -- no callback_url/server
  // round-trip needed for a hybrid app. Amount here is display-only
  // (Razorpay reads the authoritative amount from the order_id itself);
  // it is never re-submitted anywhere.
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>html,body{margin:0;padding:0;background:#ffffff;height:100%;}</style>
</head>
<body>
<script>
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  try {
    var rzp = new Razorpay({
      key: ${JSON.stringify(opts.keyId)},
      order_id: ${JSON.stringify(opts.orderId)},
      amount: ${Math.round(opts.amount * 100)},
      currency: ${JSON.stringify(opts.currency)},
      name: "Pulse Marketplace",
      description: ${JSON.stringify(opts.description)},
      handler: function (response) {
        post({ status: "success", paymentId: response.razorpay_payment_id });
      },
      modal: {
        ondismiss: function () {
          post({ status: "dismissed" });
        },
      },
    });
    rzp.on("payment.failed", function () {
      post({ status: "error" });
    });
    rzp.open();
  } catch (e) {
    post({ status: "error", message: String(e) });
  }
</script>
</body>
</html>`;
}

export function RazorpayCheckoutSheet({
  visible,
  orderId,
  amount,
  currency,
  keyId,
  description = "Marketplace platform fee",
  onClose,
}: RazorpayCheckoutSheetProps) {
  const html = useMemo(
    () => buildCheckoutHtml({ keyId, orderId, amount, currency, description }),
    [keyId, orderId, amount, currency, description],
  );

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const parsed = JSON.parse(event.nativeEvent.data) as { status?: string };
        if (parsed.status === "success") onClose({ status: "success" });
        else if (parsed.status === "dismissed") onClose({ status: "dismissed" });
        else onClose({ status: "error" });
      } catch {
        onClose({ status: "error" });
      }
    },
    [onClose],
  );

  if (Platform.OS === "web") {
    // Web checkout isn't in scope for A8.7 (mobile driver/business apps
    // only) -- surface this plainly rather than silently doing nothing.
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onClose({ status: "dismissed" })}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Pay Marketplace fee</Text>
          <Pressable onPress={() => onClose({ status: "dismissed" })} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        <NativeHtmlWebView html={html} style={styles.webview} onMessage={handleMessage} startInLoadingState />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.cardWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  headerText: { fontSize: 15, fontWeight: "700", color: Theme.gpayListTitle },
  closeText: { fontSize: 13, fontWeight: "700", color: Theme.textSecondary },
  webview: { flex: 1 },
});
