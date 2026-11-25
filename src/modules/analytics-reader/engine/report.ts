import { MedusaError } from "@medusajs/framework/utils"

import {
  parseQuery,
  type ReportQuery,
} from "../../../shared/analytics/query-language"
import type { ReportResult } from "../../../shared/analytics/types"
import {
  cacheVersion,
  type DayRange,
  type FactState,
  readFactState,
} from "./plan"
import { type Bounds, resolveBounds, runReport } from "./run-report"
import type { SqlRunner } from "./sql-runner"

export type ReportSettings = { currency: string; timezone: string }

export type PreparedReport = {
  query: ReportQuery
  currency: string
  timezone: string
  state: FactState
  bounds: Bounds
  ranges: DayRange[]
  version: string
}

export const prepareReport = async (
  pg: SqlRunner,
  text: string,
  settings: ReportSettings
): Promise<PreparedReport> => {
  const parsed = parseQuery(text)
  if (!parsed.ok) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error)
  }
  const state = await readFactState(pg)
  const timezone = state.timezone ?? settings.timezone
  const bounds = await resolveBounds(pg, parsed.query, timezone)
  const ranges = [
    { since: bounds.since_day, until: bounds.until_day },
    ...(bounds.cmp_since_day && bounds.cmp_until_day
      ? [{ since: bounds.cmp_since_day, until: bounds.cmp_until_day }]
      : []),
  ]
  return {
    query: parsed.query,
    currency: settings.currency,
    timezone,
    state,
    bounds,
    ranges,
    version: await cacheVersion(pg, state, ranges),
  }
}

export const runPrepared = (
  pg: SqlRunner,
  report: PreparedReport
): Promise<ReportResult> =>
  runReport(
    pg,
    report.query,
    report.currency,
    report.timezone,
    report.state.ready,
    report.bounds,
    report.state
  )
