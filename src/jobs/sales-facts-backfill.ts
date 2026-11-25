import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { factsJobsEnabled } from "../shared/analytics/facts-jobs"
import { analyticsLog } from "../shared/analytics/log"
import { backfillSalesFactsWorkflow } from "../workflows/backfill-sales-facts"

export const BACKFILL_BATCH_SIZE = 1_000
export const BACKFILL_TIME_BUDGET_MS = 2 * 60_000

export type BackfillRunResult = {
  batches: number
  orders: number
  done: boolean
  restarted: boolean
}

export async function runSalesFactsBackfill(
  container: MedusaContainer,
  options: { budgetMs?: number; batchSize?: number } = {}
): Promise<BackfillRunResult> {
  const budgetMs = options.budgetMs ?? BACKFILL_TIME_BUDGET_MS
  const limit = options.batchSize ?? BACKFILL_BATCH_SIZE
  const started = Date.now()
  const total: BackfillRunResult = {
    batches: 0,
    orders: 0,
    done: false,
    restarted: false,
  }

  while (!total.done && Date.now() - started < budgetMs) {
    const { result } = await backfillSalesFactsWorkflow(container).run({
      input: { limit },
    })
    total.done = result.done
    total.restarted ||= result.restarted
    if (result.processed) {
      total.batches += 1
      total.orders += result.processed
    }
    // Retry the swap next run, not straight away against the same reports.
    if (result.swap_waiting) {
      break
    }
  }
  return total
}

export default async function salesFactsBackfillJob(
  container: MedusaContainer
) {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "backfill"
  )
  if (!(await factsJobsEnabled(container))) {
    log.debug("Skipped, jobs turned off (ANALYTICS_FACTS_JOBS_ENABLED=false)")
    return
  }
  const started = Date.now()
  try {
    const result = await runSalesFactsBackfill(container)
    if (result.orders || result.restarted) {
      log.info(
        `${result.done ? "Done" : "Paused, continues next run"}: batches=${result.batches} orders=${result.orders} restarted=${result.restarted} ms=${Date.now() - started}`
      )
    }
  } catch (error) {
    log.error(
      `Run failed after ${Date.now() - started}ms, the next run carries on from the saved place`,
      error
    )
  }
}

export const config = {
  name: "sales-facts-backfill",
  schedule: "*/5 * * * *",
}
