# Bootstrap load budget

Critical path after sign-in may only load what is required to render the shell.
Feature data loads after the boot quiet window, on feature entry, or in a
bounded background pass. Do not reintroduce the 2026-09 login herd.

## Allowed on the sign-in critical path

- Session restore (`getSession` / token refresh once)
- Active org + capabilities
- `get_global_app_bootstrap` once per org (single-flight, in-flight flag before await)
- Route to the default shell

## Forbidden on the sign-in critical path

- trips `limit=2000`
- `transactions` `select=*`
- `get_drivers_with_profiles`
- `get_driver_ledger_aggregation`
- Network 2000-row trip counts
- `get_multi_lane_bootstrap`
- Finance / trips warmup
- Chat inbox bootstrap
- Non-critical connection-request RPCs (except the single-flight bootstrap slice)
- Bulk Storage sign-URL bursts
- Extra `getUser` / profile refresh
- Extra `refreshSession` (including driver signup)

## When feature data may load

- After the boot quiet window (`appQueryGate`)
- When the user opens the feature
- Via GlobalSync slices that are already single-flight and circuit-aware

A new query on the sign-in path is a regression. Prefer adding it behind the
gate or the feature route instead.
