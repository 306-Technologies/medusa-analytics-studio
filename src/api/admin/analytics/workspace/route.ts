import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { ANALYTICS_WORKSPACE_MODULE } from "../../../../modules/analytics-workspace"
import type AnalyticsWorkspaceService from "../../../../modules/analytics-workspace/service"
import { MAX_SAVED_REPORTS } from "../../../../shared/analytics/saved-report-limit"
import type { WorkspaceResponse } from "../../../../shared/analytics/types"
import { toSavedWidgets } from "../../../projections/analytics-dashboard"
import { toSavedReport } from "../../../projections/analytics-report"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<WorkspaceResponse>
) => {
  const userId = req.auth_context.actor_id
  const service: AnalyticsWorkspaceService = req.scope.resolve(
    ANALYTICS_WORKSPACE_MODULE
  )
  if (await service.isReadOnly()) {
    res.status(200).json({ reports: [], dashboard: null, read_only: true })
    return
  }

  const [reports, dashboard] = await Promise.all([
    service.listAnalyticsReports(
      { user_id: userId },
      { order: { updated_at: "DESC" }, take: MAX_SAVED_REPORTS }
    ),
    service.findUserDashboard(userId),
  ])

  res.status(200).json({
    reports: reports.map(toSavedReport),
    dashboard: toSavedWidgets(dashboard),
    read_only: false,
  })
}
