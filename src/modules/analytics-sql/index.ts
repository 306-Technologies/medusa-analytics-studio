import { Module } from "@medusajs/framework/utils"

import AnalyticsSqlService from "./service"

export const ANALYTICS_SQL_MODULE = "analyticsSql"

export default Module(ANALYTICS_SQL_MODULE, {
  service: AnalyticsSqlService,
})
