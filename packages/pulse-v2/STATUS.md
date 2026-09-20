# Pulse V2 status

| Gate | Status |
|------|--------|
| Slice 1 — Isolation / in-process Gateway / table guards | **ACCEPTED / CLOSED** (`1ded2a6f`, `2ef606d2`) |
| Slice 2 — Persistence isolation | **ACCEPTED / CLOSED** (`acc789fc`, caveat `1873b136`) |
| Slice 3 — Identity & Authorization **design** | **DESIGN ACCEPTED** (`b9743770`, `IDENTITY_AUTHORIZATION_DESIGN.md`) |
| Identity Gate — six architecture decisions | **OPEN** — resolve as decisions, not by coding |
| Slice 4 — Identity implementation / trusted context / RLS | **BLOCKED** |
| Customer / product workflow | **BLOCKED** |

Do **not** implement Identity, weaken deny-all RLS, wire Hono, federate production Auth, provision hosted V2, or start customer workflow until the Identity Gate is approved.

Trusted workspace context must come from **verified Actor → Membership**, never from caller `workspaceId`. `membershipId` on a request is a **selector**, not authority.

## Identity Gate (open)

| Decision | State |
|----------|--------|
| Workspace identity mapping | Open — do not equate Organization = Workspace by default |
| V2 authentication model | Open — V2-owned Auth vs federation; no silent production DB dependency |
| RLS claim/context model | Open — wait for auth model; RLS must consume server-verified context only |
| Permission catalog | Open — freeze relationship among existing catalogs; no fourth catalog |
| Hono vs Gateway identity module | Open — implementation choice after the identity **contract**; Hono does not win by existing |
| Dedicated V2 infrastructure | Open — prerequisite to wire Auth and RLS |

Next work, when asked: **Identity Decision Review** (options/tradeoffs, zero code).

## Slice 2 caveat (do not misread)

**Workspace-scoped persistence implemented; trusted tenant authorization pending Identity/Authorization decision.**
