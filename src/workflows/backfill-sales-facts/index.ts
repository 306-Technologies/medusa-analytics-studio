import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { backfillSalesFactsBatchStep } from "./steps/backfill-sales-facts-batch"
import { resolveReportingTimezoneStep } from "../shared-steps/resolve-reporting-timezone"

export type BackfillSalesFactsInput = {
  limit: number
}

export const backfillSalesFactsWorkflow = createWorkflow(
  "backfill-sales-facts",
  function (input: BackfillSalesFactsInput) {
    const timezone = resolveReportingTimezoneStep()
    const result = backfillSalesFactsBatchStep({ timezone, limit: input.limit })
    return new WorkflowResponse(result)
  }
)
