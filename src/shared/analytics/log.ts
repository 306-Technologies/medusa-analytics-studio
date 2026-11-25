import type { Logger } from "@medusajs/framework/types"

import { REPORTING_TIMEZONE_KEY, reportingTimezoneOf } from "./timezone"

// Log ids and counts only: never customer details, query bindings or connection strings.

export type AnalyticsLogArea =
  | "reader"
  | "report"
  | "live"
  | "settings"
  | "workspace"
  | "facts"
  | "backfill"
  | "fx"
  | "infrastructure"
  | "drain"
  | "reconcile"
  | "events"
  | "cache"
  | "sql"

export type AnalyticsLogger = {
  debug: (message: string) => void
  info: (message: string) => void
  warn: (message: string, error?: unknown) => void
  error: (message: string, error?: unknown) => void
}

export const errorText = (error: unknown): string =>
  error instanceof Error ? (error.stack ?? error.message) : String(error)

export const analyticsLog = (
  logger: Logger,
  area: AnalyticsLogArea
): AnalyticsLogger => {
  const prefix = `[analytics:${area}]`
  return {
    debug: (message) => logger.debug(`${prefix} ${message}`),
    info: (message) => logger.info(`${prefix} ${message}`),
    warn: (message, error) =>
      logger.warn(
        `${prefix} ${message}${error === undefined ? "" : `: ${errorText(error)}`}`
      ),
    error: (message, error) =>
      error instanceof Error
        ? logger.error(`${prefix} ${message}`, error)
        : logger.error(
            `${prefix} ${message}${error === undefined ? "" : `: ${String(error)}`}`
          ),
  }
}

const reportedTimezones = new Set<string>()

export const reportingTimezoneLogged = (
  log: AnalyticsLogger,
  metadata: Record<string, unknown> | null | undefined
): string => {
  const timezone = reportingTimezoneOf(metadata)
  const saved = metadata?.[REPORTING_TIMEZONE_KEY]
  if (saved !== undefined && saved !== timezone) {
    const key = String(saved)
    if (!reportedTimezones.has(key)) {
      reportedTimezones.add(key)
      log.warn(
        `Store reporting timezone "${key}" is not a known timezone, reports use ${timezone}`
      )
    }
  }
  return timezone
}
