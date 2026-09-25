-- PostgREST /ready stays 503 when the LISTEN "pgrst" session is killed as idle
-- (idle_session_timeout=180000ms). That drops schema-cache notifications and
-- forces a reconnect/cache reload. Keep idle-in-transaction tight; do not
-- reap the LISTEN socket. Raise lock_timeout so the 647-function cache load
-- is not aborted by 5s catalog locks. Do not raise max_connections.

ALTER ROLE authenticator SET idle_session_timeout = 0;
ALTER ROLE authenticator SET lock_timeout = '30s';
