import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto"

import { REPORTING_SCHEMA } from "../../shared/analytics/reporting-view"
import {
  lockStatements,
  SQL_SETUP_LOCK,
} from "../../shared/analytics/lock-keys"

// A view runs with its owner's rights, so the role only sees the columns its views return.

export const REPORTING_ROLE = "reporting_reader"

export const ROLE_STATEMENT_TIMEOUT = "30s"
/** Must be at least instances x ANALYTICS_SQL_POOL_MAX, or the last instances to start get refused. */
export const DEFAULT_ROLE_CONNECTION_LIMIT = 5
export const DEFAULT_POOL_MAX = 2

export const SETUP_COMMAND = "yarn medusa exec ./src/scripts/setup-sql-role.ts"

const SCRAM_ITERATIONS = 4096

/** Sent instead of the password so the password never reaches Postgres or a statement log. */
export const scramVerifier = (password: string): string => {
  const salt = randomBytes(16)
  const salted = pbkdf2Sync(password, salt, SCRAM_ITERATIONS, 32, "sha256")
  const clientKey = createHmac("sha256", salted).update("Client Key").digest()
  const storedKey = createHash("sha256").update(clientKey).digest()
  const serverKey = createHmac("sha256", salted).update("Server Key").digest()
  return `SCRAM-SHA-256$${SCRAM_ITERATIONS}:${salt.toString("base64")}$${storedKey.toString(
    "base64"
  )}:${serverKey.toString("base64")}`
}

/** Printable ASCII only: Postgres applies SASLprep before hashing, which scramVerifier does not. */
export const isUsablePassword = (password: string) =>
  password.length >= 16 && /^[\x21-\x7e]+$/.test(password)

/** The verifier is base64 and "$:" only, so it is safe inside the quotes. */
export const setupRoleStatements = (
  verifier: string,
  connectionLimit: number
): string[] => [
  ...lockStatements(SQL_SETUP_LOCK),
  `create schema if not exists ${REPORTING_SCHEMA}`,
  `do $$ begin
     if not exists (select from pg_roles where rolname = '${REPORTING_ROLE}') then
       create role ${REPORTING_ROLE} nologin;
     end if;
   end $$`,
  `alter role ${REPORTING_ROLE} with login connection limit ${
    Number.isInteger(connectionLimit) && connectionLimit > 0
      ? connectionLimit
      : DEFAULT_ROLE_CONNECTION_LIMIT
  } password '${verifier}'`,
  `alter role ${REPORTING_ROLE} set default_transaction_read_only = on`,
  `alter role ${REPORTING_ROLE} set statement_timeout = '${ROLE_STATEMENT_TIMEOUT}'`,
  `alter role ${REPORTING_ROLE} set idle_in_transaction_session_timeout = '60s'`,
  `grant usage on schema ${REPORTING_SCHEMA} to ${REPORTING_ROLE}`,
]

export const isListedView = (
  name: string,
  patterns: readonly string[]
): boolean =>
  patterns.some((pattern) =>
    pattern.endsWith("*")
      ? name.startsWith(pattern.slice(0, -1))
      : name === pattern
  )

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`

/** Revokes everything in the schema first (including earlier versions' blanket grants), then grants the listed views. */
export const grantStatements = (
  views: readonly string[],
  patterns: readonly string[]
): string[] => [
  ...lockStatements(SQL_SETUP_LOCK),
  `alter default privileges in schema ${REPORTING_SCHEMA} revoke all on tables from ${REPORTING_ROLE}`,
  `revoke all on all tables in schema ${REPORTING_SCHEMA} from ${REPORTING_ROLE}`,
  ...views
    .filter((view) => isListedView(view, patterns))
    .map(
      (view) =>
        `grant select on ${REPORTING_SCHEMA}.${quoted(view)} to ${REPORTING_ROLE}`
    ),
]

/** Includes column grants, sequences, PUBLIC and inherited roles; pg_read_all_data shows as one row. */
export const readableRelationsSql = `
  select n.nspname::text as schema, c.relname::text as name, c.relkind::text as kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
    and c.relkind in ('r', 'v', 'm', 'f', 'p', 'S')
    and case when c.relkind = 'S'
      then has_sequence_privilege('${REPORTING_ROLE}', c.oid, 'select')
      else has_table_privilege('${REPORTING_ROLE}', c.oid, 'select')
        or has_any_column_privilege('${REPORTING_ROLE}', c.oid, 'select')
    end
  union all
  select 'pg_catalog'::text, 'pg_read_all_data'::text, 'role'::text
  from pg_catalog.pg_roles r
  where r.rolname = 'pg_read_all_data'
    and pg_has_role('${REPORTING_ROLE}', r.oid, 'member')
  order by 1, 2`

/** Neon's "-pooler" host is swapped for the direct one: a pooler shares connections between sessions. */
export const reportingUrlFor = (
  analyticsUrl: string,
  password: string
): string => {
  const url = new URL(analyticsUrl)
  url.username = REPORTING_ROLE
  // The setter leaves "%" as is, so encode first or "%" breaks the URL.
  url.password = encodeURIComponent(password)
  url.hostname = url.hostname.replace(/^([^.]+)-pooler\./, "$1.")
  return url.toString()
}
