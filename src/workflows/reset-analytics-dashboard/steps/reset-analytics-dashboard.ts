import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { ANALYTICS_WORKSPACE_MODULE } from "../../../modules/analytics-workspace"
import type AnalyticsWorkspaceService from "../../../modules/analytics-workspace/service"
import type { AnalyticsDashboardRecord } from "../../../modules/analytics-workspace/service"
import { analyticsLog } from "../../../shared/analytics/log"

export type ResetAnalyticsDashboardStepInput = { user_id: string }

type ResetUndo = { previous: AnalyticsDashboardRecord | null }

export const resetAnalyticsDashboardStep = createStep(
  "reset-analytics-dashboard",
  async (input: ResetAnalyticsDashboardStepInput, { container }) => {
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    const previous = await service.findUserDashboard(input.user_id)
    if (previous) {
      // A hard delete, so the one-dashboard-per-user index is free again.
      await service.deleteAnalyticsDashboards(previous.id)
      analyticsLog(
        container.resolve(ContainerRegistrationKeys.LOGGER),
        "workspace"
      ).info(
        `Dashboard ${previous.id} reset to the default by user ${input.user_id}`
      )
    }
    const undo: ResetUndo = { previous }
    return new StepResponse(previous !== null, undo)
  },
  async (undo: ResetUndo | undefined, { container }) => {
    if (!undo?.previous) {
      return
    }
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "workspace"
    ).warn(
      `Undoing dashboard reset: restoring the layout for user ${undo.previous.user_id}`
    )
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    await service.createAnalyticsDashboards({
      user_id: undo.previous.user_id,
      layout: undo.previous.layout,
    })
  }
)
