import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"
import { analyticsLog } from "../../../shared/analytics/log"

export type BackfillSalesFactsBatchStepInput = {
  timezone: string
  limit: number
}

export const backfillSalesFactsBatchStep = createStep(
  "backfill-sales-facts-batch",
  async (input: BackfillSalesFactsBatchStepInput, { container }) => {
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "backfill"
    )
    const started = Date.now()
    const result = await service.backfillBatch(input.timezone, input.limit)
    if (result.swap_waiting) {
      log.warn(
        "Rebuild finished, but running reports held the tables too long to swap it in; retrying next run"
      )
    }
    if (result.restarted) {
      log.info(
        result.mode === "fill"
          ? result.previous_timezone
            ? `Reporting timezone changed from ${result.previous_timezone} to ${input.timezone} during the first backfill: starting it again`
            : `Starting the first backfill (timezone ${input.timezone})`
          : result.previous_timezone
            ? `Reporting timezone changed from ${result.previous_timezone} to ${input.timezone}: building new facts and rollups beside the live ones, reports stay in ${result.previous_timezone} until the swap`
            : "Facts are computed differently in this release: building new facts and rollups beside the live ones, swapped in when done"
      )
    }
    if (result.swapped) {
      log.info(`Rebuild finished and swapped in (timezone ${input.timezone})`)
    }
    if (result.processed) {
      log.debug(
        `Batch of ${result.processed} orders in ${Date.now() - started}ms${result.done ? ", backfill finished" : ""}`
      )
    }
    return new StepResponse(result, {
      order_ids: result.order_ids,
      timezone: input.timezone,
    })
  },
  async (undo, { container }) => {
    if (!undo?.order_ids.length) {
      return
    }
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "backfill"
    ).warn(
      `Workflow rolled back, refreshing the batch's ${undo.order_ids.length} orders again`
    )
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    await service.refreshOrders(undo.order_ids, undo.timezone)
  }
)
