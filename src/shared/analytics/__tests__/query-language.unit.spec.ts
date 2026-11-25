import { formatQuery, parseQuery } from "../query-language"

const BASE = "FROM sales SHOW total_sales SINCE -29d UNTIL today"

describe("CURRENCY", () => {
  it("is optional: without it every currency is converted", () => {
    const parsed = parseQuery(BASE)
    expect(parsed.ok && parsed.query.currency).toBeNull()
  })

  it("takes a three-letter code, lowercased, and formats back", () => {
    const parsed = parseQuery(`${BASE} CURRENCY USD`)
    expect(parsed.ok && parsed.query.currency).toBe("usd")
    if (!parsed.ok) {
      throw new Error(parsed.error)
    }
    const again = parseQuery(formatQuery(parsed.query))
    expect(again).toEqual(parsed)
    expect(formatQuery(parsed.query)).toContain("CURRENCY usd")
  })

  it("refuses anything that is not a code", () => {
    for (const value of ["us", "dollars", "usd'; drop table x", "u1d"]) {
      const parsed = parseQuery(`${BASE} CURRENCY ${value}`)
      expect(parsed.ok).toBe(false)
    }
  })
})

describe("names inherited from Object", () => {
  it.each([
    "FROM sales SHOW constructor SINCE -29d UNTIL today",
    "FROM sales SHOW __proto__ SINCE -29d UNTIL today",
    `${BASE} GROUP BY __proto__`,
    `${BASE} GROUP BY constructor`,
    `${BASE} COMPARE TO constructor`,
  ])("refuses %s", (text) => {
    expect(parseQuery(text).ok).toBe(false)
  })
})

describe("statements that are not report queries", () => {
  it.each([
    `FROM sales SHOW orders; DROP TABLE "order"`,
    `DELETE FROM "order"`,
    `FROM sales SHOW orders GROUP BY day; UPDATE "order" SET status='x'`,
    `FROM "order" SHOW orders`,
    `FROM sales SHOW orders' OR 1=1 --`,
    `FROM sales SHOW (select 1) SINCE -29d`,
    `FROM sales SHOW orders CURRENCY usd'; drop table x;--`,
    `FROM sales SHOW orders SINCE 2026-01-01'; truncate "order";--`,
    `FROM sales SHOW orders LIMIT 1; insert into x values (1)`,
    `FROM sales SHOW orders ORDER BY orders; drop table x`,
  ])("refuses %s", (text) => {
    expect(parseQuery(text).ok).toBe(false)
  })
})
