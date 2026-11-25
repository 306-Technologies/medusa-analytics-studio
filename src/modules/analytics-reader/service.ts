import type { ConfigModule, Logger } from "@medusajs/framework/types"
import { MedusaError, ModulesSdkUtils } from "@medusajs/framework/utils"

import { analyticsLog, type AnalyticsLogger } from "../../shared/analytics/log"
import type { LiveResponse, ReportResult } from "../../shared/analytics/types"
import {
  buildLive,
  cartsNow,
  NO_ROWS_TODAY,
  todayFromFacts,
} from "./engine/live"
import { type FactState, readFactState } from "./engine/plan"
import { type AnalyticsReaderOptions, resolveReaderOptions } from "./options"
import {
  assertReadStatement,
  isReadOnlyResult,
  READ_ONLY_CHECK,
  readOnlySetup,
} from "./read-only"
import {
  type PreparedReport,
  prepareReport,
  type ReportSettings,
  runPrepared,
} from "./engine/report"

// Connections are read-only: ANALYTICS_DATABASE_URL may be a replica, so writes use the main connection.

export type SqlBinding = string | number | boolean | Date | null

type Rows = { rows: Record<string, unknown>[] }

type PgClient = {
  query: (
    sql: string,
    callback: (error: Error | null, result?: unknown) => void
  ) => void
}

const APPLICATION_NAME = "analytics"

const SLOW_QUERY_MS = 2_000

// Postgres' code for a query cancelled by statement_timeout.
const QUERY_CANCELED = "57014"

const describe = (sql: string) => {
  const flat = sql.replace(/\s+/g, " ").trim()
  return flat.length > 120 ? `${flat.slice(0, 120)}...` : flat
}

const pgCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined

export default class AnalyticsReaderService {
  private readonly knex: ReturnType<typeof ModulesSdkUtils.createPgConnection>
  private readonly log: AnalyticsLogger
  private readonly timeoutMs: number

  constructor(
    { logger, configModule }: { logger: Logger; configModule?: ConfigModule },
    rawOptions?: AnalyticsReaderOptions
  ) {
    this.log = analyticsLog(logger, "reader")
    const options = resolveReaderOptions(rawOptions)
    const timeout = options.statementTimeoutMs
    this.timeoutMs = timeout
    // Medusa's test runner points projectConfig.databaseUrl at its throwaway database; DATABASE_URL does not.
    const clientUrl = options.separateDatabase
      ? options.databaseUrl
      : (configModule?.projectConfig.databaseUrl ?? options.databaseUrl)
    if (!clientUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "analyticsReader: no database to read from (set databaseUrl)"
      )
    }

    this.knex = ModulesSdkUtils.createPgConnection({
      clientUrl,
      driverOptions: {
        connection: {
          ssl: options.ssl ? { rejectUnauthorized: false } : false,
        },
      },
      pool: {
        min: 0,
        max: options.poolMax,
        // SET overrides an application_name given in the URL.
        afterCreate: (
          connection: PgClient,
          done: (error: Error | null, connection: PgClient) => void
        ) => {
          connection.query(
            readOnlySetup(timeout, APPLICATION_NAME),
            (error) => {
              if (error) {
                done(error, connection)
                return
              }
              connection.query(READ_ONLY_CHECK, (checkError, result) => {
                done(
                  checkError ??
                    (isReadOnlyResult(result)
                      ? null
                      : new Error("analytics connection is not read-only")),
                  connection
                )
              })
            }
          )
        },
      },
    })

    this.log.info(
      `Read pool ready: up to ${options.poolMax} connections, ${timeout}ms statement timeout, reading ${
        options.separateDatabase
          ? "ANALYTICS_DATABASE_URL"
          : "the main database (ANALYTICS_DATABASE_URL not set)"
      }`
    )
  }

  private async readOnlyQuery(
    sql: string,
    bindings: SqlBinding[]
  ): Promise<Rows> {
    const trx = await this.knex.transaction()
    try {
      await trx.raw("set transaction read only")
      await trx.raw(`set local statement_timeout = ${this.timeoutMs}`)
      const result: Rows = await trx.raw(sql, bindings)
      await trx.commit()
      return result
    } catch (error) {
      await trx.rollback().catch(() => undefined)
      throw error
    }
  }

  async raw(sql: string, bindings: SqlBinding[]): Promise<Rows> {
    assertReadStatement(sql)
    const started = Date.now()
    try {
      const result = await this.readOnlyQuery(sql, bindings)
      const ms = Date.now() - started
      if (ms >= SLOW_QUERY_MS) {
        this.log.warn(`Slow query took ${ms}ms: ${describe(sql)}`)
      } else {
        this.log.debug(`Query took ${ms}ms, ${result.rows.length} rows`)
      }
      return result
    } catch (error) {
      const ms = Date.now() - started
      if (pgCode(error) === QUERY_CANCELED) {
        this.log.warn(
          `Query cancelled by the ${this.timeoutMs}ms statement timeout: ${describe(sql)}`
        )
      } else if (
        error instanceof Error &&
        error.message.includes("Timeout acquiring a connection")
      ) {
        this.log.warn(
          `Pool full: no free analytics connection after ${ms}ms (raise ANALYTICS_POOL_MAX if this repeats)`
        )
      } else {
        this.log.error(`Query failed after ${ms}ms: ${describe(sql)}`, error)
      }
      throw error
    }
  }

  async factState(): Promise<FactState> {
    return await readFactState(this)
  }

  async prepareReport(
    text: string,
    settings: ReportSettings
  ): Promise<PreparedReport> {
    return await prepareReport(this, text, settings)
  }

  async runPrepared(report: PreparedReport): Promise<ReportResult> {
    return await runPrepared(this, report)
  }

  async runReport(
    text: string,
    settings: ReportSettings
  ): Promise<ReportResult> {
    return await this.runPrepared(await this.prepareReport(text, settings))
  }

  async live(
    settings: ReportSettings,
    day: string,
    state: FactState
  ): Promise<LiveResponse> {
    const timezone = state.timezone ?? settings.timezone
    const [rows, carts] = await Promise.all([
      state.ready
        ? todayFromFacts(this, settings.currency, day)
        : NO_ROWS_TODAY,
      cartsNow(this),
    ])
    return {
      ...buildLive(rows, carts, settings.currency, timezone),
      filling: !state.ready,
    }
  }

  __hooks = {
    onApplicationShutdown: async () => {
      try {
        await this.knex.destroy()
        this.log.info("Read pool closed")
      } catch (error) {
        this.log.warn("Closing the read pool failed", error)
      }
    },
  }
}
