import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"
import type { FxRatesToSave } from "./fetch-fx-rates"

export const saveFxRatesStep = createStep(
  "save-fx-rates",
  async (input: FxRatesToSave, { container }) => {
    const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
    let days = 0
    for (const { quote, rows } of input.quotes) {
      days += (
        await service.saveFxRates(input.base, quote, input.provider, rows)
      ).length
    }
    return new StepResponse({ currencies: input.quotes.length, days })
  },
  async () => {
    // Rates are facts about the world, not part of the change being rolled back.
  }
)
