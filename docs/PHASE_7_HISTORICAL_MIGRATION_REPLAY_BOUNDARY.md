# Phase 7 — Historical Migration Replay Boundary: CLOSED

**Last proven replayable migration:** `20260903062910_kyc_admin_session_access.sql`

**Held and preserved:** `20260903061452`, `20260903070151`, and all `>= 20260903072324`.

**No further historical repair is required or authorized within this workstream.**

This record freezes the from-scratch local replay outcome for the backdated September 3 Admin Console cluster. The objective was a defensible, reproducible boundary — not forcing every historical filename to apply.

---

## Proven replay sequence

A clean from-scratch **local** Supabase replay is proven through:

```text
20260903040000
→ 20260903053951
→ 20260903054729
→ 20260903055231
→ 20260903062910
```

| Version | File |
| --- | --- |
| `20260903040000` | `september_admin_console_prerequisite.sql` |
| `20260903053951` | `support_admin_session_auth.sql` |
| `20260903054729` | `support_admin_queue_pagination.sql` |
| `20260903055231` | `support_attention_count.sql` |
| `20260903062910` | `kyc_admin_session_access.sql` |

Prerequisite `20260903040000` only stages objects required for 53951 / 54729 / 55231 / 62910 (tables/columns with `IF NOT EXISTS`). It does not create SECURITY DEFINER stubs or copy later function bodies.

---

## Held (historically inconsistent at filename position)

These files remain in the repository **unmodified**. They are not replayed at their timestamps. Local re-proof uses an ephemeral `/tmp` move + EXIT restore — not a committed reorder and not `migration repair`.

| File | Status | Established reason |
| --- | --- | --- |
| `20260903061452_admin_rpc_anon_lockdown.sql` | Held | GRANT/REVOKE-only; targets including `increment_credit_wallet` do not exist yet. `62910` does not depend on it. |
| `20260903070151_credits_rpc_type_guard.sql` | Held | Mixed CREATE/REPLACE + DO-block rewrite of four later DEFINER functions. Not the canonical credits creator (`20261224010000`). Cannot execute at this date without later-created functions. |
| `20260903072324_admindata_admin_access.sql` | Held | RLS plus GRANT cluster. Four GRANT targets are created later. Some grants would **widen** helpers whose later canonical creators lock them down. |
| `20260903073017_boost_analytics_guard_hardening.sql` | Held | Covered by `>= 20260903072324` only; not separately repaired. |
| `20260903073406_verification_rpc_anon_lockdown.sql` | Held | Same rule; GRANT-only on later verification RPCs. |

Neither 70151 nor 72324 should be released or synthetically repaired.

Canonical later implementations remain the source of truth (credits, Reach/KYC RPCs, network notifications, identity code, trip-chat core, mover-asset helper).

---

## Re-proving the boundary (local only)

1. Confirm local stack (`127.0.0.1:54322`), not cloud/pre-prod.
2. Hold 61452, 70151, and all files `>= 20260903072324` via the ephemeral `/tmp` mechanism; restore on EXIT.
3. Clean local start/replay from empty.
4. Expect last applied September 3 file: **`20260903062910`**.

Do not `supabase db push`, do not `migration repair`, do not rename migration files to force order.

---

## Final status

| Item | Status |
| --- | --- |
| Historical dependency investigation | Complete |
| Genuine historical defects repaired | Complete |
| Clean local replay boundary | Proven |
| Last proven migration | **`20260903062910`** |
| 61452 | Held |
| 70151 | Held |
| 72324 / 73017 / 73406 | Held |
| Migration files modified further after closure | No |
| Synthetic stubs/back-copies | None |
| Cloud/pre-prod changes | None |
| Further forensic investigation | Stop |
| Phase 7 | **CLOSED** |

The important outcome is that historical migrations were **not** forced to pass by manufacturing dependencies. The later canonical implementations stay the source of truth.

---

## Mutation check (Phase 7X documentation/closure)

- replay / db reset / db push / migration repair during Phase 7X: **NO**
- (Phase 7V did run a clean **local** replay; that is outside this closure phase.)
- migration SQL edited during Phase 7X: **NO**
- application code edited during Phase 7X: **NO**
- cloud/pre-prod touched: **NO**
- stubs/functions created: **NO**
- holds released: **NO**
