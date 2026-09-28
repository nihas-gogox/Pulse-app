import type {
  ClientContractAgreement,
  CommercialModel,
  ContractAgreementStatus,
} from '@/features/clients/types/clientManagement.types';
import { supabase } from '@/lib/supabase';

export type CreateContractAgreementData = {
  contract_number: string;
  title?: string | null;
  status?: ContractAgreementStatus;
  commercial_model?: CommercialModel;
  effective_date?: string | null;
  expiry_date?: string | null;
  renewal_date?: string | null;
  payment_terms?: Record<string, unknown>;
  detention_terms?: Record<string, unknown>;
  penalty_clauses?: Record<string, unknown>;
  claims_terms?: Record<string, unknown>;
  escalation_matrix?: unknown[];
  general_terms?: string | null;
  notes?: string | null;
};

export async function getClientContractAgreements(
  orgId: string,
  clientId: string,
): Promise<{ error: Error | null; agreements: ClientContractAgreement[] }> {
  const { data, error } = await supabase()
    .from('client_contract_agreements')
    .select('*')
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('effective_date', { ascending: false, nullsFirst: false });
  if (error) return { error: new Error(error.message), agreements: [] };
  return { error: null, agreements: (data ?? []) as ClientContractAgreement[] };
}

export async function createClientContractAgreement(
  orgId: string,
  clientId: string,
  payload: CreateContractAgreementData,
): Promise<{ error: Error | null; agreement: ClientContractAgreement | null }> {
  const { data, error } = await supabase()
    .from('client_contract_agreements')
    .insert({ organization_id: orgId, client_id: clientId, ...payload })
    .select()
    .single();
  if (error) return { error: new Error(error.message), agreement: null };
  return { error: null, agreement: data as ClientContractAgreement };
}

export type UpdateContractAgreementData = Partial<CreateContractAgreementData> & {
  signed_storage_path?: string | null;
};

export async function updateClientContractAgreement(
  agreementId: string,
  payload: UpdateContractAgreementData,
): Promise<{ error: Error | null }> {
  const { error } = await supabase()
    .from('client_contract_agreements')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', agreementId);
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

const AGREEMENT_BUCKET = 'compliance-documents';

function fileExt(fileName: string): string {
  const part = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (part && /^[a-z0-9]{1,8}$/.test(part)) return part;
  return 'pdf';
}

/** Stores the signed agreement and records a version row. */
export async function uploadClientAgreementFile(input: {
  orgId: string;
  clientId: string;
  agreementId: string;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<{ error: Error | null; storagePath: string | null }> {
  const path = `${input.orgId}/client/${input.clientId}/agreement_${Date.now()}.${fileExt(input.fileName)}`;
  const { error: uploadError } = await supabase()
    .storage.from(AGREEMENT_BUCKET)
    .upload(path, input.bytes, { contentType: input.mimeType, upsert: false });
  if (uploadError) return { error: new Error(uploadError.message), storagePath: null };

  const { error: pathError } = await updateClientContractAgreement(input.agreementId, {
    signed_storage_path: path,
  });
  if (pathError) return { error: pathError, storagePath: null };

  const { data: latest } = await supabase()
    .from('client_contract_versions')
    .select('version_number')
    .eq('agreement_id', input.agreementId)
    .order('version_number', { ascending: false })
    .limit(1);
  const nextVersion = (latest?.[0]?.version_number ?? 0) + 1;
  const { error: versionError } = await supabase().from('client_contract_versions').insert({
    organization_id: input.orgId,
    agreement_id: input.agreementId,
    version_number: nextVersion,
    storage_path: path,
    file_name: input.fileName,
  });
  if (versionError) return { error: new Error(versionError.message), storagePath: path };
  return { error: null, storagePath: path };
}

export async function openClientAgreementFile(storagePath: string): Promise<{ error: Error | null; url: string | null }> {
  const { data, error } = await supabase()
    .storage.from(AGREEMENT_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return { error: new Error(error.message), url: null };
  return { error: null, url: data.signedUrl };
}
