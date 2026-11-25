import { z } from "@medusajs/framework/zod"

import { queryText } from "./query-text"

export const RunReportQuerySchema = z.object({
  q: queryText,
})

export type RunReportQuery = z.infer<typeof RunReportQuerySchema>
