import type { Logger } from "@medusajs/framework/types"

import AnalyticsSqlService, { type AnalyticsSqlOptions } from "../service"

const mockCreatePgConnection = jest.fn()
const mockPool = jest.fn()
const mockClient = jest.fn()

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

jest.mock("pg", () => ({
  ...jest.requireActual<typeof import("pg")>("pg"),
  Pool: function Pool(...args: unknown[]) {
    return mockPool(...args)
  },
  Client: function Client(...args: unknown[]) {
    return mockClient(...args)
  },
}))

const expectNoConnection = () => {
  expect(mockCreatePgConnection).not.toHaveBeenCalled()
  expect(mockPool).not.toHaveBeenCalled()
  expect(mockClient).not.toHaveBeenCalled()
}

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger

const everythingElse = {
  password: "a-long-test-password-1234",
  analyticsDatabaseUrl: "postgres://replica.invalid/app",
  mainDatabaseUrl: "postgres://primary.invalid/app",
  allowPrimary: true,
  ssl: false,
}

describe("AnalyticsSqlService with disabled set", () => {
  beforeEach(() => jest.clearAllMocks())

  it("stays off and never touches a database, even with everything else set", async () => {
    const sql = new AnalyticsSqlService(
      { logger },
      { ...everythingElse, disabled: true }
    )
    await sql.__hooks.onApplicationStart()

    expect(sql.status()).toEqual({
      enabled: false,
      reason: "turned off for this deployment",
    })
    expectNoConnection()
    await expect(sql.run("select 1")).rejects.toMatchObject({
      type: "not_allowed",
    })
  })

  it("stays off when the option is left out of the config", async () => {
    const options: Partial<AnalyticsSqlOptions> = { ...everythingElse }
    const sql = new AnalyticsSqlService(
      { logger },
      options as AnalyticsSqlOptions
    )
    await sql.__hooks.onApplicationStart()

    expect(sql.status()).toEqual({
      enabled: false,
      reason: "the disabled option is not set to true or false",
    })
    expectNoConnection()
  })
})
