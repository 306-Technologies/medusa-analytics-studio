import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

import { ANALYTICS_SQL_MODULE } from "../../../../../modules/analytics-sql"
import type { SqlRun } from "../../../../../modules/analytics-sql/run-query"
import type { RunSqlBody } from "../../../../../schemas/analytics"
import type { SqlResultResponse } from "../../../../../shared/analytics/types"
import { POST } from "../route"

const RESULT: SqlRun = {
  columns: [{ name: "day", type: "date", kind: "date" }],
  rows: [["2026-11-22"]],
  row_limit: 5000,
  truncated: false,
  ms: 12,
  ran_at: "2026-11-22T10:00:00.000Z",
}

const setup = (run: jest.Mock) => {
  const store = new Map<string, unknown>()
  const logs: string[] = []
  const logger = {
    info: (m: string) => logs.push(m),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: logger,
    [ANALYTICS_SQL_MODULE]: { run },
    [Modules.CACHE]: {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown) => void store.set(key, value),
    },
  }
  const req = {
    scope: { resolve: (key: string) => services[key] },
    validatedBody: {
      q: "select * from reporting.loyalty_points_daily where email = 'a@b.c'",
    },
    auth_context: { actor_id: "user_01TEST" },
  } as unknown as AuthenticatedMedusaRequest<RunSqlBody>
  const json = jest.fn()
  const res = {
    status: jest.fn(() => ({ json })),
  } as unknown as MedusaResponse<SqlResultResponse>
  return { req, res, json, logs, cache: store }
}

describe("POST /admin/analytics/sql", () => {
  it("runs every time, never from a cache", async () => {
    const run = jest.fn().mockResolvedValue(RESULT)
    const { req, res, json, logs, cache } = setup(run)

    await POST(req, res)
    await POST(req, res)

    expect(run).toHaveBeenCalledTimes(2)
    expect(json).toHaveBeenNthCalledWith(2, RESULT)
    expect(cache.size).toBe(0)
    expect(logs[0]).toMatch(
      /^\[analytics:sql\] Query [0-9a-f]{12} by user_01TEST: 1 rows, 12ms$/
    )
  })

  it("never logs the SQL itself", async () => {
    const { req, res, logs } = setup(jest.fn().mockResolvedValue(RESULT))
    await POST(req, res)
    expect(logs.join("\n")).not.toContain("a@b.c")
    expect(logs.join("\n")).not.toContain("loyalty_points_daily")
  })

  it("logs a failure with the admin id and rethrows it", async () => {
    const failure = new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "syntax error"
    )
    const { req, res, logs } = setup(jest.fn().mockRejectedValue(failure))
    await expect(POST(req, res)).rejects.toBe(failure)
    expect(logs[0]).toMatch(/by user_01TEST failed$/)
  })
})
