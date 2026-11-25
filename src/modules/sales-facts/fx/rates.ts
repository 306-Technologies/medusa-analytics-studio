import type { ProviderRate } from "./provider"

export const MAX_DAILY_MOVE = 0.2

export const PROVISIONAL_DAYS = 2

const OPENING_RATES = 5

export type StoredRate = {
  day: string
  rate: string
  rate_day: string
  fixed: boolean
}

export type RatePlan = {
  rows: StoredRate[]
  rejected: { day: string; rate: string; previous: string }[]
}

export const addDays = (day: string, days: number): string => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const daysBetween = (from: string, to: string): string[] => {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day)
  }
  return days
}

export const lastFixedDay = (today: string): string =>
  addDays(today, -PROVISIONAL_DAYS)

/** A move past MAX_DAILY_MOVE is kept only if the next rate agrees, refused if it doesn't, and left provisional while there is none. */
export const planRates = (
  rates: ProviderRate[],
  from: string,
  to: string,
  today: string,
  previous: { rate: string; rate_day: string } | null
): RatePlan => {
  const published = [...rates].sort((a, b) => (a.day < b.day ? -1 : 1))
  const byDay = new Map(published.map((rate) => [rate.day, rate.rate]))
  const opening = published
    .filter((rate) => rate.day >= from && rate.day <= to)
    .slice(0, OPENING_RATES)
    .map((rate) => Number(rate.rate))
    .sort((a, b) => a - b)
  const median = opening.length ? opening[Math.floor(opening.length / 2)] : null
  const moved = (rate: number, against: number) =>
    Math.abs(rate / against - 1) > MAX_DAILY_MOVE

  const fixedUntil = lastFixedDay(today)
  const rows: StoredRate[] = []
  const rejected: RatePlan["rejected"] = []
  let last = previous
  let open = false

  for (const day of daysBetween(from, to)) {
    const fresh = byDay.get(day)
    if (fresh !== undefined && Number(fresh) > 0) {
      const against = last ? Number(last.rate) : median
      if (against === null || !moved(Number(fresh), against)) {
        last = { rate: fresh, rate_day: day }
      } else {
        const next = published.find((rate) => rate.day > day)
        if (next && !moved(Number(next.rate), Number(fresh))) {
          last = { rate: fresh, rate_day: day }
        } else {
          rejected.push({
            day,
            rate: fresh,
            previous: last?.rate ?? String(against),
          })
          open = open || next === undefined
        }
      }
    }
    if (last) {
      rows.push({
        day,
        rate: last.rate,
        rate_day: last.rate_day,
        fixed: day <= fixedUntil && !open,
      })
    }
  }
  return { rows, rejected }
}
