import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { factsJobsEnabled } from "../shared/analytics/facts-jobs"
import { warnAboutInfrastructure } from "../shared/analytics/infrastructure"
import { analyticsLog } from "../shared/analytics/log"
import { drainSalesFactsQueueWorkflow } from "../workflows/drain-sales-facts-queue"

export const DRAIN_BATCH_SIZE = 1_000
export const DRAIN_TIME_BUDGET_MS = 45_000

export type DrainRunResult = {
  batches: number
  queued: number
  orders: number
  behind: boolean
  skipped: boolean
}

export async function runSalesFactsDrain(
  container: MedusaContainer,
  options: { budgetMs?: number; batchSize?: number } = {}
): Promise<DrainRunResult> {
  const budgetMs = options.budgetMs ?? DRAIN_TIME_BUDGET_MS
  const limit = options.batchSize ?? DRAIN_BATCH_SIZE
  const started = Date.now()
  const total: DrainRunResult = {
    batches: 0,
    queued: 0,
    orders: 0,
    behind: false,
    skipped: false,
  }

  let more = true
  while (more) {
    if (Date.now() - started >= budgetMs) {
      total.behind = true
      break
    }
    const { result } = await drainSalesFactsQueueWorkflow(container).run({
      input: { limit },
    })
    more = result.more && !result.skipped
    total.skipped ||= result.skipped
    if (result.queued) {
      total.batches += 1
      total.queued += result.queued
      total.orders += result.order_ids.length
    }
  }
  return total
}

export default async function salesFactsDrainJob(container: MedusaContainer) {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "drain"
  )
  warnAboutInfrastructure(container)
  if (!(await factsJobsEnabled(container))) {
    log.debug("Skipped, jobs turned off (ANALYTICS_FACTS_JOBS_ENABLED=false)")
    return
  }
  const started = Date.now()
  try {
    const result = await runSalesFactsDrain(container)
    const summary = `batches=${result.batches} queued=${result.queued} orders=${result.orders} ms=${Date.now() - started}`
    if (result.behind) {
      log.warn(
        `Time budget used up with orders still queued, continues next run: ${summary}`
      )
    } else if (result.skipped) {
      log.debug("Another drain is running, skipped")
    } else if (result.queued) {
      log.debug(`Done: ${summary}`)
    }
  } catch (error) {
    log.error(
      `Run failed after ${Date.now() - started}ms, the queued orders stay queued for the next run`,
      error
    )
  }
}

export const config = {
  name: "sales-facts-drain",
  schedule: "* * * * *",
}
