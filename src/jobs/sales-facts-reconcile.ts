import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { SALES_FACTS_MODULE } from "../modules/sales-facts"
import type SalesFactsService from "../modules/sales-facts/service"
import { factsJobsEnabled } from "../shared/analytics/facts-jobs"
import { analyticsLog } from "../shared/analytics/log"
import { refreshSalesFactsWorkflow } from "../workflows/refresh-sales-facts"

export const RECONCILE_WINDOW_DAYS = 7
export const RECONCILE_BATCH_SIZE = 2_000

export type ReconcileRunResult = {
  selected: number
  done: number
  failed: number
}

export async function runSalesFactsReconcile(
  container: MedusaContainer,
  onBatchError: (error: unknown, firstOrderId: string) => void
): Promise<ReconcileRunResult> {
  const service: SalesFactsService = container.resolve(SALES_FACTS_MODULE)
  const since = new Date(Date.now() - RECONCILE_WINDOW_DAYS * 86_400_000)
  const ids = await service.listOrderIdsChangedSince(since)
  const result: ReconcileRunResult = {
    selected: ids.length,
    done: 0,
    failed: 0,
  }

  for (let i = 0; i < ids.length; i += RECONCILE_BATCH_SIZE) {
    const batch = ids.slice(i, i + RECONCILE_BATCH_SIZE)
    try {
      await refreshSalesFactsWorkflow(container).run({
        input: { order_ids: batch },
      })
      result.done += batch.length
    } catch (error) {
      result.failed += batch.length
      onBatchError(error, batch[0])
    }
  }
  return result
}

export default async function salesFactsReconcileJob(
  container: MedusaContainer
) {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "reconcile"
  )
  if (!(await factsJobsEnabled(container))) {
    log.debug("Skipped, jobs turned off (ANALYTICS_FACTS_JOBS_ENABLED=false)")
    return
  }
  const started = Date.now()
  try {
    const result = await runSalesFactsReconcile(
      container,
      (error, firstOrderId) =>
        log.error(
          `Batch starting at ${firstOrderId} failed, skipped until tomorrow`,
          error
        )
    )
    const summary = `window=${RECONCILE_WINDOW_DAYS}d selected=${result.selected} done=${result.done} failed=${result.failed} ms=${Date.now() - started}`
    if (result.failed) {
      log.warn(`Done with failures: ${summary}`)
    } else {
      log.info(`Done: ${summary}`)
    }
  } catch (error) {
    log.error(`Run failed after ${Date.now() - started}ms`, error)
  }
}

export const config = {
  name: "sales-facts-reconcile",
  schedule: "30 3 * * *",
}
