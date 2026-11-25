import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { fetchFxRatesStep } from "./steps/fetch-fx-rates"
import { listFxQuotesStep } from "./steps/list-fx-quotes"
import { saveFxRatesStep } from "./steps/save-fx-rates"
import { resolveStoreCurrencyStep } from "./steps/resolve-store-currency"

export const syncFxRatesWorkflow = createWorkflow("sync-fx-rates", function () {
  const base = resolveStoreCurrencyStep()

  const saved = when(
    "store-has-currency",
    { base },
    (data) => data.base !== null
  ).then(function () {
    const storeCurrency = transform({ base }, (data) => data.base ?? "")
    const quotes = listFxQuotesStep(storeCurrency)
    const fetched = fetchFxRatesStep(
      transform({ storeCurrency, quotes }, (data) => ({
        base: data.storeCurrency,
        quotes: data.quotes,
      }))
    )
    return saveFxRatesStep(fetched)
  })

  const result = transform(
    { saved },
    (data) => data.saved ?? { currencies: 0, days: 0 }
  )
  return new WorkflowResponse(result)
})
