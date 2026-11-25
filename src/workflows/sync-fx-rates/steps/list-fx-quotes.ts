import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"

export const listFxQuotesStep = createStep(
  "list-fx-quotes",
  async (base: string, { container }) => {
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    return new StepResponse(await service.listFxQuotes(base))
  }
)
