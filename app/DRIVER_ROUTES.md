# Driver-related routes

- **Pulse Driver app** lives in **`apps/driver`** (its own Expo app, served at `/driver/*` on web). New driver work goes there.
- **`app/(driver)/`, `app/driver-sign-in.tsx`, `app/driver-signup.tsx`, `app/onboarding/driver.tsx`, `app/driver-trip/`** — one-line shims re-exporting the `apps/driver` screens. They keep the old in-app driver flow working in the **native** main app (no native hand-off yet). On web, drivers are handed off to `/driver`. Don't add code here; they are removed once Pulse Driver ships natively (`docs/DRIVER_EXTRACTION_STATUS.md`).
- **`app/fleet-driver/`** — dispatcher / fleet view of a driver (`/fleet-driver/[id]`, e.g. from Resources > Drivers).
- **`app/driver/[id]*`** — legacy redirects from the old dispatcher URL `/driver/[id]` to `/fleet-driver/[id]` (on web, Netlify 301s these first).
