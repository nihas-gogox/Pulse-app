# Pulse V2 — Identity Bootstrap Idempotency

**Kind:** Architecture design only. No implementation.  
**Closes:** next gate from `IDENTITY_BOOTSTRAP_INVOCATION_BOUNDARY_DESIGN.md` (`53fb6e6f`).  
**Runtime:** `a60aad5a` **FROZEN**. Production **untouched**.

---

## 1. Status

### DESIGN COMPLETE

**Idempotency scope for `Identity.createWorkspace`:**

```text
trusted Actor
  + command Identity.createWorkspace
  + caller-supplied idempotencyKey
```

**Semantic contract:** the same trusted Actor presenting the same `idempotencyKey` for this command converges on **at most one** authorized Workspace + first `active` Membership. Replay returns that Identity result. The key is **not** authorization. `tenantId` / Workspace id is **not** required to establish the slot.

Reuse the frozen Command Envelope field name and replay/uniqueness **semantics**. Do **not** wrap bootstrap as Command Envelope v1 (required `tenantId` still has no Workspace). Do **not** invent `bootstrapIdempotencyKey` / `workspaceCreationKey` / `identityIdempotencyKey`. Do **not** call production `IdempotencyService` / `public.idempotency_*`.

---

## 2. Context

Bootstrap (`53fb6e6f`): Gateway non-data-plane entry → `resolveActor` → `Identity.createWorkspace`. No Membership, no Workspace, no `AuthorizationContext`.

Retries (timeout, client/Gateway retry, lost response) must not mint Workspace B for the same intended create.

`createWorkspace` caller body remains empty. `execute()` unchanged.

---

## 3. Existing idempotency convention

### Frozen Command Envelope v1 (`oms/docs/contracts/COMMAND_ENVELOPE.md`, `@pulse/contracts`)

| Fact | Value |
|------|--------|
| Field name | **`idempotencyKey`** (required string) |
| Distinct from | `commandId` (Gateway-assigned), `correlationId` (trace) |
| Scope (doc) | Unique per **tenant + command**; store rule `(tenant_id, idempotency_key)` |
| Replay | `COMPLETED` → stored `response_payload` |
| Lifecycle | `RECEIVED` → `PROCESSING` → `COMPLETED`; timeout `STALE` → `RETRYING`; `FAILED` terminal |
| Optional | `requestHash` on `CommandRecord` |
| `tenantId` | Required; “from JWT, never invented” |

V2 Quality Charter cites this envelope. V2 `execute()` **does not** use it today. Bootstrap **cannot** supply envelope `tenantId` as Workspace.

### Production `IdempotencyService` (not V2)

Client-supplied key; scoped with **`orgId`**; replay / **conflict** (body hash) / **pending** / `retry_allowed` after fail; **fail-open** if RPC fails. **Out of V2:** production tables, org scope, fail-open.

### V2 Gateway request

No `idempotencyKey` on `V2GatewayRequest`. Only `correlationId` is required execution metadata today.

**Reuse:** field name `idempotencyKey`, caller-supplied key, uniqueness + in-flight + replay, optional future `requestHash` conflict. **Do not reuse:** Workspace/`orgId` as the uniqueness prefix; production RPCs; fail-open.

---

## 4. Bootstrap idempotency problem

Normal uniqueness `(tenantId, idempotencyKey)` needs a tenant. Bootstrap has none.

Without a substitute scope, retries create a second Workspace. With a **global** key, Actor B could collide with Actor A.

Substitute **trusted Actor** for tenant **only for this Identity command’s idempotency slot**. After success, lookup remains Actor+command+key (not the new Workspace id), so lost-response retry still finds the record.

---

## 5. Idempotency scope

**Chosen:** **Actor-scoped, command-qualified.**

```text
(actorId, "Identity.createWorkspace", idempotencyKey)
```

| Candidate | Verdict |
|-----------|---------|
| `idempotencyKey` global | Rejected — Actor A and B sharing a string would collide |
| Auth Subject + key | Rejected as SoT — OPEN A: Subject ≠ Actor; Gateway trusts Actor from `resolveActor` |
| Workspace / `tenantId` + key | Impossible at start; circular |
| Actor + key (no command) | Weaker if Identity later has other commands; envelope says unique per **tenant + command** |
| Actor + `Identity.createWorkspace` + key | **Selected** — Actor is the only Pulse identity present; matches envelope “per command” |

`actorId` in the tuple is **only** the trusted Actor from `resolveActor`, never caller `actorId`.

---

## 6. Same Actor + same key

```text
Actor A + Identity.createWorkspace + key X
  then again
Actor A + Identity.createWorkspace + key X
```

Second call **must not** create another Workspace.

If the first **COMPLETED** with atomic Workspace+Membership: **replay the original Identity success identifiers**.

If **in flight**: do **not** start a second create (Command Store conflict / production `pending`).

---

## 7. Same Actor + different key

```text
Actor A + key X
Actor A + key Y
```

**Two distinct create intents.** Both may succeed (two Workspaces, two Memberships). No “one Actor = one Workspace” rule (Workspace creation authority + Membership 1:N in data). Session still one Workspace context later (ADR-014).

---

## 8. Different Actor + same key

```text
Actor A + key X
Actor B + key X
```

**Independent.** No shared slot, no shared Workspace. Possession of X does not grant A’s result to B.

---

## 9. Key reuse semantics

Today: empty Identity payload → no body fingerprint required.

Frozen `CommandRecord.requestHash` exists. **If** create later gains non-authoritative metadata: same Actor+command+key with a **different** hash is a **conflict** (production `conflict`; do not replay; do not create). **Do not** invent a new hash algorithm in this gate.

Authoritative fields (`actorId`, `workspaceId`, `role`, …) still **cannot** be supplied as create authority; a fingerprint does not make them authority.

---

## 10. Failure semantics

| Case | Semantic |
|------|----------|
| **A — fail before authorized Workspace** | Slot is **not** `COMPLETED`. Same key **may retry** to complete the atomic unit (Command Store `STALE`/`RETRYING`; production `retry_allowed`). No Workspace B. |
| **B — atomic success, response lost** | Slot `COMPLETED`. Retry **replays** original Workspace + Membership identifiers. |
| **C — partial persist** | **Not** success (`IDENTITY_CREATE_WORKSPACE_CONTRACT.md`). Must **not** `COMPLETED`. Retry of same key continues until atomic success or no authorized Workspace remains. No orphan-as-success. |

Do not specify SQL transactions here.

**Do not** copy production **fail-open** (proceed without guard). V2 Identity bootstrap is **fail-closed**: cannot acquire/record idempotency → **no** create (`V2_WORKSPACE_CREATE_FAILED` / existing Gateway invalid), not a second Workspace.

---

## 11. In-flight semantics

Do **not** invent a new state machine. Reuse Command Store concepts:

| Concept | Meaning for bootstrap |
|---------|------------------------|
| Not acquired | First request may start create |
| `PROCESSING` | Second same tuple: **pending** — no second Workspace |
| `COMPLETED` | Replay |
| `STALE` / `RETRYING` | In-flight timeout; same key may finish **one** atomic create |
| `FAILED` with no authorized Workspace | Same as Case A — retry allowed for **this** command (do not treat FAILED as a successful empty Workspace) |

No extra named V2 catalog of states beyond this mapping.

---

## 12. Response replay semantics

Replay **Identity-owned identifiers**:

```text
workspaceId, membershipId, actorId, membershipStatus: "active"
```

**`correlationId` is not the idempotency key.** Gateway responses today always echo **this request’s** `correlationId`. A retry is a new trace: **current** `correlationId` on the Gateway envelope; **original** resource ids in the Identity result.

Do not require the caller to send the original `correlationId` to replay.

Role remains omitted from the result (names OPEN).

---

## 13. Security analysis

| ID | Preservation |
|----|----------------|
| SEC-001 | Slot keyed by **trusted** Actor only; caller `actorId` cannot attach to another Actor’s key |
| SEC-002 | Idempotency stays on Gateway bootstrap + Identity; no public Identity write API |
| SEC-003 | No Commerce/Execution repo as idempotency store |
| SEC-004 | Replay does **not** mint `AuthorizationContext`; later `execute()` still `resolveMembership` |
| SEC-005 | Not nested `execute()` |
| SEC-006 | Fail-closed on Identity/idempotency failure |
| SEC-007 | `idempotencyKey` is **not** Actor, proof, or Membership. **Possession of the key is not Workspace access.** |

---

## 14. Ownership

**Identity** owns: slot uniqueness, in-flight, replay payload, atomic Workspace+Membership, fail-closed.

**Gateway** owns: invocation — require/pass `idempotencyKey`, `correlationId`, `identityProof`; `resolveActor`; must **not** own Workspace persistence.

**Not:** production `IdempotencyService`, a new shared platform idempotency product, domain repositories.

---

## 15. Gateway responsibility

| Duty | Gateway |
|------|---------|
| Extract `idempotencyKey` | **Yes** — invocation metadata, same class as `correlationId` |
| Require non-empty key | **Yes** (envelope: required; missing → `V2_GATEWAY_INVALID`) |
| Generate the key | **No** — caller-supplied (envelope + production clients) |
| `resolveActor` before Identity | **Yes** |
| Detect duplicates / store replay | **No** — Identity |
| Invent `tenantId` | **No** |

---

## 16. Identity responsibility

Receive `{ trustedActorId, correlationId, idempotencyKey }`. Enforce Actor+command+key uniqueness. Create at most one Workspace+Membership per completed slot. Replay identifiers. Fail-closed. Do not treat the key as Actor proof.

---

## 17. Correlation vs idempotency

| | `correlationId` | `idempotencyKey` |
|--|-----------------|------------------|
| Purpose | Trace this execution | Logical retryable command |
| Required on bootstrap | Yes | Yes |
| Replay | Current request’s id on Gateway response | Same slot; resource ids stable |
| Interchangeable | **No** | **No** |

---

## 18. Persistence requirements (semantic only)

Future Identity persistence **must** guarantee: **at most one completed** `Identity.createWorkspace` per `(actorId, idempotencyKey)` (command implied). In-flight uniqueness so two workers cannot both complete. Replay payload of the four Identity identifiers. **No** table/index/RLS chosen here. **No** `public.*` / production `idempotency_keys`.

---

## 19. Event implications

Frozen Event Envelope has `correlationId`, **not** `idempotencyKey`. Do not add fields. Future `WorkspaceCreated` (still **not** created): emit **once** on first atomic success; retries must **not** emit a second event. `tenantId` on that event **may** be the new Workspace id **after** success. `correlationId` = originating successful command’s trace (implementation later). No second bus.

---

## 20. Explicit non-decisions

Auth/JWT/session, schemas, RLS, migrations, hosted V2, Role names, permission catalog, Product gating, microservice extraction, event bus, wrapping bootstrap as Command Envelope v1, SQL uniqueness mechanism, Command Store deployment, Gateway method name, production `IdempotencyService`.

---

## 21. Decision

`Identity.createWorkspace` is idempotent under:

```text
(trusted actorId, Identity.createWorkspace, caller idempotencyKey)
```

Same tuple → at most one authorized Workspace + first Membership; success replay of those identifiers; Gateway traces retries with the **current** `correlationId`. Different keys → distinct creates. Different Actors → no collision. Key ≠ credential. No Workspace/`tenantId` required to **open** the slot.

---

## 22. Decision rationale

1. Frozen envelope already names `idempotencyKey`, requires it, and unique-scopes **per tenant + command** with replay. V2 Charter points here — reuse the field, not a new name.  
2. Bootstrap has no tenant; OPEN A gives **Actor** as the Pulse identity after `resolveActor`. Actor replaces tenant **only** as idempotency scope prefix for this command.  
3. Global keys fail SEC-001-class collision. Subject-scoped keys skip the Actor bind.  
4. Multiple keys per Actor preserve “any Actor may create” and 1:N Memberships.  
5. Production org-scoped service is the wrong store and fail-opens — incompatible with Identity fail-closed.  
6. Command Envelope v1 still cannot be the **wire** shape (`tenantId` required); semantics transfer without claiming the envelope is satisfied.

---

## 23. Future implementation prerequisites

Not authorized now:

1. Bootstrap Gateway request includes required `idempotencyKey` (pass-through).  
2. `IdentityPort.createWorkspace({ actorId, correlationId, idempotencyKey })`.  
3. Identity slot persistence + atomic Workspace+Membership (mechanism TBD).  
4. Optional later `requestHash` if metadata is added.  
5. Optional `WorkspaceCreated` once-only.  
6. Do not wire production `idempotency_acquire`.

`execute()` remains without this slot.

---

## 24. Validation

1 No Workspace/tenant required to establish the slot — **pass**  
2 Key is not authorization — **pass**  
3 Same Actor + same key → one Workspace — **pass**  
4 Different Actors + same key do not collide — **pass**  
5 Different keys not collapsed — **pass**  
6 Lost-response retry replays original ids — **pass**  
7 Partial persist ≠ COMPLETED; atomicity preserved — **pass**  
8 `correlationId` ≠ `idempotencyKey` — **pass**  
9 Gateway invocation; Identity owns slot/persist — **pass**  
10 `execute()` unchanged — **pass**  
11 No new key type/catalog — **pass**  
12 No runtime — **pass**  
13 Production untouched — **pass**

---

## 25. Next gate

**Gateway bootstrap entry contract** — public method surface: `identityProof`, `correlationId`, `idempotencyKey`; mapping to `Identity.createWorkspace`; errors. Design only. No runtime.

Not schema. Not Auth. Not Command Store implementation.
