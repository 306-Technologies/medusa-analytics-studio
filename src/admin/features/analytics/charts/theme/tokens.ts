const token = (name: string) => `var(--analytics-${name})`

export const CHART = {
  blue: token("blue"),
  violet: token("violet"),
  pink: token("pink"),
  orange: token("orange"),
  cyan: token("cyan"),
  green: token("green"),
  rose: token("rose"),
  teal: token("teal"),
  other: token("other"),
  fgBase: token("fg-base"),
  fgTitle: token("fg-title"),
  fgMuted: token("fg-muted"),
  fgOnFill: token("fg-on-fill"),
  grid: token("grid"),
  track: token("track"),
  axis: token("axis"),
  cursor: token("cursor"),
  band: token("band"),
  fgOnTile: token("fg-on-tile"),
  empty: token("empty"),
  inset: token("inset-bg"),
  positiveBg: token("positive-bg"),
  negativeBg: token("negative-bg"),
} as const

export const SERIES = [
  CHART.blue,
  CHART.violet,
  CHART.pink,
  CHART.orange,
  CHART.cyan,
  CHART.green,
]

export const seriesColor = (index: number): string =>
  SERIES[index % SERIES.length]

export const fade = (color: string, percent: number): string =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`

export const glowColor = (color: string, percent: number): string =>
  `color-mix(in srgb, ${color} calc(${percent}% * var(--analytics-glow)), transparent)`

export const glowShadow = (color: string, blur = 14, percent = 50): string =>
  `0 0 ${blur}px 0 ${glowColor(color, percent)}`

export const GLOW_TRANSITION = "380ms cubic-bezier(0.22, 1, 0.36, 1) 90ms"

export const litShadow = (
  color: string,
  lit: boolean,
  blur = 14,
  percent = 50
): string =>
  lit ? glowShadow(color, blur, percent) : `0 0 0 0 ${glowColor(color, 0)}`

export const litFilter = (
  color: string,
  lit: boolean,
  blur = 8,
  percent = 55
): string =>
  `drop-shadow(0 0 ${lit ? blur : 0}px ${glowColor(color, lit ? percent : 0)})`

export const heatColor = (strength: number): string => {
  if (strength <= 0) {
    return CHART.empty
  }
  if (strength < 0.5) {
    return `color-mix(in oklab, ${CHART.blue} ${Math.round(25 + strength * 150)}%, ${CHART.empty})`
  }
  return `color-mix(in oklab, ${CHART.violet} ${Math.round((strength - 0.5) * 2 * 100)}%, ${CHART.blue})`
}

/** Cells at least this busy glow, as the busiest hours do in the design. */
export const GLOW_STRENGTH = 0.85

export const tealColor = (strength: number): string => {
  if (strength <= 0) {
    return CHART.empty
  }
  if (strength < 0.5) {
    return `color-mix(in oklab, ${CHART.teal} ${Math.round(25 + strength * 150)}%, ${CHART.empty})`
  }
  return `color-mix(in oklab, ${CHART.green} ${Math.round((strength - 0.5) * 2 * 80)}%, ${CHART.teal})`
}

const METRIC_ACCENTS: Record<string, string> = {
  total_sales: CHART.blue,
  net_sales: CHART.blue,
  gross_sales: CHART.blue,
  orders: CHART.violet,
  units: CHART.cyan,
  average_order_value: CHART.green,
  customers: CHART.pink,
  new_customers: CHART.orange,
  returning_customers: CHART.violet,
}

export const metricAccent = (metric: string): string =>
  METRIC_ACCENTS[metric] ?? CHART.blue
