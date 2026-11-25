import type { Logger } from "@medusajs/framework/types"
import { MedusaError, ModulesSdkUtils } from "@medusajs/framework/utils"
import { Client, Pool } from "pg"

import { analyticsLog, type AnalyticsLogger } from "../../shared/analytics/log"
import { REPORTING_SCHEMA } from "../../shared/analytics/reporting-view"
import {
  DEFAULT_POOL_MAX,
  DEFAULT_ROLE_CONNECTION_LIMIT,
  grantStatements,
  isListedView,
  isUsablePassword,
  readableRelationsSql,
  REPORTING_ROLE,
  reportingUrlFor,
  scramVerifier,
  SETUP_COMMAND,
  setupRoleStatements,
} from "./reporting-role"
import type { SqlView } from "../../shared/analytics/types"
import { listViews } from "./list-views"
import { runQuery, type SqlRun, sqlTypes, toMedusaError } from "./run-query"

export type AnalyticsSqlOptions = {
  analyticsDatabaseUrl?: string
  mainDatabaseUrl?: string
  password?: string
  disabled: boolean
  allowPrimary?: boolean
  poolMax?: number
  connectionLimit?: number
  reportingViews?: string[]
  ssl: boolean
}

export type SqlModeStatus = {
  enabled: boolean
  reason: string | null
}

type SqlModeState = { enabled: true } | { enabled: false; reason: string }

type PgClient = {
  query: (sql: string, callback: (error: Error | null) => void) => void
}

type Knex = ReturnType<typeof ModulesSdkUtils.createPgConnection>

type RecoveryRow = { in_recovery: boolean }
type RoleRow = { role_exists: boolean; can_create_roles: boolean }
type ViewRow = { name: string }
type ReadableRow = { schema: string; name: string; kind: string }
type RawRunner = {
  raw: (sql: string, bindings: string[]) => PromiseLike<unknown>
}

const APPLICATION_NAME = "analytics-sql"
const CONNECT_TIMEOUT_MS = 10_000
const RECHECK_MS = 60_000
/** The role replicates from the primary within about a second; the first check retries that long. */
const FIRST_CHECK_ATTEMPTS = 5
const FIRST_CHECK_DELAY_MS = 1_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isErrorWithCode = (error: unknown): error is { code: string } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string"

// The knex error message holds the statement, which can carry the role's SCRAM verifier, so only the code is logged.
const pgErrorCode = (error: unknown): string =>
  isErrorWithCode(error) ? `Postgres error ${error.code}` : "unknown error"

export default class AnalyticsSqlService {
  private readonly log: AnalyticsLogger
  private readonly options: AnalyticsSqlOptions
  private state: SqlModeState = { enabled: false, reason: "starting" }
  private pool: Pool | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor({ logger }: { logger: Logger }, options: AnalyticsSqlOptions) {
    this.log = analyticsLog(logger, "sql")
    this.options = options
  }

  status(): SqlModeStatus {
    return this.state.enabled
      ? { enabled: true, reason: null }
      : { enabled: false, reason: this.state.reason }
  }

  listedViews(): string[] {
    // No list means no views: nothing is readable until it is listed.
    return this.options.reportingViews ?? []
  }

  async views(): Promise<SqlView[]> {
    if (!this.state.enabled || !this.pool) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "SQL mode is off")
    }
    try {
      return await listViews(this.pool)
    } catch (error) {
      this.log.warn("Listing the reporting views failed", error)
      throw toMedusaError(error)
    }
  }

  async run(sql: string): Promise<SqlRun> {
    if (!this.state.enabled || !this.pool) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "SQL mode is off")
    }
    try {
      return await runQuery(this.pool, sql)
    } catch (error) {
      const mapped = toMedusaError(error)
      if (mapped.type === MedusaError.Types.UNEXPECTED_STATE) {
        this.log.warn(
          "A SQL-mode query failed for a reason other than the SQL",
          error
        )
      }
      throw mapped
    }
  }

  private configProblem(): string | null {
    const { disabled, password, analyticsDatabaseUrl, mainDatabaseUrl } =
      this.options
    if (disabled !== false) {
      return disabled === true
        ? "turned off for this deployment"
        : "the disabled option is not set to true or false"
    }
    if (!password) {
      return "ANALYTICS_SQL_PASSWORD not set"
    }
    if (!isUsablePassword(password)) {
      return "ANALYTICS_SQL_PASSWORD must be at least 16 printable ASCII characters, no spaces"
    }
    if (!analyticsDatabaseUrl && !this.options.allowPrimary) {
      return "ANALYTICS_DATABASE_URL (a read replica) not set; or set ANALYTICS_SQL_ALLOW_PRIMARY=true to use the primary"
    }
    if (!mainDatabaseUrl) {
      return "DATABASE_URL not set"
    }
    return null
  }

  private readUrl(): string | undefined {
    return (
      this.options.analyticsDatabaseUrl ??
      (this.options.allowPrimary ? this.options.mainDatabaseUrl : undefined)
    )
  }

  private setState(next: SqlModeState, error?: unknown) {
    const previous = this.state
    this.state = next
    if (next.enabled) {
      if (!previous.enabled) {
        this.log.info("SQL mode on")
      }
      return
    }
    if (previous.enabled || previous.reason !== next.reason) {
      const message = `SQL mode off: ${next.reason}`
      if (error === undefined) {
        this.log.info(message)
      } else {
        this.log.warn(message, error)
      }
    }
  }

  private connect(url: string, max: number): Knex {
    return ModulesSdkUtils.createPgConnection({
      clientUrl: url,
      driverOptions: {
        connection: {
          ssl: this.options.ssl ? { rejectUnauthorized: false } : false,
        },
      },
      pool: {
        min: 0,
        max,
        afterCreate: (
          connection: PgClient,
          done: (error: Error | null, connection: PgClient) => void
        ) => {
          connection.query(
            `set application_name = '${APPLICATION_NAME}'`,
            (error) => done(error, connection)
          )
        },
      },
    })
  }

  setupStatements(): string[] {
    const password = this.options.password
    if (!password || !isUsablePassword(password)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ANALYTICS_SQL_PASSWORD must be set to 16+ printable ASCII characters, no spaces"
      )
    }
    return setupRoleStatements(
      scramVerifier(password),
      this.options.connectionLimit ?? DEFAULT_ROLE_CONNECTION_LIMIT
    )
  }

  private async roleState(runner: RawRunner): Promise<RoleRow | null> {
    const result = (await runner.raw(
      `select exists (select from pg_roles where rolname = ?) as role_exists,
              (select rolcreaterole or rolsuper from pg_roles where rolname = current_user)
                as can_create_roles`,
      [REPORTING_ROLE]
    )) as { rows: RoleRow[] }
    return result.rows[0] ?? null
  }

  private async applySetup(primary: Knex): Promise<void> {
    const statements = this.setupStatements()
    await primary.transaction(async (trx) => {
      for (const statement of statements) {
        await trx.raw(statement)
      }
    })
  }

  async setUpRole(): Promise<string | null> {
    const { mainDatabaseUrl } = this.options
    if (!mainDatabaseUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "DATABASE_URL not set"
      )
    }
    const primary = this.connect(mainDatabaseUrl, 1)
    try {
      try {
        await this.applySetup(primary)
      } catch (error) {
        if (error instanceof MedusaError) {
          throw error
        }
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          `Could not set up ${REPORTING_ROLE} (${pgErrorCode(error)})`
        )
      }
      this.log.info(
        `Role ${REPORTING_ROLE} and schema ${REPORTING_SCHEMA} set up on the primary`
      )
      return await this.syncGrants(primary)
    } finally {
      await primary.destroy()
    }
  }

  /** Only 28P01 is "wrong"; anything else is "unknown" so boot doesn't rewrite the role over an outage. */
  private async passwordState(): Promise<"ok" | "wrong" | "unknown"> {
    const { mainDatabaseUrl, password } = this.options
    if (!mainDatabaseUrl || !password) {
      return "unknown"
    }
    const client = new Client({
      connectionString: reportingUrlFor(mainDatabaseUrl, password),
      ssl: this.options.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      application_name: APPLICATION_NAME,
    })
    try {
      await client.connect()
      return "ok"
    } catch (error) {
      return isErrorWithCode(error) && error.code === "28P01"
        ? "wrong"
        : "unknown"
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  /** Runs CREATE/ALTER ROLE only when needed: each ALTER writes the SCRAM verifier, which a host logging DDL would keep. */
  private async ensureRole(primary: Knex): Promise<void> {
    const before = await this.roleState(primary)
    if (!before?.can_create_roles) {
      return
    }
    const reason = !before.role_exists
      ? "created"
      : (await this.passwordState()) === "wrong"
        ? "given the new ANALYTICS_SQL_PASSWORD"
        : null
    if (!reason) {
      return
    }
    try {
      await this.applySetup(primary)
      this.log.info(`Role ${REPORTING_ROLE} ${reason} on the primary at boot`)
    } catch (error) {
      this.log.warn(
        `Could not set up ${REPORTING_ROLE} at boot (${pgErrorCode(error)}); a database admin can run the output of ${SETUP_COMMAND} print`
      )
    }
  }

  private async syncGrants(primary: Knex): Promise<string | null> {
    return await primary.transaction(async (trx) => {
      const row = await this.roleState(trx)
      if (!row?.role_exists) {
        return row?.can_create_roles
          ? `the ${REPORTING_ROLE} role couldn't be set up at boot (see the warning above): run ${SETUP_COMMAND}`
          : `the ${REPORTING_ROLE} role isn't set up, and this app's database user can't create roles: have a database admin run the statements from ${SETUP_COMMAND} print`
      }
      const views = (await trx.raw(
        `select c.relname as name
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname = ? and c.relkind in ('v', 'm')
         order by 1`,
        [REPORTING_SCHEMA]
      )) as { rows: ViewRow[] }
      const listed = this.listedViews()
      for (const statement of grantStatements(
        views.rows.map((view) => view.name),
        listed
      )) {
        try {
          await trx.transaction(async (savepoint) => {
            await savepoint.raw(statement)
          })
        } catch (error) {
          this.log.warn(
            `Could not apply a reporting view grant: ${statement}`,
            error
          )
        }
      }

      // Fail closed: anything readable that isn't a listed view keeps SQL mode off.
      const readable = (await trx.raw(readableRelationsSql)) as {
        rows: ReadableRow[]
      }
      const extra = this.readProblem(readable.rows)
      if (extra) {
        return extra
      }
      if (this.readsPrimary()) {
        const unsafe = await this.primaryProblem(trx)
        if (unsafe) {
          return unsafe
        }
      }
      this.log.debug(
        `Reporting views readable in SQL mode: ${
          readable.rows.map((row) => `${row.schema}.${row.name}`).join(", ") ||
          "none"
        }`
      )
      return null
    })
  }

  private async check(): Promise<{ state: SqlModeState; error?: unknown }> {
    if (!this.pool) {
      return { state: { enabled: false, reason: "not set up" } }
    }
    try {
      const result = await this.pool.query<RecoveryRow>(
        "select pg_is_in_recovery() as in_recovery"
      )
      // Rechecked every minute: a later grant (PUBLIC, columns, pg_read_all_data) turns SQL mode off.
      const readable = await this.pool.query<ReadableRow>(readableRelationsSql)
      const extra = this.readProblem(readable.rows)
      if (extra) {
        return { state: { enabled: false, reason: extra } }
      }
      return result.rows[0]?.in_recovery === true || this.readsPrimary()
        ? { state: { enabled: true } }
        : {
            state: {
              enabled: false,
              reason:
                "ANALYTICS_DATABASE_URL is not a read replica (set ANALYTICS_SQL_ALLOW_PRIMARY=true to allow the primary)",
            },
          }
    } catch (error) {
      return {
        state: {
          enabled: false,
          reason: `could not connect as ${REPORTING_ROLE} (after a new ANALYTICS_SQL_PASSWORD the app updates the role at boot when its database user can create roles; otherwise a database admin runs ${SETUP_COMMAND} print again)`,
        },
        error,
      }
    }
  }

  private readProblem(rows: ReadableRow[]): string | null {
    const listed = this.listedViews()
    const allowed = (row: ReadableRow) =>
      row.schema === REPORTING_SCHEMA &&
      (row.kind === "v" || row.kind === "m") &&
      isListedView(row.name, listed)
    const extra = rows.filter((row) => !allowed(row))
    if (!extra.length) {
      return null
    }
    const shown = extra.slice(0, 5).map((row) => `${row.schema}.${row.name}`)
    return `${REPORTING_ROLE} can read ${shown.join(", ")}${
      extra.length > shown.length
        ? ` and ${extra.length - shown.length} more`
        : ""
    }, which reportingViews doesn't list; revoke that access (from public and from ${REPORTING_ROLE}, as the owner) or list the view`
  }

  /** The role must not be able to create objects where the app's own queries could pick them up (public on Postgres 14 or older). */
  private async primaryProblem(trx: RawRunner): Promise<string | null> {
    const result = (await trx.raw(
      `select n.nspname as name
       from pg_catalog.pg_namespace n
       where n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
         and has_schema_privilege(?, n.oid, 'create')`,
      [REPORTING_ROLE]
    )) as { rows: ViewRow[] }
    const schemas = result.rows.map((row) => row.name)
    return schemas.length
      ? `${REPORTING_ROLE} can create objects in ${schemas.join(", ")}, unsafe on the primary: revoke CREATE on schema ${schemas.join(", ")} from public and from ${REPORTING_ROLE} (or turn ANALYTICS_SQL_ALLOW_PRIMARY off)`
      : null
  }

  private readsPrimary(): boolean {
    return Boolean(this.options.allowPrimary)
  }

  private async start() {
    const { mainDatabaseUrl, password } = this.options
    const readUrl = this.readUrl()
    if (!readUrl || !mainDatabaseUrl || !password) {
      return
    }

    const primary = this.connect(mainDatabaseUrl, 1)
    try {
      await this.ensureRole(primary)
      const problem = await this.syncGrants(primary)
      if (problem) {
        this.setState({ enabled: false, reason: problem })
        return
      }
    } catch (error) {
      this.setState(
        {
          enabled: false,
          reason: "could not set the reporting view grants on the primary",
        },
        error
      )
      return
    } finally {
      await primary.destroy()
    }

    this.pool = new Pool({
      connectionString: reportingUrlFor(readUrl, password),
      // A connection string with sslmode set wins over this, as in pg.
      ssl: this.options.ssl ? { rejectUnauthorized: false } : undefined,
      max: this.options.poolMax ?? DEFAULT_POOL_MAX,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
      application_name: APPLICATION_NAME,
      types: sqlTypes,
    })
    // Without a listener, an idle connection dropped by the replica would crash the process.
    this.pool.on("error", (error) =>
      this.log.warn("An idle SQL-mode connection failed", error)
    )

    let first = await this.check()
    for (
      let attempt = 1;
      !first.state.enabled && first.error && attempt < FIRST_CHECK_ATTEMPTS;
      attempt++
    ) {
      await sleep(FIRST_CHECK_DELAY_MS)
      first = await this.check()
    }
    this.setState(first.state, first.error)

    this.timer = setInterval(() => {
      void this.check().then(({ state, error }) => this.setState(state, error))
    }, RECHECK_MS)
    // Never keeps a one-off command (db:migrate, exec) running.
    this.timer.unref()
  }

  __hooks = {
    onApplicationStart: async () => {
      const problem = this.configProblem()
      if (problem) {
        this.setState({ enabled: false, reason: problem })
        return
      }
      void this.start().catch((error: unknown) =>
        this.setState({ enabled: false, reason: "setup failed" }, error)
      )
    },
    onApplicationShutdown: async () => {
      if (this.timer) {
        clearInterval(this.timer)
      }
      try {
        await this.pool?.end()
      } catch (error) {
        this.log.warn("Closing the SQL pool failed", error)
      }
    },
  }
}
