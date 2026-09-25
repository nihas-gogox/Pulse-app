# Apps

UI shells only — orchestration and presentation. No direct database access.

| App | Path today | Role |
|-----|------------|------|
| commerce-ui | `oms/` | Catalog, orders, planning, onboarding |
| execution-ui | — | Dispatch, driver views (future) |
| Pulse Driver | `apps/driver` | Driver app (Expo; web at `/driver`, native `com.gogopulse.driver`). See `docs/DRIVER_EXTRACTION_STATUS.md` |
| finance-ui | — | Settlement, invoices (future) |

All API calls go through **Gateway**.
