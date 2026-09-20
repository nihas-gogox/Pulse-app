# Pulse V2 status

| Slice | Status |
|-------|--------|
| 1 — Isolation / in-process Gateway / table guards | **ACCEPTED / CLOSED** (`1ded2a6f`, `2ef606d2`) |
| 2 — Persistence isolation | **ACCEPTED / CLOSED** (`acc789fc`) |
| 3 — Identity / Authorization + dedicated V2 infrastructure | **DESIGN RECORDED / IMPLEMENTATION BLOCKED** (`IDENTITY_AUTHORIZATION_DESIGN.md`) |

Do not start Identity **implementation**, customer-proof workflow, hosted provisioning, or Hono Identity wiring until the Slice 3 design is approved. Design text: `IDENTITY_AUTHORIZATION_DESIGN.md`.

## Slice 2 caveat (do not misread)

**Workspace-scoped persistence implemented; trusted tenant authorization pending Identity/Authorization decision.**

`workspace_id` on rows and repository filters is **scoping**, not tenant security. Caller-supplied `workspaceId` is trusted today.

Do **not** weaken deny-all RLS for anon/authenticated to make hosted Supabase “work”.
Do **not** invent a temporary JWT/membership system to close this gap.
Do **not** treat `packages/platform/identity` as the live V2 IdP.
