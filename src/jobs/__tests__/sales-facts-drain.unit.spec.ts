import type { MedusaContainer } from "@medusajs/framework/types"

import type { DrainResult } from "../../modules/sales-facts/service"
import { runSalesFactsDrain } from "../sales-facts-drain"

const run = jest.fn<Promise<{ result: DrainResult }>, []>()

jest.mock("../../workflows/drain-sales-facts-queue", () => ({
  drainSalesFactsQueueWorkflow: () => ({ run }),
}))

const container = {} as unknown as MedusaContainer

const batch = (
  queued: number,
  more: boolean,
  skipped = false
): DrainResult => ({
  queued,
  order_ids: Array.from({ length: queued }, (_, index) => `order_${index}`),
  days: 1,
  more,
  skipped,
})

describe("runSalesFactsDrain", () => {
  beforeEach(() => run.mockReset())

  it("keeps draining while batches come back full", async () => {
    run
      .mockResolvedValueOnce({ result: batch(2, true) })
      .mockResolvedValueOnce({ result: batch(2, true) })
      .mockResolvedValueOnce({ result: batch(1, false) })

    const result = await runSalesFactsDrain(container, { batchSize: 2 })

    expect(run).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      batches: 3,
      queued: 5,
      orders: 5,
      behind: false,
      skipped: false,
    })
  })

  it("stops at once when another drain is running", async () => {
    run.mockResolvedValueOnce({ result: batch(0, false, true) })

    const result = await runSalesFactsDrain(container)

    expect(run).toHaveBeenCalledTimes(1)
    expect(result.skipped).toBe(true)
    expect(result.batches).toBe(0)
  })

  it("reports falling behind when the time budget runs out", async () => {
    run.mockResolvedValue({ result: batch(2, true) })

    const result = await runSalesFactsDrain(container, { budgetMs: 0 })

    expect(run).not.toHaveBeenCalled()
    expect(result.behind).toBe(true)
  })

  it("does nothing on an empty queue", async () => {
    run.mockResolvedValueOnce({ result: batch(0, false) })

    const result = await runSalesFactsDrain(container)

    expect(result).toEqual({
      batches: 0,
      queued: 0,
      orders: 0,
      behind: false,
      skipped: false,
    })
  })
})
