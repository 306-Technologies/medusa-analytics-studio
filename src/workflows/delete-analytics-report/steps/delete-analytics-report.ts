import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { ANALYTICS_WORKSPACE_MODULE } from "../../../modules/analytics-workspace"
import type AnalyticsWorkspaceService from "../../../modules/analytics-workspace/service"
import { analyticsLog } from "../../../shared/analytics/log"

export type DeleteAnalyticsReportStepInput = { user_id: string; id: string }

export const deleteAnalyticsReportStep = createStep(
  "delete-analytics-report",
  async (input: DeleteAnalyticsReportStepInput, { container }) => {
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    const report = await service.findUserReport(input.user_id, input.id)
    if (!report) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "That report does not exist."
      )
    }
    await service.softDeleteAnalyticsReports(report.id)
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "workspace"
    ).info(`Report ${report.id} deleted by user ${input.user_id}`)
    return new StepResponse(report.id, report.id)
  },
  async (id: string | undefined, { container }) => {
    if (!id) {
      return
    }
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "workspace"
    ).warn(`Undoing report delete: restoring ${id}`)
    await service.restoreAnalyticsReports(id)
  }
)
