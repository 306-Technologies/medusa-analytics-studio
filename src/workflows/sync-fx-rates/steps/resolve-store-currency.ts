import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { REPORTING_STORE_PAGINATION } from "../../../shared/analytics/reporting-store"

export const resolveStoreCurrencyStep = createStep(
  "resolve-store-currency",
  async (_input: undefined, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: stores } = await query.graph({
      entity: "store",
      fields: [
        "supported_currencies.currency_code",
        "supported_currencies.is_default",
      ],
      pagination: REPORTING_STORE_PAGINATION,
    })
    const currencies = stores[0]?.supported_currencies ?? []
    const currency =
      (currencies.find((entry) => entry?.is_default) ?? currencies[0])
        ?.currency_code ?? null
    return new StepResponse(currency ? currency.toLowerCase() : null)
  }
)
