import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  deleteAnalyticsReportStep,
  type DeleteAnalyticsReportStepInput,
} from "./steps/delete-analytics-report"

export type DeleteAnalyticsReportInput = DeleteAnalyticsReportStepInput

export const deleteAnalyticsReportWorkflow = createWorkflow(
  "delete-analytics-report",
  function (input: DeleteAnalyticsReportInput) {
    const id = deleteAnalyticsReportStep(input)
    return new WorkflowResponse(id)
  }
)
