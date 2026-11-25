import type { DimensionKey, ValueFormat } from "./types"

export const formatMoney = (
  amount: number,
  currencyCode: string,
  options: { compact?: boolean } = {}
): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    maximumFractionDigits:
      options.compact || Math.abs(amount) >= 1000 || Number.isInteger(amount)
        ? 0
        : 2,
    notation: options.compact ? "compact" : "standard",
  }).format(amount)

export const formatNumber = (value: number, digits = 0): string =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)

export const formatPercent = (ratio: number): string =>
  new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio)

export const formatValue = (
  value: number,
  format: ValueFormat | null,
  currencyCode: string,
  options: { compact?: boolean } = {}
): string => {
  if (format === "money") {
    return formatMoney(value, currencyCode, options)
  }
  if (format === "percent") {
    return formatPercent(value)
  }
  return options.compact
    ? new Intl.NumberFormat(undefined, { notation: "compact" }).format(value)
    : formatNumber(value, 1)
}

/** A day from the API ("2026-11-20") as a local date, without timezone drift. */
const localDate = (day: string): Date => {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(year, month - 1, date)
}

export const formatTime = (iso: string, timeZone: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  })

export const currentHour = (timeZone: string): number =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(new Date())
  )

export const formatDay = (day: string, withYear = false): string =>
  localDate(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  })

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const regionNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(undefined, { type: "region" })
    : null

export const countryName = (code: string): string => {
  if (!code) {
    return "Unknown"
  }
  try {
    return regionNames?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

export const formatDimension = (
  dimension: DimensionKey | string,
  value: string
): string => {
  switch (dimension) {
    case "day":
      return formatDay(value)
    case "week":
      return `Week of ${formatDay(value)}`
    case "month":
      return localDate(value).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    case "day_of_week":
      return WEEKDAYS[Number(value) - 1] ?? value
    case "hour_of_day":
      return `${value}:00`
    case "country":
      return countryName(value)
    default:
      return value || "Unknown"
  }
}

export const change = (current: number, previous: number): number | null =>
  previous > 0 ? (current - previous) / previous : null

export const formatRange = (since: string, until: string): string =>
  since === until
    ? formatDay(since, true)
    : `${formatDay(since)} – ${formatDay(until, true)}`
