import { createHash } from "node:crypto"

import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ANALYTICS_SQL_MODULE } from "../../../../modules/analytics-sql"
import { sqlErrorCode } from "../../../../modules/analytics-sql/run-query"
import type AnalyticsSqlService from "../../../../modules/analytics-sql/service"
import type { RunSqlBody } from "../../../../schemas/analytics"
import { analyticsLog } from "../../../../shared/analytics/log"
import type { SqlResultResponse } from "../../../../shared/analytics/types"

// Never cached and only a hash of the SQL is logged: both may hold customer data.
export const POST = async (
  req: AuthenticatedMedusaRequest<RunSqlBody>,
  res: MedusaResponse<SqlResultResponse>
) => {
  const log = analyticsLog(
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    "sql"
  )
  const sql = req.scope.resolve<AnalyticsSqlService>(ANALYTICS_SQL_MODULE)
  const text = req.validatedBody.q
  const hash = createHash("sha1").update(text).digest("hex").slice(0, 12)
  const actor = req.auth_context.actor_id

  try {
    const result = await sql.run(text)
    log.info(
      `Query ${hash} by ${actor}: ${result.rows.length}${result.truncated ? "+" : ""} rows, ${result.ms}ms`
    )
    res.status(200).json(result)
  } catch (error) {
    log.info(
      `Query ${hash} by ${actor} failed${sqlErrorCode(error) ? ` (${sqlErrorCode(error)})` : ""}`
    )
    throw error
  }
}
