import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { ANALYTICS_SQL_MODULE } from "../../../../../modules/analytics-sql"
import type AnalyticsSqlService from "../../../../../modules/analytics-sql/service"
import type { SqlStatusResponse } from "../../../../../shared/analytics/types"
import {
  getAnalyticsDb,
  resolveReportSettings,
} from "../../../../../shared/analytics/report-context"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<SqlStatusResponse>
) => {
  const sql = req.scope.resolve<AnalyticsSqlService>(ANALYTICS_SQL_MODULE)
  const [state, settings] = await Promise.all([
    getAnalyticsDb(req.scope).factState(),
    resolveReportSettings(req.scope),
  ])
  res.status(200).json({
    ...sql.status(),
    facts: {
      rebuilding: !state.ready || state.pendingTimezone !== null,
      filling: !state.ready,
      pending_timezone: state.pendingTimezone,
      progress: state.progress,
      range: { timezone: state.timezone ?? settings.timezone },
    },
  })
}
