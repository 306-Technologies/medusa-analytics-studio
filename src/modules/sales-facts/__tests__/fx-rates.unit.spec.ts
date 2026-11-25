import { FrankfurterProvider, fxProviderFrom } from "../fx/frankfurter"
import { FxProviderError } from "../fx/provider"
import { planRates } from "../fx/rates"

const request = {
  base: "eur",
  quote: "usd",
  from: "2026-11-13",
  to: "2026-11-16",
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })

const provider = (responses: Response[], seen: string[] = []) =>
  new FrankfurterProvider(
    "https://fx.example.test/v2/",
    async (url) => {
      seen.push(url)
      const next = responses.shift()
      if (!next) {
        throw new Error("no more responses")
      }
      return next
    },
    async () => undefined
  )

describe("FrankfurterProvider", () => {
  it("asks for one quote by codes and dates only, and keeps exact rates", async () => {
    const seen: string[] = []
    const rates = await provider(
      [
        json([
          { date: "2026-11-13", base: "EUR", quote: "USD", rate: 1.1076 },
          { date: "2026-11-13", base: "EUR", quote: "EUR", rate: 1 },
          { date: "2026-11-20", base: "EUR", quote: "USD", rate: 1.0988 },
        ]),
      ],
      seen
    ).fetchRates(request)

    expect(seen).toEqual([
      "https://fx.example.test/v2/rates?base=EUR&quotes=USD&from=2026-11-13&to=2026-11-16",
    ])
    expect(rates).toEqual([
      { day: "2026-11-13", base: "eur", quote: "usd", rate: "1.1076" },
    ])
  })

  it("waits and retries on 503, then gives up with an error", async () => {
    const busy = () =>
      new Response("", { status: 503, headers: { "retry-after": "1" } })
    await expect(
      provider([busy(), busy(), busy()]).fetchRates(request)
    ).rejects.toThrow("HTTP 503")
    const rates = await provider([
      busy(),
      json([{ date: "2026-11-14", base: "EUR", quote: "USD", rate: 1.1 }]),
    ]).fetchRates(request)
    expect(rates).toHaveLength(1)
  })

  it("refuses answers with the wrong shape, zero rates or too many bytes", async () => {
    await expect(
      provider([json({ rates: { USD: 1.1 } })]).fetchRates(request)
    ).rejects.toThrow("unexpected shape")
    await expect(
      provider([
        json([{ date: "2026-11-13", base: "EUR", quote: "USD", rate: 0 }]),
      ]).fetchRates(request)
    ).rejects.toThrow("unexpected shape")
    await expect(
      provider([json("x".repeat(1_100_000))]).fetchRates(request)
    ).rejects.toThrow("size cap")
  })

  it("marks a failed connection as unreachable", async () => {
    const offline = new FrankfurterProvider(
      "https://fx.example.test/v2",
      async () => {
        throw new TypeError("fetch failed")
      }
    )
    const error = await offline
      .fetchRates(request)
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(FxProviderError)
    expect(error instanceof FxProviderError && error.unreachable).toBe(true)
  })

  it("only takes https addresses, from the env var", () => {
    expect(() => new FrankfurterProvider("http://fx.example.test")).toThrow(
      "https"
    )
    expect(
      () => new FrankfurterProvider("https://user:secret@fx.example.test")
    ).toThrow("without a user")
    expect(
      () => new FrankfurterProvider("https://fx.example.test/?key=1")
    ).toThrow("without a user")
    let invalid: unknown
    try {
      new FrankfurterProvider("not a url secret")
    } catch (error) {
      invalid = error
    }
    expect(invalid).toBeInstanceOf(FxProviderError)
    expect(String(invalid)).not.toContain("secret")
    expect(fxProviderFrom("off")).toBeNull()
    expect(fxProviderFrom("")?.name).toBe("frankfurter")
    expect(fxProviderFrom(undefined)?.name).toBe("frankfurter")
  })

  it("refuses codes and days that are not codes and days", async () => {
    await expect(
      provider([]).fetchRates({ ...request, quote: "us&d=1" })
    ).rejects.toThrow("Not a currency code")
  })
})

describe("planRates", () => {
  const rate = (day: string, value: string) => ({
    day,
    base: "eur",
    quote: "usd",
    rate: value,
  })

  it("fills days without a rate from the last earlier one", () => {
    const plan = planRates(
      [rate("2026-11-13", "1.1"), rate("2026-11-16", "1.2")],
      "2026-11-13",
      "2026-11-16",
      "2026-11-23",
      null
    )
    expect(plan.rows.map((row) => [row.day, row.rate, row.rate_day])).toEqual([
      ["2026-11-13", "1.1", "2026-11-13"],
      ["2026-11-14", "1.1", "2026-11-13"],
      ["2026-11-15", "1.1", "2026-11-13"],
      ["2026-11-16", "1.2", "2026-11-16"],
    ])
    expect(plan.rejected).toEqual([])
  })

  it("fixes only days at least two days old", () => {
    const plan = planRates(
      [
        rate("2026-11-20", "1.1"),
        rate("2026-11-21", "1.1"),
        rate("2026-11-22", "1.1"),
      ],
      "2026-11-20",
      "2026-11-22",
      "2026-11-23",
      null
    )
    expect(plan.rows.map((row) => row.fixed)).toEqual([true, true, false])
  })

  it("refuses a rate that jumps more than 20% and keeps the earlier one, provisional", () => {
    const plan = planRates(
      [rate("2026-11-14", "2.5")],
      "2026-11-14",
      "2026-11-14",
      "2026-11-23",
      { rate: "1.1", rate_day: "2026-11-13" }
    )
    expect(plan.rejected).toEqual([
      { day: "2026-11-14", rate: "2.5", previous: "1.1" },
    ])
    expect(plan.rows).toEqual([
      { day: "2026-11-14", rate: "1.1", rate_day: "2026-11-13", fixed: false },
    ])
  })

  it("checks the first rate, with none before it, against the next few", () => {
    const plan = planRates(
      [
        rate("2026-11-13", "11"),
        rate("2026-11-14", "1.1"),
        rate("2026-11-15", "1.11"),
        rate("2026-11-16", "1.09"),
      ],
      "2026-11-13",
      "2026-11-16",
      "2026-11-23",
      null
    )
    expect(plan.rejected).toEqual([
      { day: "2026-11-13", rate: "11", previous: "1.11" },
    ])
    expect(plan.rows.map((row) => [row.day, row.rate])).toEqual([
      ["2026-11-14", "1.1"],
      ["2026-11-15", "1.11"],
      ["2026-11-16", "1.09"],
    ])
  })

  it("takes a big move the next rate agrees with", () => {
    const plan = planRates(
      [rate("2026-11-14", "2"), rate("2026-11-15", "2.02")],
      "2026-11-14",
      "2026-11-15",
      "2026-11-23",
      { rate: "1.1", rate_day: "2026-11-13" }
    )
    expect(plan.rejected).toEqual([])
    expect(plan.rows.map((row) => [row.day, row.rate, row.fixed])).toEqual([
      ["2026-11-14", "2", true],
      ["2026-11-15", "2.02", true],
    ])
  })

  it("refuses a one-day spike for good, and fixes it", () => {
    const plan = planRates(
      [rate("2026-11-14", "2.5"), rate("2026-11-15", "1.11")],
      "2026-11-14",
      "2026-11-15",
      "2026-11-23",
      { rate: "1.1", rate_day: "2026-11-13" }
    )
    expect(plan.rejected).toEqual([
      { day: "2026-11-14", rate: "2.5", previous: "1.1" },
    ])
    expect(plan.rows.map((row) => [row.day, row.rate, row.fixed])).toEqual([
      ["2026-11-14", "1.1", true],
      ["2026-11-15", "1.11", true],
    ])
  })

  it("uses rates past the range to check its last day", () => {
    const plan = planRates(
      [rate("2026-11-14", "2"), rate("2026-11-16", "2.01")],
      "2026-11-14",
      "2026-11-14",
      "2026-11-23",
      { rate: "1.1", rate_day: "2026-11-13" }
    )
    expect(plan.rows).toEqual([
      { day: "2026-11-14", rate: "2", rate_day: "2026-11-14", fixed: true },
    ])
  })

  it("keeps an unconfirmed move and the days after it provisional", () => {
    const plan = planRates(
      [rate("2026-11-14", "2.5")],
      "2026-11-14",
      "2026-11-16",
      "2026-11-23",
      { rate: "1.1", rate_day: "2026-11-13" }
    )
    expect(plan.rows.map((row) => [row.day, row.rate, row.fixed])).toEqual([
      ["2026-11-14", "1.1", false],
      ["2026-11-15", "1.1", false],
      ["2026-11-16", "1.1", false],
    ])
  })

  it("leaves days before the first rate without a row", () => {
    const plan = planRates(
      [rate("2026-11-15", "1.1")],
      "2026-11-13",
      "2026-11-15",
      "2026-11-23",
      null
    )
    expect(plan.rows.map((row) => row.day)).toEqual(["2026-11-15"])
  })
})
