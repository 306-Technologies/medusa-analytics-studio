import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import { analyticsLog } from "../../../../shared/analytics/log"
import { formatQuery } from "../../../../shared/analytics/query-language"
import { cached, cacheKey } from "../../../../shared/analytics/report-cache"
import {
  getAnalyticsDb,
  resolveReportSettings,
} from "../../../../shared/analytics/report-context"
import type { ReportResult } from "../../../../shared/analytics/types"
import type { RunReportQuery } from "../../../../schemas/analytics"

const REPORT_TTL_SECONDS = 15 * 60
const REBUILDING_TTL_SECONDS = 60

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, RunReportQuery>,
  res: MedusaResponse<ReportResult>
) => {
  const log = analyticsLog(
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    "report"
  )
  const started = Date.now()
  const reader = getAnalyticsDb(req.scope)
  const report = await reader
    .prepareReport(req.validatedQuery.q, await resolveReportSettings(req.scope))
    .catch((error: unknown) => {
      if (error instanceof MedusaError) {
        log.debug(`Report not run: ${error.message}`)
      }
      throw error
    })
  // The d/g version prefix keeps keys from before per-day versions from ever matching.
  const key = cacheKey(
    "report",
    [
      report.version,
      report.timezone,
      report.currency,
      ...report.ranges.flatMap((range) => [range.since, range.until]),
    ],
    formatQuery(report.query)
  )
  const { value: result, hit } = await cached(
    req.scope,
    key,
    report.state.progress === null
      ? REPORT_TTL_SECONDS
      : REBUILDING_TTL_SECONDS,
    () => reader.runPrepared(report)
  )
  const { metrics, dimensions } = report.query
  log.debug(
    `Report ${hit ? "served from cache" : "ran"} in ${Date.now() - started}ms from ${result.source}${result.rebuilding ? " (rebuilding)" : ""}: show ${metrics.join(", ")}${
      dimensions.length ? ` by ${dimensions.join(", ")}` : ""
    }, ${result.range.since} to ${result.range.until}, ${result.rows.length} rows`
  )
  res.status(200).json(result)
}
