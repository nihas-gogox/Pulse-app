# ADR-013 — Pulse V2 Identity plane (Gate A)

**Status:** Accepted (Architecture) — 2026-09-20  
**Parent:** Gate A conflict resolution for Pulse V2 Identity  
**Does not authorize:** V2 Auth provisioning, membership tables, RLS changes, federation, Slice 4, Gate B answers, infrastructure

This ADR records **C1-B** and **C2-B**. It is a **clarification and extension**. It does **not** repeal production Identity rules.

---

## Decision

1. Production has one Auth authority.
2. The production “one Auth / one project / one `auth.users`” rule remains intact.
3. An isolated V2 data plane may have separate V2 Auth.
4. Whether customers ultimately have one login across production and V2 is **NOT decided here**.
5. ADR-001 remains in force for production.
6. An isolated V2 deployment may use `v2_identity`.
7. V2 Identity concepts remain one conceptual Identity model.
8. V2 must not use production Identity as its normal authorization path.
9. No V2 Auth or membership implementation is authorized by this ADR.
10. Gate B is now the next decision gate.

---

## Conflict 1 — C1-B (Auth)

**Interpret** `docs/architecture/platform/02-identity.md` Purpose (“one authentication system for the entire platform”) and Current State (“one Supabase project, one `auth.users`”) as governing the **production Pulse product plane** and its current production Experiences (today: Expo and OMS sharing that project).

**Extend:** an **isolated Pulse V2 data plane** may operate a **separate V2 Auth authority** when V2 is provisioned.

**Do not:** repeal the production Auth rule; decide one-login; introduce federation; provision V2 Auth; implement Auth.

---

## Conflict 2 — C2-B (Identity schema)

**Interpret** ADR-001 as remaining fully applicable to the **production/OMS identity plane**.

**Unchanged on production:**

- `public.*` remains production Identity.
- `platform.*` remains shadow until an independently approved cutover.
- No second, parallel Identity schema on the production database for the mobile/OMS product line.

**Extend:** an isolated V2 deployment may have schema `v2_identity` as that deployment’s Identity bounded-context store.

**Unchanged conceptual model:** Actor, Membership, Workspace, Law #6 (Identity authenticates only). This is **not** a second business Identity model.

**Do not:** create `v2_identity` tables in this ADR; modify production migrations; query production Identity for V2 runtime authorization.

---

## Explicitly not decided

- Product one-login / existing GoGoX users (Gate B)
- Federation / broker
- Person vs `auth.users` on V2
- Exact RLS plumbing
- Local vs hosted V2 infrastructure (Gate C)
- Slice 4 implementation scope (Gate D)

---

## References

- `docs/architecture/platform/02-identity.md` (dated clarification 2026-09-20)
- `docs/decisions.md` ADR-001 and dated clarification 2026-09-20
- `packages/pulse-v2/IDENTITY_GATE_DECISIONS.md`
- `packages/pulse-v2/IDENTITY_GATE_OWNER_INTAKE.md`
