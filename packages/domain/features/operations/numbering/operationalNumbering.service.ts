import {
  generateOperationalCode,
  type OperationalEntityType,
} from "./generateOperationalCode";

export async function reserveOperationalNumber(input: {
  organizationId: string;
  entityType: OperationalEntityType;
}): Promise<{ error: Error | null; code: string | null; sequence: number | null }> {
  const codeRes = await generateOperationalCode({
    organizationId: input.organizationId,
    entityType: input.entityType,
  });
  if (codeRes.error) return { error: codeRes.error, code: null, sequence: null };
  const suffix = String(codeRes.code ?? "").slice(-6);
  const parsedSeq = Number(suffix);
  return {
    error: null,
    code: codeRes.code,
    sequence: Number.isFinite(parsedSeq) ? parsedSeq : null,
  };
}
