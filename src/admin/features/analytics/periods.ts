import { isDateExpression } from "../../../shared/analytics/query-language"

export type Period = { since: string; until: string }

export const PERIOD_PRESETS: Array<{ label: string } & Period> = [
  { label: "Today", since: "today", until: "today" },
  { label: "Yesterday", since: "yesterday", until: "yesterday" },
  { label: "Last 7 days", since: "-6d", until: "today" },
  { label: "Last 30 days", since: "-29d", until: "today" },
  { label: "Last 90 days", since: "-89d", until: "today" },
  { label: "Last 12 months", since: "-12m", until: "today" },
]

export const DEFAULT_PERIOD: Period = { since: "-29d", until: "today" }

export const periodLabel = (period: Period): string =>
  PERIOD_PRESETS.find(
    (preset) => preset.since === period.since && preset.until === period.until
  )?.label ?? "Custom"

const pad = (value: number) => String(value).padStart(2, "0")

export const toDateExpression = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const isPeriod = (value: Period): boolean =>
  isDateExpression(value.since) && isDateExpression(value.until)
