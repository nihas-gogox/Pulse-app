export type LocalAuthSubject = {
  subjectId: string;
};

export type LocalAuthVerifyResult =
  | { ok: true; subject: LocalAuthSubject }
  | { ok: false; reason: "unauthenticated" };

/**
 * Local V2 Auth boundary. Not Supabase Auth. Not JWT/OAuth.
 * Enrolled opaque proofs map to Auth Subject ids; proofs are not Actor ids.
 */
export type LocalAuthAdapter = {
  verify: (proof: string) => LocalAuthVerifyResult;
  enroll: (proof: string, subjectId: string) => void;
};

export function createLocalAuthAdapter(input?: {
  enrolled?: Array<{ proof: string; subjectId: string }>;
}): LocalAuthAdapter {
  const enrolled = new Map<string, string>();
  for (const row of input?.enrolled ?? []) {
    enrolled.set(row.proof.trim(), row.subjectId.trim());
  }

  return {
    verify(proof: string): LocalAuthVerifyResult {
      const value = proof.trim();
      if (!value) return { ok: false, reason: "unauthenticated" };
      const subjectId = enrolled.get(value);
      if (!subjectId) return { ok: false, reason: "unauthenticated" };
      return { ok: true, subject: { subjectId } };
    },
    enroll(proof: string, subjectId: string): void {
      const proofValue = proof.trim();
      const subject = subjectId.trim();
      if (!proofValue || !subject) return;
      enrolled.set(proofValue, subject);
    },
  };
}
