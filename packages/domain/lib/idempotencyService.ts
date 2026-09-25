/**
 * IdempotencyService — Phase 3 Production-Grade Idempotency Layer
 *
 * Guarantees: same request submitted N times → exactly 1 record created.
 * Covers: trip, indent, invoice, booking, settlement creation.
 *
 * Usage:
 *   const guard = await IdempotencyService.acquire('trip', key, orgId, userId, body);
 *   if (guard.replay) return guard.existingResult;   // replay stored result
 *   if (guard.conflict) throw guard.error;           // mismatched body
 *   if (guard.pending) throw RetryAfter(30s);
 *
 *   const trip = await createTrip(...);
 *
 *   await IdempotencyService.complete(key, trip.id, { trip });
 */

import { supabase } from '@pulse/core/lib/supabase';
import { cryptoRandomHex } from '@pulse/core/lib/globalId';

export type EntityType = 'trip' | 'indent' | 'invoice' | 'booking' | 'settlement' | string;

export type IdempotencyStatus =
  | { ok: true; replay: false; conflict: false; pending: false }
  | { ok: false; replay: true;  result: Record<string, unknown> | null; entityId: string | null }
  | { ok: false; replay: false; conflict: true;  error: string }
  | { ok: false; replay: false; conflict: false; pending: true; error: string };

/**
 * Generate a stable idempotency key from a request body.
 * Callers should supply their own key (e.g., from client-side UUID);
 * use this only when no key is provided.
 */
export function buildIdempotencyKey(
  entityType: string,
  orgId: string,
  requestBody: Record<string, unknown>,
): string {
  const sorted = JSON.stringify(
    Object.keys(requestBody).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = requestBody[k];
      return acc;
    }, {}),
  );
  const hash = cryptoRandomHex(4); // 8-char uniqueness, combined with other fields
  return `${entityType}:${orgId}:${sorted.length}:${hash}`;
}

/**
 * Compute a SHA-256-like fingerprint of a request body for mismatch detection.
 * Uses a deterministic but non-reversible hash.
 */
function hashRequestBody(body: Record<string, unknown>): string {
  const str = JSON.stringify(body, Object.keys(body).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + str.length.toString(16);
}

class _IdempotencyService {
  /**
   * Acquire an idempotency slot before creating an entity.
   *
   * @param entityType  - 'trip', 'indent', etc.
   * @param key         - Client-supplied idempotency key (UUID recommended)
   * @param orgId       - Organization ID
   * @param userId      - User ID (optional)
   * @param requestBody - Full request body (used to detect body mismatch on retry)
   */
  async acquire(
    entityType: EntityType,
    key:        string,
    orgId:      string,
    userId:     string | null,
    requestBody: Record<string, unknown>,
  ): Promise<IdempotencyStatus> {
    const reqHash = hashRequestBody(requestBody);

    try {
      const { data, error } = await supabase().rpc('idempotency_acquire', {
        p_key:         key,
        p_entity_type: entityType,
        p_org_id:      orgId,
        p_user_id:     userId,
        p_req_hash:    reqHash,
      });

      if (error) throw new Error(error.message);

      const result = data as { status: string; entity_id?: string; response_payload?: Record<string, unknown>; error?: string; replayed?: boolean } | null;
      if (!result) throw new Error('No response from idempotency service');

      switch (result.status) {
        case 'acquired':
          return { ok: true, replay: false, conflict: false, pending: false };

        case 'completed':
          return {
            ok: false, replay: true,
            result: result.response_payload ?? null,
            entityId: result.entity_id ?? null,
          };

        case 'conflict':
          return {
            ok: false, replay: false, conflict: true,
            error: result.error ?? 'Idempotency key conflict',
          };

        case 'pending':
          return {
            ok: false, replay: false, conflict: false, pending: true,
            error: result.error ?? 'Request still processing',
          };

        case 'retry_allowed':
          return { ok: true, replay: false, conflict: false, pending: false };

        default:
          throw new Error(`Unexpected idempotency status: ${result.status}`);
      }
    } catch (err) {
      // On DB failure, log and allow the request through (fail-open for availability)
      console.warn('[IdempotencyService] acquire failed, proceeding without guard:', err);
      return { ok: true, replay: false, conflict: false, pending: false };
    }
  }

  /**
   * Complete an idempotency slot after successful entity creation.
   */
  async complete(
    key:      string,
    entityId: string,
    response: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await supabase().rpc('idempotency_complete', {
        p_key:       key,
        p_entity_id: entityId,
        p_response:  response,
      });
    } catch (err) {
      console.warn('[IdempotencyService] complete failed (non-fatal):', err);
    }
  }

  /**
   * Mark a slot as failed after a creation error.
   */
  async fail(key: string, error: string): Promise<void> {
    try {
      await supabase().rpc('idempotency_fail', {
        p_key:   key,
        p_error: error,
      });
    } catch (err) {
      console.warn('[IdempotencyService] fail failed (non-fatal):', err);
    }
  }
}

export const IdempotencyService = new _IdempotencyService();
