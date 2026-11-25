import { z } from "@medusajs/framework/zod"

import { VISUALIZATION_KEYS } from "../../shared/analytics/types"
import { SQL_MAX_LENGTH } from "./run-sql.schema"

export const QUERY_MAX_LENGTH = 2000

export const queryText = z.string().min(1).max(QUERY_MAX_LENGTH)

export const visualization = z.enum(VISUALIZATION_KEYS)

export const reportKind = z.enum(["query", "sql"])

export const sqlChart = z.object({
  label: z.number().int().min(0).max(1000).nullable(),
  values: z.array(z.number().int().min(0).max(1000)).min(1).max(5),
})

export const savedQuery = z.string().trim().min(1).max(SQL_MAX_LENGTH)

export const checkReportShape = (
  value: {
    kind: "query" | "sql"
    query: string
    visualization: string
    chart: unknown
  },
  context: z.RefinementCtx
) => {
  if (value.kind === "query" && value.query.length > QUERY_MAX_LENGTH) {
    context.addIssue({
      code: "custom",
      path: ["query"],
      message: `A query is at most ${QUERY_MAX_LENGTH} characters`,
    })
  }
  if (value.kind === "sql" && value.chart === null) {
    context.addIssue({
      code: "custom",
      path: ["chart"],
      message: "A SQL report needs its chart columns",
    })
  }
}
