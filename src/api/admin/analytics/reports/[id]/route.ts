import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import type { DeleteResponse } from "../../../../../shared/analytics/types"
import { deleteAnalyticsReportWorkflow } from "../../../../../workflows/delete-analytics-report"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<DeleteResponse>
) => {
  await deleteAnalyticsReportWorkflow(req.scope).run({
    input: { user_id: req.auth_context.actor_id, id: req.params.id },
  })

  res.status(200).json({ id: req.params.id, deleted: true })
}
