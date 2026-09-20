# Pulse V2 — Identity Gate: Owner Decision Intake & Slice 4 Readiness

**Record type:** Readiness check. Does **not** approve decisions. Does **not** implement Identity.  
**Architecture record:** `IDENTITY_GATE_DECISIONS.md`  
**Design artifact:** `IDENTITY_AUTHORIZATION_DESIGN.md`  
**Inspected:** `STATUS.md`; `docs/architecture/platform/02-identity.md`; `03-workspace.md`; `06-permissions.md`; `docs/decisions.md` (ADR-001 clarification, ADR-005); `docs/audit.md` (production PITR note only).

**Rule used:** Architecture recommendations and Architecture-only freezes are **not** Product, Security, or Infrastructure approvals.

Status vocabulary for this intake:

| Label | Meaning |
|-------|---------|
| **APPROVED — explicit owner decision exists** | Named owner recorded an approval in-repo (signed record, ADR, or this Architecture gate for Architecture-owned items only) |
| **PROPOSED — architecture recommendation only** | Direction exists; required co-owner has not approved |
| **OPEN — no owner decision** | No explicit owner answer |
| **CONFLICTING — owner inputs disagree** | Two recorded positions cannot both be true without an owner choosing |
| **NOT APPLICABLE** | Decision does not arise until a prior owner answer exists |

**Slice 4 readiness from this intake: BLOCKED.**

---

## A. Executive readiness conclusion

**BLOCKED**

No Product, Security, or Infrastructure owner approval records were found. Architecture has frozen invariants in `IDENTITY_GATE_DECISIONS.md`. That is insufficient to start Slice 4 implementation.

---

## B. Owner decision checklist

### Product / Business

| # | Decision | Status | Notes |
|---|----------|--------|--------|
| 1 | Does V2 need existing GoGoX users to retain one login? | **OPEN — no owner decision** | Gate left this to Product. `02-identity.md` (frozen, **production** platform) says one Pulse account; that is not a V2 Product answer. |
| 2 | First customer's Organization → V2 Workspace mapping | **OPEN — no owner decision** | Mapping is defined as cutover/integration, not as keys or first-customer shape. |
| 3 | Holding-company Tenant required for first V2 customer? | **OPEN — no owner decision** | |
| 4 | Permission semantics Product must approve | **OPEN — no owner decision** | `06-permissions.md` is **Seed — NOT frozen**. |

### Architecture

| # | Decision | Status | Notes |
|---|----------|--------|--------|
| 5 | Organization → Workspace mapping key | **OPEN — no owner decision** | Entity model is Architecture-approved; UUID vs code vs 1:1 is explicitly unfrozen. |
| 6 | `Person` separate from `auth.users`, or defined 1:1? | **OPEN — no owner decision** | Design artifact lists this as OPEN. |
| 7 | Final permission mapping | **PROPOSED — architecture recommendation only** | No fourth catalog + mapping **shape** are Architecture-approved. Final map is not approved. |
| 8 | Exact RLS architecture | **PROPOSED — architecture recommendation only** | Deny-all until trusted identity is Architecture-approved. Claims vs lookup vs GUC vs hybrid is unfrozen. |
| 9 | Should Hono eventually be the Identity service? | **OPEN — no owner decision** | Gateway-first **now** is Architecture-approved. Eventual port/extract is explicitly unfrozen. |

### Security

| # | Decision | Status | Notes |
|---|----------|--------|--------|
| 10 | If one-login is required, federation/broker model | **NOT APPLICABLE** until Product answers #1 as **yes**. Until then also **OPEN — no owner decision** on whether federation will ever be required. | No Security-approved broker. Gate forbids production DB as the federation path. |
| 11 | Security requirements accompanying V2 Auth/RLS | **PROPOSED — architecture recommendation only** | Caller `workspaceId` never authority; deny-all until trusted identity; no client GUC/role/permission; no production Auth as runtime path. **No separate Security owner sign-off found.** |
| 12 | Token / session / revocation requirements | **PROPOSED — architecture recommendation only** | Permissions-out-of-JWT is a frozen platform rule restated by Architecture. TTL, `jti`, membership-row revocation vs claim expiry: not Security-approved. |

### Infrastructure

| # | Decision | Status | Notes |
|---|----------|--------|--------|
| 13 | Dedicated V2 Supabase project approved? | **PROPOSED — architecture recommendation only** | Architecture: prerequisite for real Auth/RLS. **Not provisioned. No Infrastructure approval found.** |
| 14 | V2 Auth provisioning approved? | **OPEN — no owner decision** | |
| 15 | Backup / PITR / DR for V2 | **OPEN — no owner decision** | `docs/audit.md` discusses **production** PITR gaps. That is not a V2 env decision. |

---

## C. Approval evidence

Only items with **explicit Architecture-owner** evidence (not Product/Security/Infrastructure):

| Item | Evidence | What it does **not** prove |
|------|----------|----------------------------|
| Workspace is an explicit V2 Identity entity; not Organization; not Tenant | `IDENTITY_GATE_DECISIONS.md` Decision 1 | First-customer mapping, keys, Tenant |
| V2-owned Auth as **Architecture default**; membership always V2 Identity; production Auth not a runtime path | `IDENTITY_GATE_DECISIONS.md` Decision 2 | Product one-login; Security federation; Infra Auth project |
| Trusted workspace from Actor → Membership; caller `workspaceId` never authority | `IDENTITY_GATE_DECISIONS.md` Decision 3 | Implementation of Auth/membership tables |
| RLS deny-all until trusted Auth + membership | `IDENTITY_GATE_DECISIONS.md` Decision 4 | Exact RLS plumbing |
| No fourth permission catalog; mapping **shape** | `IDENTITY_GATE_DECISIONS.md` Decision 5 | Frozen `06-permissions.md` or final map |
| Gateway-first; Hono dormant **now** | `IDENTITY_GATE_DECISIONS.md` Decision 6 | Eventual Hono extraction |
| Dedicated V2 infra **prerequisite** (not provisioned) | `IDENTITY_GATE_DECISIONS.md` Decision 7 | Infra/Security provisioning approval |
| Layer 1 Workspace = operating/data boundary (production platform vocab) | ADR-005; `03-workspace.md` Principle | V2 Workspace table or org mapping keys |
| `06-permissions.md` not frozen | `06-permissions.md` status line | Any Product permission freeze |
| Hosted V2 not provisioned | `packages/pulse-v2/README.md`, Slice 2 STATUS | Infra approval |

**Not found anywhere:** signed Product decision, signed Security decision, signed Infrastructure decision, ADR that provisions V2 Auth, ADR that freezes V2 mapping keys, ADR that freezes `06-permissions.md`.

**Explicitly not evidence:** Slice 1–3 acceptance; “recommended”; absence of objections; coding-agent conclusions; implementation convenience.

---

## D. Conflicts

Do **not** reconcile. Owner must choose.

### Conflict 1 — one Auth vs V2-owned Auth

```text
Decision: Is Pulse allowed a second authentication deployment for V2?

Existing position A: One authentication system; one Supabase project; one auth.users; every customer one Pulse account.
Source: docs/architecture/platform/02-identity.md (Status: Frozen)

Existing position B: V2-owned authentication is the default isolation model; V2 must not use production auth.users / organization_members as the normal authorization path.
Source: packages/pulse-v2/IDENTITY_GATE_DECISIONS.md Decision 2

Why they conflict: If 02-identity.md applies to V2, a dedicated V2 Auth project violates a frozen platform law. If V2 is a separate data plane until cutover, 02-identity.md applies to production Experiences only.

Required owner: Architecture + Product/Business (scope of 02-identity.md). Security if federation vs second Auth.
```

### Conflict 2 — no second Identity schema vs `v2_identity`

```text
Decision: May V2 create Identity tables outside production public.* / platform.*?

Existing position A: ADR-001 — no second, parallel identity schema for the mobile product line; Identity is a shared platform bounded context.
Source: docs/decisions.md (ADR-001 and PR-008 clarification)

Existing position B: V2 membership lives in V2 Identity (`v2_identity` fence); production identity is not a V2 runtime dependency.
Source: IDENTITY_GATE_DECISIONS.md; IDENTITY_AUTHORIZATION_DESIGN.md; packages/pulse-v2/supabase SCHEMA fence

Why they conflict: ADR-001 forbids a competing Identity system for the same product line. V2 isolation requires a different database. Unresolved whether V2 is “same product line, second schema” or “successor plane with copied contracts.”

Required owner: Architecture
```

### Related tension (not two V2 owner approvals)

```text
Decision: Is Workspace the same row as Organization?

Position A (production grounded): Workspace is not a separate entity from Organization today.
Source: docs/architecture/platform/03-workspace.md

Position B (V2 Architecture): Workspace is an explicit V2 entity; mapping to Organization is cutover, not identity.
Source: IDENTITY_GATE_DECISIONS.md Decision 1

Why they conflict if Product treats A as the V2 mapping: V2 would authorize using production org identity, which Decision 1 forbids at runtime.

Required owner: Product/Business + Architecture (mapping keys — already OPEN)
```

No Product-vs-Product or Security-vs-Security disagreement was found (those owners have not recorded V2 decisions).

---

## E. Minimum approval set

### Required before Slice 4 **design** can be finalized

1. **Architecture (+ Product):** Scope of Conflict 1 and Conflict 2 — V2 Auth/Identity as isolated plane vs frozen one-Auth / ADR-001. Without this, Slice 4 design cannot name where Actor lives.
2. **Architecture:** `Person` vs `auth.users` enough to name `actorId` on membership.
3. **Architecture + Security:** Whether Slice 4 **changes RLS** or **keeps deny-all** and only introduces Gateway `AuthorizationContext`. Exact plumbing is required only if RLS changes in Slice 4.
4. **Product:** One-login yes/no — or an explicit Product waiver that Slice 4 uses **V2-only test actors** with no production login promise.
5. **Infrastructure + Security:** Local V2-only Auth/Postgres **or** dedicated hosted V2 — which environment Slice 4 is allowed to use. Production remains excluded either way.

### Required before Slice 4 **implementation**

1. All of the design-finalize items above, recorded by the named owners (not by this intake).
2. **Infrastructure + Security:** Approval to use **Option A (local V2-only)** and/or **Option B (hosted V2)** for Auth+Postgres. Neither is approved today. Neither may be production.
3. If RLS is in Slice 4: Security + Architecture on plumbing; V2 Auth actually available on the chosen environment.
4. Membership as V2 Identity (schema in `packages/pulse-v2/supabase/migrations` only) — after owners approve creating Identity tables (Conflict 2).

### Can remain open until a later slice

- Holding-company Tenant (if Slice 4 authorizes a single V2 Workspace type with no Tenant row).
- Organization → Workspace **production mapping keys** (if Slice 4 uses V2-native `workspaceId` and does not integrate production orgs).
- First-customer commercial mapping (customer workflow is already blocked).
- Final permission catalog mapping and `06-permissions.md` freeze (if Slice 4 does **not** implement production-grade operation authorization — membership + trusted workspace only).
- Eventual Hono port/extract.
- Federation/broker (if Product answers one-login **no**, or Slice 4 is V2-only test actors).
- Hosted backup/PITR/DR (if Slice 4 is local-only; required before hosted production-like V2).

Do **not** treat “can remain open” as approval to implement.

---

## F. Slice 4 boundary

**Not defined.** Approvals are insufficient to authorize a Slice 4.

A later owner-approved slice might be narrower than Auth+Membership+RLS (for example: Gateway refuses payload `workspaceId` as authority while RLS stays deny-all). That is **not** authorized by this intake.

Slice 4, whenever authorized, still must **not** include: customer workflow; Commerce/Execution expansion; microservice extraction; Hono extraction; event bus; Kafka/Redis/Kubernetes; production migrations; production identity changes.

---

## G. Remaining blockers

| Blocker | Owner |
|---------|--------|
| One-login / no production-login promise for V2 | Product/Business |
| First-customer org mapping (if Slice 4 integrates production orgs) | Product/Business + Architecture |
| Holding-company Tenant (only if first customer needs it; not a Slice 4 schema blocker if deferred) | Product/Business + Architecture |
| Mapping key | Product/Business + Architecture |
| Resolve Conflict 1 (one Auth vs V2 Auth) | Architecture + Product/Business |
| Resolve Conflict 2 (ADR-001 vs `v2_identity`) | Architecture |
| Person vs `auth.users` | Architecture |
| Exact RLS plumbing **or** explicit “deny-all remains in Slice 4” | Architecture + Security |
| Permission mapping / `06-permissions.md` if Slice 4 includes operation authorization | Product/Business + Architecture |
| Eventual Hono role (does **not** block a Gateway-first Slice 4) | Architecture |
| Federation/broker if one-login is yes | Security + Product + Architecture |
| Dedicated V2 project and/or local V2 Auth/Postgres **approval** | Infrastructure + Security |
| V2 Auth provisioning | Infrastructure + Security |
| Backup/PITR/DR if hosted | Infrastructure + Security |

---

## H. Local vs hosted (do not provision)

| Option | What it is | Allowed as production Pulse? | Approved for Slice 4? |
|--------|------------|------------------------------|------------------------|
| **A. Local V2-only Auth/Postgres** | Separate from `supabase/migrations` production tree; `PULSE_V2_*` only | No | **No** — Architecture allows the *idea*; Infrastructure/Security have not approved |
| **B. Dedicated hosted V2 project** | Separate project ref, secrets, Auth, Postgres, migrations | No | **No** — not provisioned; not Infra-approved |
| **C. Both** | Local for Slice 4, hosted later | No | **No** |
| Production Supabase | `EXPO_PUBLIC_*` / repo-root migrations | **Excluded** | Must remain unused |

Architecture already states dedicated V2 infrastructure precedes **real** Auth/RLS wiring. Whether “local V2-only” counts as that infrastructure is an **Infrastructure + Security** decision, not inferred here.

---

## Slice 4 readiness matrix

| Decision | Current recommendation | Owner | Approval evidence | Status | Blocks Slice 4? |
| -------------------------- | ------------------------------------- | --------------------------------- | ----------------- | ------ | --------------- |
| Workspace mapping | Explicit V2 Workspace | Product + Architecture | Architecture: `IDENTITY_GATE_DECISIONS.md` D1. Product: none | Architecture approved entity; Product **OPEN** | Entity: no. Customer mapping: **yes** if Slice 4 integrates production orgs; **no** if V2-native workspace ids only (Product must still waive integration) |
| Mapping key | TBD | Product + Architecture | None | **OPEN** | **Yes** if integrating production orgs; **no** if V2-native ids only |
| Holding-company Tenant | TBD | Product + Architecture | None | **OPEN** | **No** if Tenant is deferred; **yes** for first-customer go-live if Product needs Tenant |
| Existing-user one-login | TBD | Product | None | **OPEN** | **Yes** unless Product waives production login for Slice 4 |
| Authentication model | V2-owned default | Product + Security + Architecture | Architecture: D2. Product/Security: none | **PROPOSED** for Product/Security; Conflict 1 unresolved | **Yes** |
| Person/auth.users | TBD | Architecture | None | **OPEN** | **Yes** for membership schema |
| RLS model | Server-verified identity + membership | Security + Architecture | Principle: D4. Plumbing: none. Security owner: none | **PROPOSED** | **Yes** if Slice 4 changes RLS; **no** if deny-all stays and is explicit |
| Permission mapping | No fourth catalog | Product + Architecture | Shape only: D5. Final map: none | **PROPOSED** / **OPEN** | **No** if Slice 4 is membership+workspace only; **yes** if operation authorization ships |
| `06-permissions.md` freeze | Required before production-grade V2 authz | Product + Architecture | Document says **NOT frozen** | **OPEN** | Same as permission mapping |
| Hono role | Gateway-first; Hono later | Architecture | Now: D6. Eventual: none | Gateway-first **APPROVED** (Architecture); eventual **OPEN** | Eventual: **no** |
| Federation/broker | Conditional | Security + Product + Architecture | None | **NOT APPLICABLE** until one-login = yes | **Yes** only if Product requires one-login |
| Dedicated V2 project | Required for real Auth/RLS | Infrastructure + Security | Prerequisite recorded; no Infra approval; not provisioned | **PROPOSED** | **Yes** for hosted; local Option A **yes until Infra/Security say local counts** |
| V2 Auth provisioning | Required | Infrastructure + Security | None | **OPEN** | **Yes** |
| Backup/PITR/DR | TBD | Infrastructure + Security | None for V2 | **OPEN** | **No** for local-only Slice 4; **yes** before hosted/prod-like V2 |

---

## I. Change confirmation

This intake created/updated documentation only:

- **Created:** `packages/pulse-v2/IDENTITY_GATE_OWNER_INTAKE.md`
- **Updated:** `packages/pulse-v2/STATUS.md` (pointer only)

Confirmed:

- zero runtime code changes
- zero migration changes
- zero RLS changes
- zero infrastructure changes
- zero Hono changes
- zero production changes
- zero commits
