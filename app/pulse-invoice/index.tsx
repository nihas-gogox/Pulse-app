import { InvoicingExecuteScreen } from "@/features/invoicing/InvoicingExecuteScreen";
import { ROUTES } from "@/lib/routes";
import { shouldMountAuthenticatedDataPlane } from "@/lib/bootGate";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "expo-router";

/** Pulse Invoice home — Pending Billing (landing CTA removed). */
export default function PulseInvoiceRoute() {
  const { sessionAttached } = useAuth();
  if (!shouldMountAuthenticatedDataPlane(sessionAttached)) {
    return <Redirect href={ROUTES.SIGN_IN_DIRECT} />;
  }
  return <InvoicingExecuteScreen />;
}
