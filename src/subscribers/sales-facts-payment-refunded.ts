import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { analyticsLog } from "../shared/analytics/log"
import { queueSalesFactsRefreshWorkflow } from "../workflows/queue-sales-facts-refresh"

export default async function salesFactsPaymentRefunded({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "events"
  )

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: payments } = await query.graph({
      entity: "payment",
      fields: ["payment_collection.order.id"],
      filters: { id: data.id },
    })
    const orderId = payments[0]?.payment_collection?.order?.id
    if (!orderId) {
      log.debug(`payment.refunded for ${data.id}: no order, skipped`)
      return
    }

    log.debug(
      `payment.refunded for ${data.id}, queueing a facts refresh for order ${orderId}`
    )
    await queueSalesFactsRefreshWorkflow(container).run({
      input: { order_ids: [orderId] },
    })
  } catch (error) {
    log.warn(
      `Queueing the order of payment ${data.id} failed, the nightly reconcile will retry`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: "payment.refunded",
}
