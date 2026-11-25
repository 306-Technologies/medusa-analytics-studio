import { z } from "@medusajs/framework/zod"

import {
  FxProviderError,
  type FxRateProvider,
  type ProviderRate,
  type ProviderRequest,
} from "./provider"

// Only currency codes and dates go out; the address comes from the fxUrl option only and must be HTTPS.

export const DEFAULT_FX_URL = "https://api.frankfurter.dev/v2"

const TIMEOUT_MS = 10_000
/** A year of one quote is ~25 KB; anything far past that is not a rate list. */
const MAX_BYTES = 1_000_000
const MAX_ATTEMPTS = 3
const MAX_RETRY_WAIT_MS = 30_000

const CODE = /^[A-Za-z]{3}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

const ResponseSchema = z.array(
  z.object({
    date: z.string().regex(DAY),
    base: z.string().regex(CODE),
    quote: z.string().regex(CODE),
    rate: z.number().positive().finite(),
  })
)

type FetchLike = (url: string, init: RequestInit) => Promise<Response>
type Sleep = (ms: number) => Promise<void>

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const readCapped = async (response: Response): Promise<string> => {
  const declared = Number(response.headers.get("content-length") ?? 0)
  if (declared > MAX_BYTES) {
    throw new FxProviderError(
      `Answer of ${declared} bytes is over the cap`,
      false
    )
  }
  if (!response.body) {
    return ""
  }
  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new FxProviderError("Answer is over the size cap", false)
    }
    parts.push(value)
  }
  return Buffer.concat(parts).toString("utf8")
}

const retryAfterMs = (header: string | null, attempt: number): number => {
  const seconds = Number(header)
  const fromHeader = Number.isFinite(seconds)
    ? seconds * 1000
    : header
      ? Date.parse(header) - Date.now()
      : NaN
  const wait =
    Number.isFinite(fromHeader) && fromHeader > 0
      ? fromHeader
      : 2 ** attempt * 1000
  return Math.min(wait, MAX_RETRY_WAIT_MS)
}

export class FrankfurterProvider implements FxRateProvider {
  readonly name = "frankfurter"
  private readonly url: string

  constructor(
    url: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly sleep: Sleep = defaultSleep
  ) {
    // The value is never put in an error: it could hold a password.
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new FxProviderError(
        "ANALYTICS_FX_URL is not a valid https address",
        false
      )
    }
    if (parsed.protocol !== "https:") {
      throw new FxProviderError(
        "ANALYTICS_FX_URL must be an https:// address",
        false
      )
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new FxProviderError(
        "ANALYTICS_FX_URL must be a plain https address, without a user, password, query or fragment",
        false
      )
    }
    this.url = parsed.toString().replace(/\/+$/, "")
  }

  async fetchRates(request: ProviderRequest): Promise<ProviderRate[]> {
    for (const code of [request.base, request.quote]) {
      if (!CODE.test(code)) {
        throw new FxProviderError(`Not a currency code: ${code}`, false)
      }
    }
    for (const day of [request.from, request.to]) {
      if (!DAY.test(day)) {
        throw new FxProviderError(`Not a day: ${day}`, false)
      }
    }
    const params = new URLSearchParams({
      base: request.base.toUpperCase(),
      quotes: request.quote.toUpperCase(),
      from: request.from,
      to: request.to,
    })
    const address = `${this.url}/rates?${params.toString()}`

    for (let attempt = 1; ; attempt++) {
      let response: Response
      try {
        response = await this.fetchImpl(address, {
          headers: {
            accept: "application/json",
            "user-agent": "analytics-fx-rates",
          },
          redirect: "error",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (error) {
        throw new FxProviderError(
          `Rates for ${request.quote} could not be fetched: ${error instanceof Error ? error.name : "error"}`,
          true,
          error
        )
      }
      if (
        (response.status === 503 || response.status === 429) &&
        attempt < MAX_ATTEMPTS
      ) {
        await response.body?.cancel()
        await this.sleep(
          retryAfterMs(response.headers.get("retry-after"), attempt)
        )
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new FxProviderError(
          `Rates for ${request.quote} answered HTTP ${response.status}`,
          response.status >= 500
        )
      }

      let body: unknown
      try {
        body = JSON.parse(await readCapped(response))
      } catch (error) {
        if (error instanceof FxProviderError) {
          throw error
        }
        throw new FxProviderError(
          `Rates for ${request.quote} are not JSON`,
          false
        )
      }
      const parsed = ResponseSchema.safeParse(body)
      if (!parsed.success) {
        throw new FxProviderError(
          `Rates for ${request.quote} have an unexpected shape`,
          false
        )
      }
      const base = request.base.toLowerCase()
      const quote = request.quote.toLowerCase()
      return parsed.data.flatMap((row) =>
        // Only what was asked for (it may add an identity row), in range.
        row.base.toLowerCase() === base &&
        row.quote.toLowerCase() === quote &&
        row.date >= request.from &&
        row.date <= request.to
          ? [{ day: row.date, base, quote, rate: String(row.rate) }]
          : []
      )
    }
  }
}

export const fxProviderFrom = (
  value: string | undefined
): FxRateProvider | null => {
  const setting = value?.trim() ?? ""
  if (setting.toLowerCase() === "off") {
    return null
  }
  return new FrankfurterProvider(setting || DEFAULT_FX_URL)
}
