/**
 * Non-blocking notice shown at the existing Loading → In Transit seam
 * (DriverPodCompletionPage, variant='lr') when Compliance is enabled and
 * still pending. Reads only data the trip object already carries — no new
 * required network call, and this component renders nothing (not even a
 * loading state) until the already-cached workspace-products query resolves,
 * so it can never delay or block the existing "Start transit" action.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useWorkspaceProductsQuery } from "@pulse/domain/lib/queries/useWorkspaceProductsQuery";

type Props = {
  complianceVerifiedAt?: string | null;
};

export function LoadingComplianceNotice({ complianceVerifiedAt }: Props) {
  const { data: products } = useWorkspaceProductsQuery();
  const complianceEnabled = (products ?? []).some(
    (p) => p.product_id === "pulse_compliance" && (p.status === "active" || p.status === "trial"),
  );

  if (!complianceEnabled || complianceVerifiedAt) return null;

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.title}>Compliance pending</Text>
      <Text style={styles.body}>Trip documents are awaiting compliance verification.</Text>
      <Text style={styles.body}>This will not prevent the trip from moving to In Transit.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff7e6",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  title: { fontSize: 12, fontWeight: "700", color: "#92600a", marginBottom: 2 },
  body: { fontSize: 11, color: "#92600a", lineHeight: 15 },
});
