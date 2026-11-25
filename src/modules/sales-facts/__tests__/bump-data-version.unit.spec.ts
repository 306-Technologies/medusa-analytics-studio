import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"

import { bumpDataVersion } from "../service"

type Call = { sql: string; bindings: unknown[] }

const fakeManager = (state: { data_version: number | string } | null) => {
  const calls: Call[] = []
  const manager = {
    execute: async (sql: string, bindings: unknown[] = []) => {
      calls.push({ sql, bindings })
      return /returning data_version/.test(sql) ? (state ? [state] : []) : []
    },
  } as unknown as SqlEntityManager
  return { manager, calls }
}

const stamps = (calls: Call[]) =>
  calls.filter((call) => call.sql.includes("analytics_day_version"))

describe("bumpDataVersion", () => {
  it("stamps each changed day once with the new global version", async () => {
    const { manager, calls } = fakeManager({ data_version: "17" })

    await bumpDataVersion(manager, ["2026-08-15", "2026-08-16", "2026-08-15"])

    expect(calls[0].sql).toMatch(/set data_version = data_version \+ 1/)
    const [stamp] = stamps(calls)
    expect(stamp.sql).toMatch(
      /on conflict \(local_day\) do update set version = excluded\.version/
    )
    expect(stamp.bindings).toEqual(["2026-08-15", 17, "2026-08-16", 17])
  })

  it("writes days in chunks", async () => {
    const { manager, calls } = fakeManager({ data_version: 3 })
    const days = Array.from({ length: 1500 }, (_, index) =>
      new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10)
    )

    await bumpDataVersion(manager, days)

    expect(stamps(calls).map((call) => call.bindings.length / 2)).toEqual([
      1000, 500,
    ])
  })

  it("writes no days when there is no state row", async () => {
    const { manager, calls } = fakeManager(null)

    await bumpDataVersion(manager, ["2026-08-15"])

    expect(stamps(calls)).toHaveLength(0)
  })
})
