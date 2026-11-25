import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import type { SaveReportBody } from "../../../../schemas/analytics"
import type { SaveReportResponse } from "../../../../shared/analytics/types"
import { saveAnalyticsReportWorkflow } from "../../../../workflows/save-analytics-report"
import { toSavedReport } from "../../../projections/analytics-report"

export const POST = async (
  req: AuthenticatedMedusaRequest<SaveReportBody>,
  res: MedusaResponse<SaveReportResponse>
) => {
  const { result } = await saveAnalyticsReportWorkflow(req.scope).run({
    input: { user_id: req.auth_context.actor_id, ...req.validatedBody },
  })

  res.status(200).json({ report: toSavedReport(result) })
}
