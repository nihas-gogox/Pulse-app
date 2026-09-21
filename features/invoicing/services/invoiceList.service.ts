/**
 * Read-only list of issued invoices (public.invoices).
 * Does not allocate numbers, compute GST, or write AR.
 */
import { supabase } from "@/lib/supabase";

export type IssuedInvoiceListRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  client_id: string | null;
  client_name: string | null;
  total_amount: number;
  status: string;
  trip_ids: string[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function fetchIssuedInvoicesForOrg(
  orgId: string,
): Promise<{ error: Error | null; invoices: IssuedInvoiceListRow[] }> {
  try {
    const { data, error } = await supabase()
      .from("invoices")
      .select(
        "id, invoice_number, invoice_date, due_date, client_id, client_name, total_amount, status, trip_ids",
      )
      .eq("org_id", orgId)
      .order("invoice_date", { ascending: false });

    if (error) throw error;

    const invoices: IssuedInvoiceListRow[] = (data ?? []).map((row) => {
      const tripIds = Array.isArray(
        (row as { trip_ids?: unknown }).trip_ids,
      )
        ? ((row as { trip_ids: unknown[] }).trip_ids.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ))
        : [];
      const totalRaw = (row as { total_amount?: unknown }).total_amount;
      const total =
        typeof totalRaw === "number" && Number.isFinite(totalRaw)
          ? totalRaw
          : Number(totalRaw) || 0;
      return {
        id: str((row as { id?: unknown }).id),
        invoice_number: str((row as { invoice_number?: unknown }).invoice_number),
        invoice_date: str((row as { invoice_date?: unknown }).invoice_date),
        due_date: str((row as { due_date?: unknown }).due_date) || null,
        client_id: str((row as { client_id?: unknown }).client_id) || null,
        client_name: str((row as { client_name?: unknown }).client_name) || null,
        total_amount: total,
        status: str((row as { status?: unknown }).status) || "sent",
        trip_ids: tripIds,
      };
    });

    return { error: null, invoices };
  } catch (e) {
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      invoices: [],
    };
  }
}
