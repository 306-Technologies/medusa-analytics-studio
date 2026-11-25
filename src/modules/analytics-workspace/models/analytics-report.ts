import { model } from "@medusajs/framework/utils"

const AnalyticsReport = model.define("analytics_report", {
  id: model.id({ prefix: "anrep" }).primaryKey(),
  user_id: model.text().index(),
  name: model.text(),
  description: model.text().default(""),
  kind: model.enum(["query", "sql"]).default("query"),
  query: model.text(),
  visualization: model.text(),
  chart: model.json().nullable(),
})

export default AnalyticsReport
