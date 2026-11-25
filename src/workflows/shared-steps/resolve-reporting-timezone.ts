import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import {
  analyticsLog,
  reportingTimezoneLogged,
} from "../../shared/analytics/log"
import { REPORTING_STORE_PAGINATION } from "../../shared/analytics/reporting-store"

export const resolveReportingTimezoneStep = createStep(
  "resolve-reporting-timezone",
  async (_input: undefined, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["metadata"],
      pagination: REPORTING_STORE_PAGINATION,
    })
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "settings"
    )
    return new StepResponse(reportingTimezoneLogged(log, stores[0]?.metadata))
  }
)
