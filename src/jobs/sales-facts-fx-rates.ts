import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { factsJobsEnabled } from "../shared/analytics/facts-jobs"
import { analyticsLog } from "../shared/analytics/log"
import { syncFxRatesWorkflow } from "../workflows/sync-fx-rates"

export default async function salesFactsFxRatesJob(container: MedusaContainer) {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "fx"
  )
  if (!(await factsJobsEnabled(container))) {
    log.debug("Skipped, jobs turned off (ANALYTICS_FACTS_JOBS_ENABLED=false)")
    return
  }
  const started = Date.now()
  try {
    const { result } = await syncFxRatesWorkflow(container).run()
    log.debug(
      `Done: currencies=${result.currencies} days_changed=${result.days} ms=${Date.now() - started}`
    )
  } catch (error) {
    log.error(`Run failed after ${Date.now() - started}ms`, error)
  }
}

export const config = {
  name: "sales-facts-fx-rates",
  schedule: "17 * * * *",
}
