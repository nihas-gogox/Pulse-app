# Pulse Platform — Identity

**Status:** Frozen

## Purpose

One authentication system for the entire platform. Every customer logs into one Pulse account, regardless of which product they land in.

## Current State (grounded)

- One Supabase project, one `auth.users` table, shared by the main Expo/React Native app and the separate OMS (Commerce) Vite app.
- `handle_new_user()` (`AFTER INSERT ON auth.users` trigger) provisions the `profiles` row and, for owner onboarding, the organization + membership — already shared, already single-sourced.
- `features/auth/services/auth.service.ts` is already substantially framework-agnostic: plain async functions (`signIn`, `signUp`, `signInWithGoogle`, `applyPendingOAuthMetadata`, etc.) with no React dependency.
- `contexts/AuthContext.tsx` is a thin React (RN) wrapper around that service layer.
- `oms/src/context/AuthProvider.tsx` independently reimplements auth calls against the same Supabase project, rather than sharing the service layer above.

## Target

- `packages/platform/identity/` — plain TypeScript, zero React/React Native/Vite dependency. Contains the logic currently in `auth.service.ts`, generalized so any app can call it.
- Each app wraps it in its own thin, framework-native provider: `contexts/AuthContext.tsx` (RN) and `oms/src/context/AuthProvider.tsx` (Vite) both call the same underlying functions instead of each having their own Supabase call implementations.
- The Identity layer has no knowledge of products. It authenticates; it does not decide what happens next (see `04-products.md`, `08-product-registry.md` for what does).

## Principle

Identity only authenticates. It never decides business logic — no product-specific branching lives inside this layer.

## Clarification / extension — Pulse V2 Identity plane (2026-09-20)

**Kind:** Approved Architecture clarification and extension. Historical Purpose, Current State, Target, and Principle above are **unchanged**.

**Record:** `docs/ADR-013-pulse-v2-identity-plane.md` (C1-B).

The Purpose sentence (“one authentication system for the entire platform”) and Current State (“one Supabase project, one `auth.users`”) govern the **production Pulse product plane** and its current production Experiences (Expo and OMS on that project). That production rule is **not repealed**.

An **isolated Pulse V2 data plane** may operate a **separate V2 Auth authority** when V2 is provisioned. V2 must not use production `auth.users` as its normal authorization path.

Whether customers ultimately have one login across production and V2 is **not decided here** (Gate B). This clarification does not provision V2 Auth, introduce federation, or authorize implementation.

## Product requirement — Gate B (2026-09-20)

**Kind:** Approved Product decision. Does **not** amend ADR-013 or the production Auth plane above.

**Record:** `docs/ADR-014-one-identity-workspace-rbac.md`.

Pulse requires **one customer identity/account** across the Pulse platform and services, including Pulse V2. Workspace-scoped RBAC applies; one identity does **not** mean one global authorization context.

This does **not** prescribe shared `auth.users`, federation, or V2 Auth implementation. Production Auth and isolated V2 Auth remain ADR-013 concerns.
