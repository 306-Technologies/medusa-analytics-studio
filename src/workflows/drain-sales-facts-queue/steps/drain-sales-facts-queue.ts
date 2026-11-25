import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"
import { analyticsLog } from "../../../shared/analytics/log"

export type DrainSalesFactsQueueStepInput = {
  timezone: string
  limit: number
}

export const drainSalesFactsQueueStep = createStep(
  "drain-sales-facts-queue",
  async (input: DrainSalesFactsQueueStepInput, { container }) => {
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "drain"
    )
    const started = Date.now()
    const result = await service.drainQueue(input.limit, input.timezone)
    if (result.queued) {
      log.debug(
        `Refreshed ${result.order_ids.length} orders from ${result.queued} queued, ${result.days} rollup days, in ${Date.now() - started}ms`
      )
    }
    return new StepResponse(result, {
      order_ids: result.order_ids,
      timezone: input.timezone,
    })
  },
  async (undo, { container }) => {
    if (!undo?.order_ids.length) {
      return
    }
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "drain"
    ).warn(
      `Workflow rolled back, refreshing the batch's ${undo.order_ids.length} orders again`
    )
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    await service.refreshOrders(undo.order_ids, undo.timezone)
  }
)
