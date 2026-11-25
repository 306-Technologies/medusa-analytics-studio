import { model } from "@medusajs/framework/utils"

const AnalyticsDashboard = model
  .define("analytics_dashboard", {
    id: model.id({ prefix: "andash" }).primaryKey(),
    user_id: model.text(),
    layout: model.json(),
  })
  .indexes([
    {
      name: "IDX_analytics_dashboard_user_unique",
      on: ["user_id"],
      unique: true,
      where: "deleted_at is null",
    },
  ])

export default AnalyticsDashboard
