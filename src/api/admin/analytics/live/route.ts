import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { LIVE_TTL_SECONDS } from "../../../../modules/analytics-reader/engine/live"
import { cacheVersion } from "../../../../modules/analytics-reader/engine/plan"
import { analyticsLog } from "../../../../shared/analytics/log"
import {
  cached,
  cacheKey,
  localToday,
} from "../../../../shared/analytics/report-cache"
import {
  getAnalyticsDb,
  resolveReportSettings,
} from "../../../../shared/analytics/report-context"
import type { LiveResponse } from "../../../../shared/analytics/types"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<LiveResponse>
) => {
  const started = Date.now()
  const reader = getAnalyticsDb(req.scope)
  const settings = await resolveReportSettings(req.scope)
  const { currency } = settings
  const state = await reader.factState()
  // The tables' timezone: it differs from the store's until a rebuild is swapped in.
  const timezone = state.timezone ?? settings.timezone
  const day = localToday(timezone)
  const version = await cacheVersion(reader, state, [
    { since: day, until: day },
  ])

  const { value, hit } = await cached(
    req.scope,
    cacheKey("live", [version, timezone, currency, day]),
    LIVE_TTL_SECONDS,
    () => reader.live(settings, day, state)
  )

  analyticsLog(
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    "live"
  ).debug(
    `Live view ${hit ? "served from cache" : `built${state.ready ? "" : " empty (first fill)"}`} in ${
      Date.now() - started
    }ms (${timezone}, ${value.today.orders} orders today)`
  )
  res.status(200).json(value)
}
