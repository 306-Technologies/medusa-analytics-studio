import { model } from "@medusajs/framework/utils"

const AnalyticsLineFact = model
  .define("analytics_line_fact", {
    // Keyed by order_item id, not line item id: one line item can sit on more than one order row.
    id: model.id({ prefix: "alfact" }).primaryKey(),
    order_id: model.text(),
    item_id: model.text(),
    currency_code: model.text(),
    order_created_at: model.dateTime(),
    local_day: model.text(),
    local_hour: model.number(),
    product_id: model.text().nullable(),
    variant_id: model.text().nullable(),
    product_title: model.text().nullable(),
    variant_title: model.text().nullable(),
    quantity: model.number(),
    gross: model.bigNumber(),
  })
  .indexes([
    { on: ["order_id", "item_id"], unique: true },
    { on: ["currency_code", "order_created_at"] },
    { on: ["local_day"] },
  ])

export default AnalyticsLineFact
