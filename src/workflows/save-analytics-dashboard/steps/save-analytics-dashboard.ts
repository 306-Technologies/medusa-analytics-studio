import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { ANALYTICS_WORKSPACE_MODULE } from "../../../modules/analytics-workspace"
import type AnalyticsWorkspaceService from "../../../modules/analytics-workspace/service"
import type { AnalyticsDashboardRecord } from "../../../modules/analytics-workspace/service"
import { assertSavedQuery } from "../../../shared/analytics/assert-saved-query"
import { analyticsLog } from "../../../shared/analytics/log"
import type { SavedWidget } from "../../../shared/analytics/types"

export type SaveAnalyticsDashboardStepInput = {
  user_id: string
  widgets: SavedWidget[]
}

type DashboardUndo =
  | { kind: "created"; id: string }
  | { kind: "updated"; previous: AnalyticsDashboardRecord }

export const saveAnalyticsDashboardStep = createStep(
  "save-analytics-dashboard",
  async (input: SaveAnalyticsDashboardStepInput, { container }) => {
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "workspace"
    )
    for (const widget of input.widgets) {
      assertSavedQuery(
        widget.kind,
        widget.query,
        `The widget "${widget.title}" has a query that is not valid`
      )
    }

    const layout = { widgets: input.widgets }
    const previous = await service.findUserDashboard(input.user_id)

    if (previous) {
      const updated = await service.updateAnalyticsDashboards({
        id: previous.id,
        layout,
      })
      const undo: DashboardUndo = { kind: "updated", previous }
      log.info(
        `Dashboard ${updated.id} saved by user ${input.user_id} (${input.widgets.length} widgets)`
      )
      return new StepResponse(updated, undo)
    }

    const created = await service.createAnalyticsDashboards({
      user_id: input.user_id,
      layout,
    })
    const undo: DashboardUndo = { kind: "created", id: created.id }
    log.info(
      `Dashboard ${created.id} created by user ${input.user_id} (${input.widgets.length} widgets)`
    )
    return new StepResponse(created, undo)
  },
  async (undo: DashboardUndo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "workspace"
    ).warn(
      `Undoing dashboard save: ${undo.kind === "created" ? `removing ${undo.id}` : `restoring ${undo.previous.id}`}`
    )
    if (undo.kind === "created") {
      await service.deleteAnalyticsDashboards(undo.id)
      return
    }
    await service.updateAnalyticsDashboards({
      id: undo.previous.id,
      layout: undo.previous.layout,
    })
  }
)
