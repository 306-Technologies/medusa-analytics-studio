import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  saveAnalyticsDashboardStep,
  type SaveAnalyticsDashboardStepInput,
} from "./steps/save-analytics-dashboard"

export type SaveAnalyticsDashboardInput = SaveAnalyticsDashboardStepInput

export const saveAnalyticsDashboardWorkflow = createWorkflow(
  "save-analytics-dashboard",
  function (input: SaveAnalyticsDashboardInput) {
    const dashboard = saveAnalyticsDashboardStep(input)
    return new WorkflowResponse(dashboard)
  }
)
