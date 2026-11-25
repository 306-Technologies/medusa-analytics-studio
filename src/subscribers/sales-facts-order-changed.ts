import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { analyticsLog } from "../shared/analytics/log"
import { queueSalesFactsRefreshWorkflow } from "../workflows/queue-sales-facts-refresh"

// order.* events send { id }; return, claim, exchange and edit events send { order_id }.
type OrderEventData = { id?: string; order_id?: string }

// Only queues: refreshing here would wait on the facts lock while holding a connection checkout needs.
export default async function salesFactsOrderChanged({
  event: { name, data },
  container,
}: SubscriberArgs<OrderEventData>) {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "events"
  )
  const orderId = data.order_id ?? data.id
  if (!orderId) {
    log.warn(`No order id on ${name}, nothing refreshed`)
    return
  }
  log.debug(`${name} for ${orderId}, queueing a facts refresh`)

  try {
    await queueSalesFactsRefreshWorkflow(container).run({
      input: { order_ids: [orderId] },
    })
  } catch (error) {
    log.warn(
      `Queueing ${orderId} after ${name} failed, the nightly reconcile will retry`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.updated",
    "order.canceled",
    "order-edit.confirmed",
    "order.return_received",
    "order.claim_created",
    "order.exchange_created",
  ],
}
