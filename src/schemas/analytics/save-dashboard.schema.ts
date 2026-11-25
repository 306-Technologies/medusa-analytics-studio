import { z } from "@medusajs/framework/zod"

import {
  checkReportShape,
  reportKind,
  savedQuery,
  sqlChart,
  visualization,
} from "./query-text"

export const SaveDashboardSchema = z.object({
  widgets: z
    .array(
      z
        .object({
          id: z.string().min(1).max(64),
          title: z.string().trim().min(1).max(120),
          kind: reportKind.default("query"),
          query: savedQuery,
          visualization,
          chart: sqlChart.nullable().default(null),
          span: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
          ]),
        })
        .superRefine(checkReportShape)
    )
    .max(40),
})

export type SaveDashboardBody = z.infer<typeof SaveDashboardSchema>
