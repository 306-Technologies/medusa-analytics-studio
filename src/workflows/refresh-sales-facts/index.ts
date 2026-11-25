import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { refreshSalesFactsStep } from "./steps/refresh-sales-facts"
import { resolveReportingTimezoneStep } from "../shared-steps/resolve-reporting-timezone"

export type RefreshSalesFactsInput = {
  order_ids: string[]
}

export const refreshSalesFactsWorkflow = createWorkflow(
  "refresh-sales-facts",
  function (input: RefreshSalesFactsInput) {
    const timezone = resolveReportingTimezoneStep()
    const result = refreshSalesFactsStep({
      order_ids: input.order_ids,
      timezone,
    })
    return new WorkflowResponse(result)
  }
)
