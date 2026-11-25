import type { Logger } from "@medusajs/framework/types"

import { assertReadStatement } from "../read-only"
import AnalyticsReaderService from "../service"

type Callback = (error: Error | null, result?: unknown) => void
type AfterCreate = (
  connection: { query: (sql: string, cb: Callback) => void },
  done: (error: Error | null) => void
) => void

const mockCreatePgConnection = jest.fn()

jest.mock("@medusajs/framework/utils", () => {
  const actual = jest.requireActual<typeof import("@medusajs/framework/utils")>(
    "@medusajs/framework/utils"
  )
  return {
    ...actual,
    ModulesSdkUtils: {
      ...actual.ModulesSdkUtils,
      createPgConnection: (...args: unknown[]) =>
        mockCreatePgConnection(...args),
    },
  }
})

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger

const connectWith = (readOnly: string) => {
  mockCreatePgConnection.mockClear()
  new AnalyticsReaderService(
    { logger },
    { databaseUrl: "postgres://reader.invalid/app" }
  )
  const [{ pool }] = mockCreatePgConnection.mock.calls[0] as [
    { pool: { afterCreate: AfterCreate } },
  ]
  const sent: string[] = []
  let outcome: Error | null | undefined
  pool.afterCreate(
    {
      query: (sql, cb) => {
        sent.push(sql)
        cb(null, {
          rows: [{ default_transaction_read_only: readOnly }],
        })
      },
    },
    (error) => {
      outcome = error
    }
  )
  return { sent, outcome }
}

describe("AnalyticsReaderService connections", () => {
  it("makes every pooled connection read-only and checks it", () => {
    const { sent, outcome } = connectWith("on")
    expect(sent[0]).toMatch(/set default_transaction_read_only = on;/)
    expect(sent[0]).toMatch(/set statement_timeout = 15000;/)
    expect(sent[1]).toBe("show default_transaction_read_only")
    expect(outcome).toBeNull()
  })

  it("refuses a connection that did not become read-only", () => {
    const { outcome } = connectWith("off")
    expect(outcome).toBeInstanceOf(Error)
  })
})

describe("assertReadStatement", () => {
  it.each([
    "select 1",
    "  SELECT a FROM b WHERE c = ?",
    "with x as (select 1) select * from x",
  ])("allows %s", (sql) => {
    expect(() => assertReadStatement(sql)).not.toThrow()
  })

  it.each([
    'delete from "order"',
    "update analytics_order_fact set x = 1",
    "insert into t values (1)",
    "drop table t",
    "truncate t",
    "set default_transaction_read_only = off",
    "select 1; delete from t",
    "select set_config('default_transaction_read_only', 'off', false)",
    "select pg_terminate_backend(1)",
    "select * from dblink('x', 'delete from t')",
    "select lo_import('/etc/passwd')",
    "select pg_read_file('/etc/passwd')",
    "select pg_sleep(10)",
    `select "set_config"('default_transaction_read_only', 'off', false)`,
    "select set_config/**/('default_transaction_read_only', 'off', false)",
    `select U&"set\\0063onfig"('default_transaction_read_only', 'off', false)`,
    "select pg_advisory_lock(1)",
    "/* x */ delete from t",
    "with x as (delete from t returning *) select * from x",
    "with x as (update t set a = 1 returning *) select * from x",
    "select '--', pg_terminate_backend(pid) from pg_stat_activity",
    "select '/*' a, pg_read_file('/etc/passwd') b, '*/' c",
    `select 1 as "/*", set_config('search_path', 'x', false), 1 as "*/"`,
    "select $$--$$, pg_advisory_lock(1)",
  ])("refuses %s", (sql) => {
    expect(() => assertReadStatement(sql)).toThrow(/read-only SELECT/)
  })
})
