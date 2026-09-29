# Production PostgreSQL / Supabase — recurrence forensic runbook

**Scope:** read-only detection and evidence capture.

**Not:** remediation, schema change, settings change, session kill, restart, deploy, or migration.

This is a forensic runbook, not a remediation runbook.

**Purpose:** if degradation recurs, capture **live `wait_event` / `wait_event_type` while the database is actually degraded**, then correlate service logs. Decide on any fix only after that evidence is reviewed.

Do not assume a root cause. Do not treat Realtime, PostgREST, Auth, checkpointing, locks, I/O, or connection exhaustion as the cause unless a later incident supplies **direct** evidence.

---

## Baseline (closed incident — 2026-09-29)

| Field | Value |
| --- | --- |
| Status | Recovered / currently healthy enough for SQL access |
| Impact window | ~2026-09-29 **14:20Z–14:37Z** |
| Root cause | **Unconfirmed** |
| Highest-value gap | Wait events **during** failure (post-recovery snapshot was insufficient) |

**Observed (signals, not attributed cause):** Auth `/token` timeouts and connection failures; Auth `users` SELECT `57014`; PostgREST schema-cache `57014`, PGRST001 (`no connection to the server`), PGRST002, readiness 503; Realtime catalog/subscription `57014`; management/catalog `57014`.

**Not evidenced that day:** connection-slot exhaustion; too many connections; deadlock; lock timeout; checkpoint **preceding** onset; confirmed IO/LWLock contention during the window.

**Recovery snapshot (~14:40Z):** `SELECT 1` succeeded; visible PostgREST/Realtime sessions idle `ClientRead`; no Lock/LWLock/IO on the **returned page**; incident PIDs already gone.

Checkpoint start/complete ~14:38Z FOLLOWS the ~14:20Z–14:37Z failure pattern; it is not recorded as the initiating event.

Recovery snapshot: no relevant Lock/LWLock/IO among returned rows; LIMIT 30 was not exhaustive.

---

## Part 1 — Detection signals (observation only)

These **must not** automatically trigger remediation.

### A. Auth

- `/token` `request_timeout`
- `context deadline exceeded`
- `failed to connect`
- `dial tcp [::1]:5432`
- Auth `users` SELECT `57014`

### B. PostgREST

- PGRST001
- PGRST002
- schema cache load failure
- schema cache retry
- rest-admin `/ready` 503
- `no connection to the server`
- application REST 504

### C. Realtime

- `57014`
- `pg_publication_tables`
- `realtime.subscription`
- `realtime_subscription_manager`
- `realtime_subscription_manager_pub`
- `realtime_rls`

### D. Database (explicit log lines only)

- remaining connection slots
- too many connections
- deadlock
- lock timeout
- checkpoint start/complete
- WAL errors
- I/O errors
- server restart
- connection reset/closed

---

## Part 2 — Incident trigger (enter forensic capture)

Treat as a **suspected recurrence** when **multiple independent** failures appear **within the same few-minute window**. Examples (any combination; **not** all required):

- Auth failure
- PostgREST readiness / schema / connection failure
- Realtime `57014`
- management/catalog failure
- database connectivity failure

Management/catalog signals may include dashboard or mgmt-api 57014, pg_stat_statements-related catalog failures, and similar administrative catalog operations.

This is a detection signal only, not a root-cause assertion.

Do **not** infer cause from the trigger. Once the threshold is met: **enter forensic capture mode**.

---

## Part 3 — Forensic capture mode

Do not continuously poll PostgreSQL.

Operator sequence:
DETECT → record log time window (onset ± 5 minutes as soon as
suspected) → one SELECT 1 → only if successful, one activity
snapshot → STOP SQL → correlate logs → classify only from evidence.

Use the smallest number of diagnostic queries.

Operator confirms the SQL path is currently degraded, then:

### Step 1 — one ping

```sql
SELECT 1;
```

Record: operator/client timestamp, success/failure, exact error on failure.

**If `SELECT 1` fails: STOP SQL diagnostics.** Do not retry repeatedly. Continue **log collection only**.

### Step 2 — one activity snapshot (only if ping succeeds)

Immediately, **once**:

```sql
SELECT
  pid,
  backend_type,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS query_age,
  now() - xact_start AS xact_age
FROM pg_stat_activity
WHERE pid IN (
  376140,
  376136,
  376334,
  376289
)
OR wait_event_type IS NOT NULL
ORDER BY query_start NULLS LAST
LIMIT 30;
```

These four PIDs are historical examples from 2026-09-29 only.
They are not persistent identities. Postgres reuses PIDs: a
matching PID later may be a different session and service.

If they are absent, report absence; that does not mean
Realtime, PostgREST, or Auth is healthy.

For a new incident, identify current backends from this snapshot
using application_name, backend_type, and usename.

Do not run extra SQL to look up PIDs.

If a listed historical PID appears, treat it as current process
identity unknown until the application_name/backend_type/usename
columns are checked, not as the old incident session.

Do **not**: joins, catalog queries, `pg_locks` on first response, `pg_stat_statements`, `EXPLAIN`, database-size queries.

### Step 3 — stop

Do not repeat the activity snapshot.

---

## Part 4 — Interpreting wait events

Classify **only** from the live snapshot.

| Category | Rule |
| --- | --- |
| **A. Lock** | `wait_event_type = Lock`. Record exact `wait_event`. Do **not** automatically conclude deadlock. |
| **B. LWLock** | `wait_event_type = LWLock`. Record exact `wait_event`. |
| **C. IO** | `wait_event_type = IO`. Record exact `wait_event`. |
| **D. Client** | e.g. `ClientRead`, `ClientWrite`. **`ClientRead` is not database contention.** |
| **E. Other** | Any other `wait_event_type`. Record exact values **without** extra interpretation. |

**F. No relevant contention observed among the returned rows**

Use this label only. Do not conclude there was no Lock/LWLock/IO
on the instance.

Qualifiers:
The 2026-09-29 recovery query used ORDER BY query_start NULLS LAST
LIMIT 30 and filled the page with long-idle ClientRead. Newer or
active waiters can be off the page.

'No Lock/LWLock/IO in 30 rows' is not 'no contention.'

Historical log 57014 is not a live wait_event.

Classify waits only from this snapshot's wait_event_type /
wait_event.

Idle loops such as `CheckpointerMain`, `WalSenderWaitForWal`, `ArchiveCommand` are **not** automatically incident evidence.

---

## Part 5 — Service correlation (logs)

Window: **5 minutes before** suspected onset, incident duration, **5 minutes after** apparent recovery.

Correlate: Auth, PostgREST, Realtime, management/catalog, database.

Per event record:

| Field |
| --- |
| timestamp UTC |
| component |
| PID if available |
| application |
| error |
| operation |
| duration |
| relevant SQL/object |
| connection vs query failure |

**Distinguish (not equivalent):**

1. Query cancellation (`57014` / statement timeout)
2. Connection establishment failure
3. Connection lost
4. Service readiness failure
5. Application timeout

Query cancellation, connection failure, and readiness failure are
observations. None of them is, by itself, a root cause.

---

## Part 6 — Temporal analysis

Minute-level table:

| Minute | Realtime | PostgREST | Auth | Mgmt/Catalog | DB-side |

Determine: first appearance of each family; first minute with 2+ families; first minute with 3+ families; common onset; persistence; whether one family repeatedly appears **1+ minutes before** another.

**Temporal precedence is not causality.** Use: “Realtime preceded PostgREST in the observed logs.” Do **not** use: “Realtime caused PostgREST.”

---

## Part 7 — Connection exhaustion

Classify exhaustion **only** with explicit evidence, e.g.:

- remaining connection slots
- too many connections
- pool exhaustion
- connection acquisition timeout **clearly attributed** to pool exhaustion

**Do not infer** exhaustion from Auth dial failure, PGRST001, slow queries, “many connections,” or a full-looking activity list.

---

## Part 8 — Checkpoint analysis

If checkpoint start/complete appears in logs, classify vs onset:

- PRECEDES INCIDENT
- OVERLAPS INCIDENT
- FOLLOWS INCIDENT

Do **not** call checkpoint the cause merely because it overlaps. Capture write/sync/total duration **only if already present** in those logs. **Do not force a checkpoint.**

---

## Part 9 — Recurrence incident report

Use this structure:

```
INCIDENT ID:
DATE:
TIME WINDOW UTC:
STATUS:

1. DETECTION
2. FIRST OBSERVED FAILURE
3. AUTH
4. POSTGREST
5. REALTIME
6. MANAGEMENT/CATALOG
7. DATABASE-SIDE SIGNALS
8. LIVE pg_stat_activity SNAPSHOT
9. WAIT EVENTS
10. CONNECTION EXHAUSTION EVIDENCE
11. CHECKPOINT CORRELATION
12. TEMPORAL CORRELATION
13. WHAT IS PROVEN
14. WHAT IS NOT PROVEN
15. ROOT CAUSE STATUS
16. RECOMMENDED NEXT FORENSIC STEP
```

**ROOT CAUSE STATUS** must be one of: `CONFIRMED` | `PARTIALLY IDENTIFIED` | `UNCONFIRMED`. Do not select `CONFIRMED` without **direct** evidence.

---

## Part 10 — Stop SQL immediately if

1. `SELECT 1` fails.
2. `pg_stat_activity` times out.
3. A diagnostic query causes noticeable DB degradation.
4. The database becomes unstable.
5. The operator instructs STOP.

Do not retry repeatedly. Objective: **evidence preservation**, not exhaustive querying.

---

## Part 11 — Production safety

This runbook must **never automatically**:

- restart anything
- kill sessions
- increase connections
- change timeouts or pool size
- disable Realtime or PostgREST
- change checkpoint configuration
- change indexes, RLS, or grants
- deploy code
- apply migrations

Any remediation requires **separate authorization** after evidence review.

---

## Closed-incident reminder

**Supported as a description (2026-09-29):** transient shared PostgreSQL / control-plane degradation affecting multiple consumers.

**Not supported:** “shared resource X caused it.”

Next incident: DETECT → stamp logs → one SELECT 1 → at most one
activity snapshot → STOP → correlate → classify from live rows and
logs, not from 2026-09-29 PIDs or post-recovery silence.
