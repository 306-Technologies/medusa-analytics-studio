import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { SALES_FACTS_MODULE } from "../../../modules/sales-facts"
import type SalesFactsService from "../../../modules/sales-facts/service"
import {
  FxProviderError,
  type FxRateProvider,
} from "../../../modules/sales-facts/fx/provider"
import {
  addDays,
  lastFixedDay,
  planRates,
  type StoredRate,
} from "../../../modules/sales-facts/fx/rates"
import type { FxQuote } from "../../../modules/sales-facts/service"
import { analyticsLog } from "../../../shared/analytics/log"

export type FetchFxRatesStepInput = { base: string; quotes: FxQuote[] }

export type FxRatesToSave = {
  base: string
  provider: string
  quotes: { quote: string; rows: StoredRate[] }[]
}

/** Days past a chunk also asked for, so a big move at its end can be checked. */
const LOOKAHEAD_DAYS = 7

const yearChunks = (from: string, to: string): [string, string][] => {
  const chunks: [string, string][] = []
  for (let start = from; start <= to; start = addDays(start, 366)) {
    const end = addDays(start, 365)
    chunks.push([start, end < to ? end : to])
  }
  return chunks
}

export const fetchFxRatesStep = createStep(
  "fetch-fx-rates",
  async ({ base, quotes }: FetchFxRatesStepInput, { container }) => {
    const log = analyticsLog(
      container.resolve(ContainerRegistrationKeys.LOGGER),
      "fx"
    )
    const empty: FxRatesToSave = { base, provider: "", quotes: [] }

    let provider: FxRateProvider | null
    try {
      provider = await container
        .resolve<SalesFactsService>(SALES_FACTS_MODULE)
        .fxProvider()
    } catch (error) {
      log.error("ANALYTICS_FX_URL is not usable, no rates fetched", error)
      return new StepResponse(empty)
    }
    if (!provider) {
      log.debug("ANALYTICS_FX_URL=off, no rates fetched")
      return new StepResponse(empty)
    }

    const today = new Date().toISOString().slice(0, 10)
    const result: FxRatesToSave = { base, provider: provider.name, quotes: [] }

    for (const quote of quotes) {
      const ranges: {
        from: string
        to: string
        previous: FxQuote["last_fixed"]
      }[] = []
      if (quote.fixed_from && quote.first_day < quote.fixed_from) {
        ranges.push({
          from: quote.first_day,
          to: addDays(quote.fixed_from, -1),
          previous: null,
        })
      }
      const from = quote.fixed_until
        ? addDays(quote.fixed_until, 1)
        : quote.first_day
      if (from <= today) {
        ranges.push({
          from,
          to: today,
          previous: quote.fixed_until ? quote.last_fixed : null,
        })
      }

      const rows: StoredRate[] = []
      try {
        for (const range of ranges) {
          let previous = range.previous
          for (const [start, end] of yearChunks(range.from, range.to)) {
            const ahead = addDays(end, LOOKAHEAD_DAYS)
            const rates = await provider.fetchRates({
              base,
              quote: quote.quote,
              from: start,
              to: ahead < today ? ahead : today,
            })
            const plan = planRates(rates, start, end, today, previous)
            for (const refused of plan.rejected) {
              log.warn(
                `Refused ${base}/${quote.quote} on ${refused.day}: ${refused.rate} moved too far from ${refused.previous} and the next rate doesn't confirm it, kept the earlier rate`
              )
            }
            rows.push(...plan.rows)
            const last = plan.rows.at(-1)
            previous = last
              ? { rate: last.rate, rate_day: last.rate_day }
              : previous
          }
        }
      } catch (error) {
        if (error instanceof FxProviderError && error.unreachable) {
          log.warn("Rate provider unreachable, will retry next run", error)
          break
        }
        log.error(
          `Rates for ${base}/${quote.quote} failed, will retry next run`,
          error
        )
        continue
      }
      result.quotes.push({ quote: quote.quote, rows })
    }

    log.debug(
      `Fetched rates for ${result.quotes.length} of ${quotes.length} currencies, final up to ${lastFixedDay(today)}`
    )
    return new StepResponse(result)
  }
)
