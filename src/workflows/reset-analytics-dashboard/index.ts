import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  resetAnalyticsDashboardStep,
  type ResetAnalyticsDashboardStepInput,
} from "./steps/reset-analytics-dashboard"

export type ResetAnalyticsDashboardInput = ResetAnalyticsDashboardStepInput

export const resetAnalyticsDashboardWorkflow = createWorkflow(
  "reset-analytics-dashboard",
  function (input: ResetAnalyticsDashboardInput) {
    const removed = resetAnalyticsDashboardStep(input)
    return new WorkflowResponse(removed)
  }
)
