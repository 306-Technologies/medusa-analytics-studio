import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"

export type QueueSalesFactsRefreshStepInput = {
  order_ids: string[]
}

export const queueSalesFactsRefreshStep = createStep(
  "queue-sales-facts-refresh",
  async (input: QueueSalesFactsRefreshStepInput, { container }) => {
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    const queued = await service.queueOrders(input.order_ids)
    return new StepResponse(queued)
  },
  async () => {
    // A queued refresh is correct even if the change that queued it was rolled back.
  }
)
