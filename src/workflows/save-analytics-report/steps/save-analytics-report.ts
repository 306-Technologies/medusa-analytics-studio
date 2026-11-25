import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { ANALYTICS_WORKSPACE_MODULE } from "../../../modules/analytics-workspace"
import type AnalyticsWorkspaceService from "../../../modules/analytics-workspace/service"
import type { AnalyticsReportRecord } from "../../../modules/analytics-workspace/service"
import { assertSavedQuery } from "../../../shared/analytics/assert-saved-query"
import { analyticsLog } from "../../../shared/analytics/log"
import { MAX_SAVED_REPORTS } from "../../../shared/analytics/saved-report-limit"
import type {
  ReportKind,
  SqlChartColumns,
} from "../../../shared/analytics/types"

export type SaveAnalyticsReportStepInput = {
  user_id: string
  id?: string
  name: string
  description: string
  kind: ReportKind
  query: string
  visualization: string
  chart: SqlChartColumns | null
}

type ReportUndo =
  | { kind: "created"; id: string }
  | { kind: "updated"; previous: AnalyticsReportRecord }

export const saveAnalyticsReportStep = createStep(
  "save-analytics-report",
  async (input: SaveAnalyticsReportStepInput, { container }) => {
    const service: AnalyticsWorkspaceService = container.resolve(
      ANALYTICS_WORKSPACE_MODULE
    )
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "workspace"
    )
    assertSavedQuery(input.kind, input.query, "The report's query is not valid")

    const fields = {
      name: input.name,
      description: input.description,
      kind: input.kind,
      query: input.query,
      visualization: input.visualization,
      chart: input.kind === "sql" ? input.chart : null,
    }

    if (input.id) {
      const previous = await service.findUserReport(input.user_id, input.id)
      if (!previous) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "That report does not exist."
        )
      }
      const updated = await service.updateAnalyticsReports({
        id: previous.id,
        ...fields,
      })
      const undo: ReportUndo = { kind: "updated", previous }
      log.info(`Report ${updated.id} updated by user ${input.user_id}`)
      return new StepResponse(updated, undo)
    }

    // Count-then-create can race one save past the limit; accepted for a single user.
    const [, saved] = await service.listAndCountAnalyticsReports(
      { user_id: input.user_id },
      { take: 1 }
    )
    if (saved >= MAX_SAVED_REPORTS) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `You have ${MAX_SAVED_REPORTS} saved reports, the most there can be. Delete one to save another.`
      )
    }
    const created = await service.createAnalyticsReports({
      user_id: input.user_id,
      ...fields,
    })
    const undo: ReportUndo = { kind: "created", id: created.id }
    log.info(`Report ${created.id} created by user ${input.user_id}`)
    return new StepResponse(created, undo)
  },
  async (undo: ReportUndo | undefined, { container }) => {
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
      `Undoing report save: ${undo.kind === "created" ? `removing ${undo.id}` : `restoring ${undo.previous.id}`}`
    )
    if (undo.kind === "created") {
      await service.deleteAnalyticsReports(undo.id)
      return
    }
    await service.updateAnalyticsReports({
      id: undo.previous.id,
      name: undo.previous.name,
      description: undo.previous.description,
      kind: undo.previous.kind,
      query: undo.previous.query,
      visualization: undo.previous.visualization,
      chart: undo.previous.chart,
    })
  }
)
