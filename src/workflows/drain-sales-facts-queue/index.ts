import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { drainSalesFactsQueueStep } from "./steps/drain-sales-facts-queue"
import { resolveReportingTimezoneStep } from "../shared-steps/resolve-reporting-timezone"

export type DrainSalesFactsQueueInput = {
  limit: number
}

export const drainSalesFactsQueueWorkflow = createWorkflow(
  "drain-sales-facts-queue",
  function (input: DrainSalesFactsQueueInput) {
    const timezone = resolveReportingTimezoneStep()
    const result = drainSalesFactsQueueStep({ timezone, limit: input.limit })
    return new WorkflowResponse(result)
  }
)
