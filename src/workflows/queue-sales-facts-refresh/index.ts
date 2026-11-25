import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { queueSalesFactsRefreshStep } from "./steps/queue-sales-facts-refresh"

export type QueueSalesFactsRefreshInput = {
  order_ids: string[]
}

export const queueSalesFactsRefreshWorkflow = createWorkflow(
  "queue-sales-facts-refresh",
  function (input: QueueSalesFactsRefreshInput) {
    const queued = queueSalesFactsRefreshStep({ order_ids: input.order_ids })
    return new WorkflowResponse(queued)
  }
)
