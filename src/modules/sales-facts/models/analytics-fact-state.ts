import { model } from "@medusajs/framework/utils"

const AnalyticsFactState = model.define("analytics_fact_state", {
  id: model.id({ prefix: "afstate" }).primaryKey(),
  timezone: model.text(),
  facts_format: model.number().default(1),
  data_version: model.number().default(0),
  backfilled_at: model.dateTime().nullable(),
  backfill_cursor_created_at: model.dateTime().nullable(),
  backfill_cursor_order_id: model.text().nullable(),
  pending_timezone: model.text().nullable(),
  pending_format: model.number().nullable(),
  pending_built_at: model.dateTime().nullable(),
})

export default AnalyticsFactState
