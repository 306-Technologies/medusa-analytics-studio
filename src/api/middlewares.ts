import {
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"

import {
  RunReportQuerySchema,
  RunSqlSchema,
  SaveDashboardSchema,
  SaveReportSchema,
} from "../schemas/analytics"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/analytics/query",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(RunReportQuerySchema, {})],
    },
    {
      matcher: "/admin/analytics/sql",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(RunSqlSchema)],
    },
    {
      matcher: "/admin/analytics/reports",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(SaveReportSchema)],
    },
    {
      matcher: "/admin/analytics/dashboard",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(SaveDashboardSchema)],
    },
  ],
})
