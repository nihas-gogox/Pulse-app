# Pulse Platform — Workspace

**Status:** Frozen

## Purpose

The Workspace is the operating boundary and the owner of all business data. Everything belongs to a Workspace; products simply operate inside it.

## Current State (grounded)

- `PlatformWorkspaceContext` (`lib/platform-identity/types/workspace.ts`): `{ personId, activeOrganizationId, activeMembershipId, relationshipType, role, permissions[], features[], locale }`.
- Workspace is **not a separate entity from Organization** today — it's an auth/session-scoped wrapper around the current organization.
- Dual-store pattern, already built: a module-level synchronous store (`workspaceContextStore.ts`, for API-layer headers) and a React context (`ActiveWorkspaceContext`, for UI), kept in sync because `switchWorkspace()` calls `syncPlatformWorkspaceFromActive()` internally — callers never need to sync manually.
- `getWorkspaceRequestContext()` returns `{ workspace, headers }` for API calls.
- `ActiveWorkspaceProvider` is mounted app-wide (`app/_layout.tsx`), but real consumption today is concentrated in onboarding/join flows, not threaded through most screens yet.
- Workspace switching exists but its UI is policy-gated and narrow (2+ workspaces + a flag) — not a first-class, always-visible app-shell feature yet.
- OMS does not consume this layer at all — it has its own separate `OrganizationProvider`.

## Target

- `packages/platform/workspace/` — plain TypeScript, wrapping the logic already in `workspaceContextStore.ts`/`switchWorkspace()`/`getWorkspaceRequestContext()`, generalized the same way as Identity.
- Every product (Core, Commerce, Pilot, future products) consumes the same resolved workspace, through its own thin provider.

## Principle

Workspace owns business data. Products read and write it through the Workspace, never by holding a private copy of it or by reaching into another product directly.

## Product requirement — Gate B (2026-09-20)

**Kind:** Approved Product clarification. Historical Purpose, Current State, Target, and Principle above are **unchanged**. Workspace is **not** redefined as login, Auth account, Person, Organization, or Tenant.

**Record:** `docs/ADR-014-one-identity-workspace-rbac.md`.

Workspace remains the operating and data boundary, and the **authorization and experience** boundary after login. Current V2 Product (ADR-014 revision): one authorized Workspace context per session; no V2 Workspace switcher. Production `switchWorkspace()` Current State above is unchanged and is not a V2 Product requirement. Multi-Workspace switching is deferred.
