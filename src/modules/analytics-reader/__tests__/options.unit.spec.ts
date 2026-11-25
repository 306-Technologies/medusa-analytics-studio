import { resolveReaderOptions } from "../options"

describe("resolveReaderOptions", () => {
  it("fills the defaults when options are left out", () => {
    expect(resolveReaderOptions(undefined)).toEqual({
      databaseUrl: undefined,
      poolMax: 3,
      statementTimeoutMs: 15_000,
      ssl: false,
      separateDatabase: false,
    })
  })

  it("keeps what is given", () => {
    expect(
      resolveReaderOptions({
        databaseUrl: "postgres://replica/app",
        poolMax: 5,
        statementTimeoutMs: 2_000,
        ssl: true,
        separateDatabase: true,
      })
    ).toEqual({
      databaseUrl: "postgres://replica/app",
      poolMax: 5,
      statementTimeoutMs: 2_000,
      ssl: true,
      separateDatabase: true,
    })
  })

  it.each([
    [{ poolMax: 0 }, /poolMax/],
    [{ poolMax: 1.5 }, /poolMax/],
    [{ statementTimeoutMs: Number.NaN }, /statementTimeoutMs/],
    [{ statementTimeoutMs: -1 }, /statementTimeoutMs/],
    [{ separateDatabase: true }, /databaseUrl/],
  ])("refuses %p", (options, message) => {
    expect(() => resolveReaderOptions(options)).toThrow(message)
  })
})
