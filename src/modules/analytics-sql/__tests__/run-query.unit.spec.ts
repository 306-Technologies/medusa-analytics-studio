import { MedusaError } from "@medusajs/framework/utils"

import { sqlErrorCode, toJson, toMedusaError } from "../run-query"

const pgError = (code: string, message: string, position?: string) =>
  Object.assign(new Error(message), { code, ...(position ? { position } : {}) })

describe("toJson", () => {
  it("keeps JSON values and nests", () => {
    expect(toJson({ a: [1, "x", true, null, { b: 2 }] })).toEqual({
      a: [1, "x", true, null, { b: 2 }],
    })
  })

  it("turns undefined into null and non-finite numbers into text", () => {
    expect(toJson(undefined)).toBeNull()
    expect(toJson(Number.NaN)).toBe("NaN")
    expect(toJson(Number.POSITIVE_INFINITY)).toBe("Infinity")
  })
})

describe("toMedusaError", () => {
  it("passes a SQL mistake through with its position", () => {
    const error = toMedusaError(
      pgError("42601", 'syntax error at or near "where"', "13")
    )
    expect(error.type).toBe(MedusaError.Types.INVALID_DATA)
    expect(error.message).toBe(
      'syntax error at or near "where" (at character 13)'
    )
  })

  it("explains what SQL mode can read when a table is denied or missing", () => {
    expect(
      toMedusaError(pgError("42501", "permission denied for table order"))
        .message
    ).toMatch(/reads only views in the reporting schema/)
    expect(
      toMedusaError(pgError("42P01", 'relation "x" does not exist')).message
    ).toMatch(/reads only views in the reporting schema/)
  })

  it("says the query timed out", () => {
    expect(
      toMedusaError(pgError("57014", "canceling statement")).message
    ).toMatch(/longer than 30s/)
  })

  it("asks for a rerun on a replica conflict", () => {
    expect(
      toMedusaError(pgError("40001", "conflict with recovery")).message
    ).toMatch(/Run it again/)
  })

  it.each([
    ["connection", pgError("08006", "connection failure")],
    ["too many connections", pgError("53300", "too many connections for role")],
    ["admin shutdown", pgError("57P01", "terminating connection")],
    ["not a pg error", new Error("timeout exceeded when trying to connect")],
    ["a non-error", "boom"],
  ])("hides details of a server problem (%s)", (_label, raw) => {
    const error = toMedusaError(raw)
    expect(error.type).toBe(MedusaError.Types.UNEXPECTED_STATE)
    expect(error.message).not.toContain("connection")
    expect(error.message).not.toContain("boom")
  })
})

describe("sqlErrorCode", () => {
  it("reads the Postgres code, and nothing from other errors", () => {
    expect(sqlErrorCode(pgError("42501", "denied"))).toBe("42501")
    expect(sqlErrorCode(toMedusaError(pgError("42601", "syntax")))).toBe(
      "42601"
    )
    expect(sqlErrorCode(new Error("x"))).toBeUndefined()
    expect(
      sqlErrorCode(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))
    ).toBeUndefined()
  })
})
