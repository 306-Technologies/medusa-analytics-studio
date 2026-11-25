import { z } from "@medusajs/framework/zod"

import {
  checkReportShape,
  reportKind,
  savedQuery,
  sqlChart,
  visualization,
} from "./query-text"

export const SaveReportSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(500).default(""),
    kind: reportKind.default("query"),
    query: savedQuery,
    visualization,
    chart: sqlChart.nullable().default(null),
  })
  .superRefine(checkReportShape)

export type SaveReportBody = z.infer<typeof SaveReportSchema>
