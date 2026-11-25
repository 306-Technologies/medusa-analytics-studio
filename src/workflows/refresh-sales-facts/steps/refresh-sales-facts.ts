import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"
import { analyticsLog } from "../../../shared/analytics/log"

export type RefreshSalesFactsStepInput = {
  order_ids: string[]
  timezone: string
}

// Compensation refreshes again: facts derive from orders, so undo means matching them as they are now.
export const refreshSalesFactsStep = createStep(
  "refresh-sales-facts",
  async (input: RefreshSalesFactsStepInput, { container }) => {
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "facts"
    )
    const started = Date.now()
    const result = await service.refreshOrders(input.order_ids, input.timezone)
    log.debug(
      `Refreshed ${result.orders} order${result.orders === 1 ? "" : "s"} and ${result.days.length} rollup day${result.days.length === 1 ? "" : "s"} in ${Date.now() - started}ms${
        result.orders === 1 ? ` (${input.order_ids[0]})` : ""
      }`
    )
    return new StepResponse(result, input)
  },
  async (input, { container }) => {
    if (!input?.order_ids.length) {
      return
    }
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "facts"
    ).warn(
      `Workflow rolled back, refreshing ${input.order_ids.length} orders again to match them`
    )
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    await service.refreshOrders(input.order_ids, input.timezone)
  }
)
