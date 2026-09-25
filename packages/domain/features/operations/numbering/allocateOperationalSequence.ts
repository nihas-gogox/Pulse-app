import { supabase } from "@pulse/core/lib/supabase";

export async function allocateOperationalSequence(input: {
  organizationId: string;
  entityType: "trip" | "indent" | "vehicle" | "driver" | "invoice" | "pod" | "maintenance";
}): Promise<{ error: Error | null; sequence: number | null }> {
  const { data, error } = await supabase().rpc("allocate_operational_sequence", {
    p_org_id: input.organizationId,
    p_entity_type: input.entityType,
  });
  if (error) return { error: new Error(error.message), sequence: null };
  const n = Number(data);
  if (!Number.isFinite(n) || n <= 0) {
    return { error: new Error("Invalid operational sequence response"), sequence: null };
  }
  return { error: null, sequence: Math.floor(n) };
}
