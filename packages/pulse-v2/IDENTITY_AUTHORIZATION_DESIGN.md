# Pulse V2 — Identity & Authorization design (Slice 3)

**Status:** **DESIGN ACCEPTED.** Implementation **BLOCKED** pending Identity Gate (six decisions) + dedicated V2 infrastructure.  
**Does not** wire `lib/platform-identity`, `packages/platform/identity`, production Auth, or V2 RLS policies.

Slices 1–2 remain closed. Deny-all RLS stays. Caller `workspaceId` is not tenant security.

---

## Classification key

- **VERIFIED FROM REPOSITORY** — observed in this tree
- **ARCHITECTURAL RECOMMENDATION** — proposed for V2, needs approval
- **ASSUMPTION** — not proven in repo
- **OPEN DECISION** — must not be implemented as if settled

---

## 1. Who authenticates the user?

### VERIFIED FROM REPOSITORY

- Production: **Supabase Auth** (`auth.users`) on the **shared** Pulse / pulse-unified-base project. `features/auth/services/auth.service.ts` + `contexts/AuthContext.tsx`. OMS has a **second** AuthProvider against the same project (`docs/architecture/platform/02-identity.md`).
- Layer 1 Law #6 (frozen): Identity authenticates; it does not decide product business logic.
- Hono Identity (`packages/platform/identity`): password login against **configured** `SUPABASE_URL`, then issues a **Platform JWT** (`PULSE_JWT_SECRET`). Uses **service_role** DB client. **No Expo/OMS consumer.** README tells operators to `supabase db push` from **repo root** (production-shaped migrations `202611060001`–`005`).
- V2: no authenticator. Gateway `execute()` takes `payload.workspaceId` from the caller (`packages/pulse-v2`).

### ARCHITECTURAL RECOMMENDATION

V2 authentication is **Auth of the V2 data plane** (V2 local/dedicated Supabase Auth when that project exists), **not** production `auth.users`. Experiences (Expo, OMS) remain production Experiences until a V2 consumer exists.

Until V2 Auth exists, Gateway must **reject** treating payload fields as Actor.

Do **not** authenticate V2 domain calls with production `EXPO_PUBLIC_SUPABASE_*` sessions (Slice 2 isolation).

### OPEN DECISION

When a dedicated V2 project exists: password/OTP/Google on that project vs federating production users. **Do not federate production Auth into V2** without security + infra approval.

---

## 2. How is the authenticated actor represented?

### VERIFIED FROM REPOSITORY

| Stack | Actor id |
|-------|----------|
| Production session | `auth.users.id` (`AuthUser.uid`) |
| `lib/platform-identity` | `personId` on `PlatformWorkspaceContext` (often same as auth user; façade, not a separate Person table required at call sites) |
| Platform JWT (`@pulse/contracts`) | `sub` = `authUserId`; also `tenantId`, `organizationId`, `membershipId`, `role`; **permissions not in JWT** |
| V2 `V2TenantContext` | `actorUserId: string \| null` — unused for auth |

### ARCHITECTURAL RECOMMENDATION

**Actor** = authenticated principal:

```text
actorId          = Auth subject (V2 auth.users.id when provisioned)
personId         = optional Pulse Person (only if V2 Identity schema later stores it)
```

Do not put permissions in the session token (reuse frozen JWT rule).

### OPEN DECISION

Whether V2 Person is 1:1 with `auth.users` or a separate `v2_identity` row. OMS model allows `users.auth_user_id` 1:0..1. Do not invent Person tables in this slice.

---

## 3. How is Workspace membership established?

### VERIFIED FROM REPOSITORY

- Layer 1: **Workspace** = operating boundary, owner of business data. **Today Workspace is not a separate table** — session wrapper around **current organization** (`03-workspace.md`).
- Production membership: `public.organization_members` (+ invites `organization_team_invites`). Live façade: `lib/platform-identity` (`acceptInvitation`, `switchWorkspace`, `listMemberships`).
- Shadow: `platform.memberships` / `platform.organizations` via `platformOrganization.service.ts` only (ADR-003). Cutover **not scheduled** (ADR-001 clarification).
- OMS physical model: Tenant 1:N Organization; Membership N:1 Role; User 1:N Membership.
- V2: `v2_identity` schema **fence, zero tables**.

### ARCHITECTURAL RECOMMENDATION

Membership is a **first-class V2 Identity entity** (future tables in `v2_identity` only), never inferred from Commerce/Execution rows.

Join paths (future): invitation accept, owner bootstrap — same *ideas* as production, **copied as contracts not as production tables**.

**Selector vs authority:** a request may name `membershipId` only to choose among **already verified** memberships of this Actor. It cannot mint access.

### OPEN DECISION

Map Layer 1 Workspace to:

- **A.** Production `organizations.id` (current grounded meaning), or  
- **B.** OMS `platform.tenants.id`, or  
- **C.** OMS `platform.organizations.id`

**Do not silently pick.** Recommendation to approve: **V2 `workspaceId` = Workspace operating boundary = today’s Organization id semantics**, not `platform.tenants`, unless product explicitly wants a holding-company Tenant above Workspace. Command envelope `tenantId` (frozen) must then be mapped in Gateway to Workspace, not become a second RLS key on domain tables.

---

## 4. How is the trusted `workspaceId` derived?

### VERIFIED FROM REPOSITORY

- V2 today: `payload.workspaceId` → repository `ctx.workspaceId`. **Trusted by the caller.**
- Production headers (`getWorkspaceRequestContext`): `Authorization` = Supabase access token; `X-Pulse-Organization-Id` / Person / Membership from **in-memory workspace store**, not re-verified on every header set. **ASSUMPTION:** Edge Functions that trust those headers without checking membership are a production gap; not proven here for every function.
- Platform JWT: `organizationId` + `membershipId` issued **after** membership lookup in Hono `AuthService.login`.

### ARCHITECTURAL RECOMMENDATION

```text
credential (V2 Auth JWT)
  → actorId = sub
  → load memberships for actorId from v2_identity (future)
  → resolve active membership:
        if request.membershipId set: must belong to actor and be active
        else: single membership or fail (require switch)
  → trusted workspaceId = membership.workspaceId
  → AuthorizationContext
  → Gateway execute (payload workspaceId ignored or must equal trusted)
```

**The caller cannot establish tenant authority by supplying `workspaceId`.**

Repositories receive `ctx.workspaceId` **only** from AuthorizationContext. Persistence adapters never read `payload.workspaceId`.

Until Identity tables exist: Gateway **must not** claim trusted context. Keep deny-all RLS. Memory adapter may keep workspace **scoping** for Slice 2 tests only, labeled untrusted.

### OPEN DECISION

Active-workspace persistence (cookie vs membershipId on each command vs server-side “current membership”). Production uses client store + `switchWorkspace()`.

---

## 5. How are roles and permissions represented?

### VERIFIED FROM REPOSITORY

**Three unreconciled systems** (`06-permissions.md` is **seed, not frozen**):

| System | Layer | Examples |
|--------|--------|----------|
| `lib/capabilities.ts` + operating model | Product/UI gating | `fleet_management`, `dispatch`, Asset/Aggregate/Hybrid |
| `PlatformPermission` + `PLATFORM_ROLE_GRANTS` | Admin delegation | `members.invite`, `sso.configure` |
| `@pulse/contracts` `Permission` + `admin\|planner\|operator` | Hono Identity | `commerce:*`, `execution:read` |

Do **not** build a fourth.

### ARCHITECTURAL RECOMMENDATION

- **Role** lives on **Membership**, not on Actor (OMS entity model).
- **Permission** resolved at authorization time from role (+ later org operating model), **not** stuffed into JWT.
- V2 Gateway operations (`commerce.createOrder`) check **operation permissions** in AuthorizationContext.
- Product capabilities and operating-model RBAC stay **Product** concerns (`docs/RBAC_OPERATING_MODEL.md`), applied after Workspace is trusted — they do not replace membership.

### OPEN DECISION

How capabilities, PlatformPermission, and contracts Permission merge (the existing open question in `06-permissions.md`). V2 must not freeze a third catalog. **Approve a mapping**, don’t invent names.

---

## 6. How does authorization reach domain handlers?

### VERIFIED FROM REPOSITORY

V2 `V2GatewayRequest` = `{ domain, operation, payload, correlationId }` — no Actor.

### ARCHITECTURAL RECOMMENDATION

Gateway (in-process) **only** entry:

```text
Request
  → Authentication (credential → Actor)
  → Membership resolution (trusted workspaceId)
  → Authorization (operation allowed in Workspace?)
  → AuthorizationContext
  → domain handler(AuthorizationContext, payload)
  → repository(AuthorizationContext, …)
```

Proposed **AuthorizationContext** (design type, not coded):

```text
actorId
workspaceId          // trusted
membershipId
roles[]              // membership role(s)
permissions[]        // resolved, not client-supplied
correlationId
requestId?           // optional
actingAsService?     // future S2S
```

Resource authorization (can this Actor access **this** `sales_orders` row?) = Workspace match on `workspace_id` **plus** operation permission. Cross-workspace ids fail as not found / forbidden.

Domain handlers **must not** accept a free-standing workspaceId argument.

---

## 7. How does RLS receive trusted tenant context?

### VERIFIED FROM REPOSITORY

- Production: RLS + **anon** key; **no service_role in app** (`docs/decisions.md`).
- V2 Slice 2: RLS **enabled, zero policies** on `v2_commerce.sales_orders` / `v2_execution.trips`. Adapters use anon, never service_role.
- Hono Identity: **service_role** for Identity repositories — **must not** be copied into V2 domain adapters.

### ARCHITECTURAL RECOMMENDATION

Keep deny-all until:

1. V2 Auth JWT exists, and  
2. Gateway (or Auth hook) can set a **server-verified** claim, and  
3. Policies are of the form: `workspace_id = auth.jwt() ->> 'workspace_id'` (or equivalent) **and** that claim is written **only** after membership check.

Do **not** use `SET LOCAL` from client-held workspaceId.  
Do **not** add `USING (true)` to “make hosted work.”  
Do **not** use service_role in Commerce/Execution adapters.

### OPEN DECISION

Claim plumbing: custom JWT (`PULSE_JWT_SECRET` like Hono) vs Supabase Auth JWT custom claims vs Gateway using user JWT + RLS policies on `auth.uid()` + membership table join. Each has ops cost on a **dedicated V2** project.

---

## 8. Service-to-service identity (when services extract)

### VERIFIED FROM REPOSITORY

No live S2S identity. Gateway README: client → Gateway → Command Store → Identity → Service. `PlatformRuntime` stub.

Frozen command envelope includes `tenantId` + `correlationId`, not Actor.

### ARCHITECTURAL RECOMMENDATION

Extracted services **do not** accept browser `workspaceId`. They accept **Gateway-signed** commands (frozen envelope **plus** Actor/membership as optional fields later — **OPEN** whether that is additive on the frozen envelope or a sibling header).

Machine Actor: `actingAsService=true`, still a **workspace-scoped** credential issued by Identity, not a god service_role on domain DBs.

Day 1 in-process: same AuthorizationContext; no network.

### OPEN DECISION

Additive optional fields on Command Envelope vs new auth header. Frozen envelopes: never remove fields; only add optional ones — that path exists **if** approved without rewriting v1 required set.

---

## 9. SSO / SAML / OIDC / SCIM

### VERIFIED FROM REPOSITORY

- Production: Google SSO configured; Entra/Okta/Auth0/SAML **not configured** (`ssoIdentityProvider.ts`). Policy can require SSO (`SSO_REQUIRED`).
- SCIM: documented as next, not built (`PLATFORM_IDENTITY.md`).
- `sso.configure` is a PlatformPermission, not an implementation.
- Identity v1 Hono endpoints: login/me/orgs/BUs/warehouses/invite — **no SSO/SCIM**.

### ARCHITECTURAL RECOMMENDATION

SSO authenticates **Actor** only (Law #6). Membership and Workspace stay Pulse Identity. SCIM (later) **writes memberships**, never domain tables.

V2 should not implement SSO in Slice 3. When V2 Auth exists, attach IdPs to **that** Auth project, not production.

---

## 10. Compatibility with canonical architecture

### VERIFIED FROM REPOSITORY

ADR-005: Layer 1 vocabulary wins. ADR-001 intent: no second Identity system — **resolved as richer model on `public.*` + shadow `platform.*`**. ADR-002/003: pre-Gateway `platform.*` reads, single service file.

V2 isolation: V2 **must not** share production Auth/DB. That is **infra isolation**, not a second *business* Identity model.

### ARCHITECTURAL RECOMMENDATION

One **conceptual** Identity (Actor, Membership, Workspace, Role, Permission) as in Layer 1 + `PLATFORM_IDENTITY.md`.

Two **deployments** (production vs V2) until cutover — same nouns, **different database**.

**Reuse (contracts, not code/DB):** small JWT (no permissions); role on membership; Identity owns users/memberships/invites/roles, not trips/orders; Gateway as only external entry (in-process today).

**Do not reuse in V2:** `lib/platform-identity` on `public.*`; Hono `service_role` against production; `supabase db push` of `202611060001*` onto V2 as if it were production; `X-Pulse-*` headers as proof of membership.

**Hono Identity as future V2 boundary:** **possible** after (1) dedicated V2 project, (2) migrations only in `packages/pulse-v2/supabase`, (3) no service_role in domain adapters, (4) JWT `organizationId` mapped to Layer 1 Workspace, (5) still not wired to production Expo. **OPEN** whether to port that package or keep a thinner Gateway auth module.

---

## Compare implementations (do not wire)

| | A. Production `lib/platform-identity` | B. Dormant `@pulse/platform-identity` |
|--|---------------------------------------|----------------------------------------|
| **Does** | Person/membership/invite/policy/workspace façade for Expo onboarding | Hono Identity API v1, Platform JWT, `platform.*` repos |
| **DB** | `public.*` + Auth | `platform.*` + Auth; **service_role** |
| **As V2 foundation** | Wrong isolation (production data) | Wrong isolation if pointed at production; shape is closer to a service |
| **Reusable** | Vocabulary: Person, Membership, Workspace context, invite/policy *ideas* | JWT claim *shape*, role≠permissions in token, route/service/repo layering |
| **Must not reuse** | Production tables, client workspace store as authority, capabilities merge | Production `db push`, service_role in V2 domain path, warehouse-as-identity-core for V2 RLS |

---

## Trusted request context (target)

```text
Request + credential
  → Authentication → Actor
  → Membership → trusted workspaceId
  → Authorization → permissions
  → AuthorizationContext
  → Gateway → Domain → Repository → Adapter → RLS
```

**Origin of trusted workspaceId:** Identity membership record for this Actor, selected by membershipId, **never** payload.workspaceId.

---

## Authentication vs authorization vs resource

| Concern | Question | V2 owner |
|---------|----------|----------|
| Authentication | Who is this Actor? | Identity / V2 Auth |
| Membership | Which Workspace(s)? | Identity |
| Authorization | What operations in this Workspace? | Gateway using Identity grants |
| Resource authorization | This entity? | Domain + `workspace_id` + RLS |

---

## What Slice 3 implementation must not do (until approved)

- Wire Hono or `lib/platform-identity` into `@pulse/v2`
- Weaken deny-all RLS
- Trust payload `workspaceId`
- Provision hosted V2
- Create a fourth permission system
- Implement SSO/SCIM
- Change frozen envelopes except by explicit additive ADR later
- Modify production auth

## Decisions requiring approval before any Identity code

1. Workspace id mapping (Organization vs Tenant vs platform.organizations).  
2. V2 Auth isolated vs federated.  
3. RLS claim mechanism.  
4. Permission catalog mapping (do not freeze `06-permissions.md` by accident).  
5. Whether Hono Identity is ported onto V2 DB or Gateway stays the auth module.  
6. Dedicated V2 infrastructure (still unprovisioned).
