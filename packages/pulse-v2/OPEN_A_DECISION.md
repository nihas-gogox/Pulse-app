# Pulse V2 — OPEN A Decision Record

**Record type:** Owner-accepted architecture decision.  
**Kind:** Documentation only. Does **not** authorize Auth, tables, migrations, JWT, RLS, hosted V2, OPEN B, or Slice 5.  
**Slice 4 runtime:** `a60aad5a` — **FROZEN**. SEC-001 **CLOSED**.

---

## Decision

### OPEN A — RESOLVED: Model B

```text
Auth Subject  ≠  Actor
Auth Subject  ──binds to──►  Actor  →  Membership  →  Workspace
```

**Default cardinality:** **1 Auth Subject → 1 Actor**.

**Person / Model C:** **not required**.

**Governing principle:** Auth authenticates; Pulse authorizes.

**First login:** **Create the Actor automatically** after successful authentication. Actor creation does **not** grant Workspace access. No automatic Membership.

---

## Authoritative definitions

| Concept | Meaning |
|---------|---------|
| **Auth Subject** | Identity established by the eventual authentication system after validation |
| **Actor** | Pulse application identity used by Gateway authorization (`AuthorizationContext.actorId`) |

They are **distinct identifiers**. The client cannot establish Actor, Membership, or Workspace as authority.

---

## Ownership

| Concept | Authority |
|---------|-----------|
| Authentication credential | Auth system |
| Auth Subject | Auth system |
| Auth Subject → Actor binding | Pulse Identity |
| Actor | Pulse Identity |
| Membership | Pulse Identity |
| Workspace | Pulse |
| AuthorizationContext | V2 Gateway |
| Permissions | **OPEN B** |

The Auth provider must **not** own Actor authorization, Membership, Workspace, Roles, or Permissions.

---

## First-login lifecycle (accepted)

```text
Successful authentication
        ↓
Trusted Auth Subject
        ↓
Lookup Auth Subject → Actor binding
        ↓
   exists              absent
        ↓                  ↓
   resolve Actor     create Actor
        ↓                  ↓
        └────────┬─────────┘
                 ↓
          resolve Membership
                 ↓
          resolve Workspace
                 ↓
       AuthorizationContext
```

```text
Actor exists + no Membership  =  no Workspace authorization  =  no authenticated data-plane access
```

Authenticated without Membership is **not** an allow.

---

## Slice 3 contradiction (preserved)

Slice 3 (`IDENTITY_AUTHORIZATION_DESIGN.md` §2) contained a **preliminary Model A recommendation**:

```text
actorId = Auth subject (V2 auth.users.id when provisioned)
```

That recommendation is **historical**. It is **not** deleted.

Owner review of OPEN A (`OPEN_A_AUTH_ACTOR_DESIGN.md`, then this record) **selected Model B**. **Model B is now the authoritative decision.**

Also recorded in: this file; `OPEN_A_IMPLEMENTATION_PLAN.md`; `IDENTITY_GATE_DECISIONS.md` Decision 8; `STATUS.md`.

---

## Compatibility with Slice 4 (`a60aad5a`)

Model B matches the implemented seam:

- `IdentityPort.resolveActor` already returns a Pulse `actorId` distinct from caller fields
- `request.actorId` is not authority (SEC-001)
- Membership is resolved for that Actor; Workspace from membership
- Nested Commerce → Execution reuses one `AuthorizationContext`
- One `resolveMembership` per public `execute()`

Future: validated Auth Subject in, Actor out — same port, not a new Gateway tenancy path.

---

## Deferred (not part of OPEN A)

- Multiple Auth Subjects → one Actor; account merging; linking
- Federation, SSO, SCIM, external/social IdPs
- Auth provider product, JWT/session shape, token claims
- Membership persistence, RLS policies, hosted V2
- **OPEN B** (permission catalog / RBAC / Product-Experience permissions)

Future expansion of cardinality requires a **new** architecture decision.

---

## OPEN B

Unresolved. Actor identity must exist before permissions can be resolved. **Actor identity does not grant permissions.** Membership `active` remains the only platform check until OPEN B.

---

## Production

Production Auth, `auth.users`, `organization_members`, production migrations, production Supabase, Expo production line, and Oct 1 remain **untouched**. V2 Identity stays isolated until a separate cutover decision.

---

## Related artifacts

| Artifact | Role |
|----------|------|
| `OPEN_A_AUTH_ACTOR_DESIGN.md` | Pre-decision analysis (recommendation B) |
| `OPEN_A_IMPLEMENTATION_PLAN.md` | Future implementation stages — **not authorized** |
| `IDENTITY_AUTHORIZATION_DESIGN.md` §2 | Historical Model A recommendation (preserved) |
