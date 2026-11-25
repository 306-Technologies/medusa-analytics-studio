import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  saveAnalyticsReportStep,
  type SaveAnalyticsReportStepInput,
} from "./steps/save-analytics-report"

export type SaveAnalyticsReportInput = SaveAnalyticsReportStepInput

export const saveAnalyticsReportWorkflow = createWorkflow(
  "save-analytics-report",
  function (input: SaveAnalyticsReportInput) {
    const report = saveAnalyticsReportStep(input)
    return new WorkflowResponse(report)
  }
)
