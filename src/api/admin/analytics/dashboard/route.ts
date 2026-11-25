import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import type { SaveDashboardBody } from "../../../../schemas/analytics"
import type {
  DeleteResponse,
  SaveDashboardResponse,
} from "../../../../shared/analytics/types"
import { resetAnalyticsDashboardWorkflow } from "../../../../workflows/reset-analytics-dashboard"
import { saveAnalyticsDashboardWorkflow } from "../../../../workflows/save-analytics-dashboard"
import { toSavedWidgets } from "../../../projections/analytics-dashboard"

export const POST = async (
  req: AuthenticatedMedusaRequest<SaveDashboardBody>,
  res: MedusaResponse<SaveDashboardResponse>
) => {
  const { result } = await saveAnalyticsDashboardWorkflow(req.scope).run({
    input: {
      user_id: req.auth_context.actor_id,
      widgets: req.validatedBody.widgets,
    },
  })

  res.status(200).json({ dashboard: toSavedWidgets(result) ?? [] })
}

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<DeleteResponse>
) => {
  const userId = req.auth_context.actor_id
  const { result } = await resetAnalyticsDashboardWorkflow(req.scope).run({
    input: { user_id: userId },
  })

  res.status(200).json({ id: userId, deleted: result })
}
