import { model } from "@medusajs/framework/utils"

// created_at is when this row was written; order_created_at is when the order was placed.
const AnalyticsOrderFact = model
  .define("analytics_order_fact", {
    id: model.id({ prefix: "aofact" }).primaryKey(),
    order_id: model.text(),
    order_version: model.number(),
    currency_code: model.text(),
    order_created_at: model.dateTime(),
    local_day: model.text(),
    local_hour: model.number(),
    customer_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    sales_channel: model.text(),
    country: model.text(),
    city: model.text(),
    is_new: model.boolean(),
    gross: model.bigNumber(),
    discounts: model.bigNumber(),
    refunded: model.bigNumber(),
    shipping: model.bigNumber(),
    tax: model.bigNumber(),
    total: model.bigNumber(),
    units: model.number(),
  })
  .indexes([
    { on: ["order_id"], unique: true },
    { on: ["currency_code", "order_created_at"] },
    { on: ["currency_code", "local_day"] },
    { on: ["local_day"] },
    { on: ["customer_id", "order_created_at"] },
  ])

export default AnalyticsOrderFact
