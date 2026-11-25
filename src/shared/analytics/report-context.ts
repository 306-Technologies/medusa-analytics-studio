import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ANALYTICS_READER_MODULE } from "../../modules/analytics-reader"
import type { ReportSettings } from "../../modules/analytics-reader/engine/report"
import type AnalyticsReaderService from "../../modules/analytics-reader/service"
import { analyticsLog, reportingTimezoneLogged } from "./log"
import { REPORTING_STORE_PAGINATION } from "./reporting-store"

export type { ReportSettings }

// Analytics reads only through this read-only pool, never the shared PG_CONNECTION.
export const getAnalyticsDb = (
  container: MedusaContainer
): AnalyticsReaderService =>
  container.resolve<AnalyticsReaderService>(ANALYTICS_READER_MODULE)

// Read from the primary: a timezone change must apply before a replica catches up.
export const resolveReportSettings = async (
  container: MedusaContainer
): Promise<ReportSettings> => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({
    entity: "store",
    fields: [
      "metadata",
      "supported_currencies.currency_code",
      "supported_currencies.is_default",
    ],
    pagination: REPORTING_STORE_PAGINATION,
  })
  const store = stores[0]
  if (!store) {
    analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "settings"
    ).warn("No store found, reports use EUR and UTC")
  }
  const currencies = store?.supported_currencies ?? []
  return {
    currency:
      (currencies.find((entry) => entry?.is_default) ?? currencies[0])
        ?.currency_code ?? "eur",
    timezone: reportingTimezoneLogged(
      analyticsLog(
        container.resolve(ContainerRegistrationKeys.LOGGER),
        "settings"
      ),
      store?.metadata
    ),
  }
}
