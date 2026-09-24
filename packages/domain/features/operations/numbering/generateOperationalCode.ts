import { supabase } from "@pulse/core/lib/supabase";

export type OperationalEntityType =
  | "trip"
  | "indent"
  | "vehicle"
  | "driver"
  | "invoice"
  | "pod"
  | "maintenance";

export async function generateOperationalCode(input: {
  organizationId: string;
  entityType: OperationalEntityType;
}): Promise<{ error: Error | null; code: string | null }> {
  const { data, error } = await supabase().rpc("generate_enterprise_operational_code", {
    p_org_id: input.organizationId,
    p_entity_type: input.entityType,
  });
  if (error) return { error: new Error(error.message), code: null };
  const code = String(data ?? "").trim();
  if (!code) return { error: new Error("Operational code not generated"), code: null };
  return { error: null, code };
}
