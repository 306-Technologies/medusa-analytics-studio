import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { ANALYTICS_SQL_MODULE } from "../../../../../modules/analytics-sql"
import type AnalyticsSqlService from "../../../../../modules/analytics-sql/service"
import type { SqlViewsResponse } from "../../../../../shared/analytics/types"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<SqlViewsResponse>
) => {
  const sql = req.scope.resolve<AnalyticsSqlService>(ANALYTICS_SQL_MODULE)
  res.status(200).json({ views: await sql.views() })
}
