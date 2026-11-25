import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const INDEXES = [
  `create index if not exists "IDX_analytics_order_created_at" on "order" ("created_at") where "deleted_at" is null`,
  `create index if not exists "IDX_analytics_order_customer_created_at" on "order" ("customer_id", "created_at") where "deleted_at" is null`,
  `create index if not exists "IDX_analytics_cart_open_updated_at" on "cart" ("updated_at") where "completed_at" is null and "deleted_at" is null`,
]

export default async function analyticsCoreIndexes({
  container,
}: {
  container: MedusaContainer
}): Promise<void> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  for (const statement of INDEXES) {
    await pg.raw(statement)
  }
}
