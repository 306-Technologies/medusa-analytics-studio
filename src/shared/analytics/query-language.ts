// No server imports: the admin bundle uses this too. Only names listed here can reach SQL.

export type ValueFormat = "money" | "number" | "percent"

export type MetricDefinition = {
  label: string
  format: ValueFormat
  description: string
  perLine: boolean
}

export const METRICS = {
  orders: {
    label: "Orders",
    format: "number",
    description: "Orders placed, not counting canceled ones.",
    perLine: true,
  },
  gross_sales: {
    label: "Gross sales",
    format: "money",
    description: "Item prices times quantities, before discounts.",
    perLine: true,
  },
  discounts: {
    label: "Discounts",
    format: "money",
    description: "Discounts applied to items.",
    perLine: false,
  },
  returns: {
    label: "Returns",
    format: "money",
    description:
      "Value of goods received back, before tax and after their discount, on the day they came back. Refunded or not.",
    perLine: false,
  },
  refunds: {
    label: "Refunds",
    format: "money",
    description:
      "Money paid back to customers, on the day it was paid. Goods returned or not.",
    perLine: false,
  },
  net_sales: {
    label: "Net sales",
    format: "money",
    description: "Gross sales minus discounts and returns: the goods kept.",
    perLine: false,
  },
  shipping: {
    label: "Shipping charges",
    format: "money",
    description: "What customers paid for shipping.",
    perLine: false,
  },
  taxes: {
    label: "Taxes",
    format: "money",
    description: "The part of the order total that is tax.",
    perLine: false,
  },
  total_sales: {
    label: "Total sales",
    format: "money",
    description: "Order totals minus refunds: the money kept.",
    perLine: false,
  },
  average_order_value: {
    label: "Average order value",
    format: "money",
    description: "Total sales divided by orders.",
    perLine: false,
  },
  units: {
    label: "Units sold",
    format: "number",
    description: "Item quantities ordered, added up.",
    perLine: true,
  },
  returned_units: {
    label: "Units returned",
    format: "number",
    description: "Units received back, on the day they came back.",
    perLine: false,
  },
  net_units: {
    label: "Net units",
    format: "number",
    description: "Units sold minus units returned.",
    perLine: false,
  },
  customers: {
    label: "Customers",
    format: "number",
    description: "Different customers who ordered.",
    perLine: false,
  },
  new_customers: {
    label: "New customers",
    format: "number",
    description: "Customers whose first ever order is in the period.",
    perLine: false,
  },
  returning_customers: {
    label: "Returning customers",
    format: "number",
    description: "Customers who had ordered before.",
    perLine: false,
  },
} as const satisfies Record<string, MetricDefinition>

export type MetricKey = keyof typeof METRICS

export type DimensionDefinition = {
  label: string
  kind: "time" | "category"
  perLine: boolean
}

export const DIMENSIONS = {
  day: { label: "Day", kind: "time", perLine: false },
  week: { label: "Week", kind: "time", perLine: false },
  month: { label: "Month", kind: "time", perLine: false },
  day_of_week: { label: "Day of week", kind: "category", perLine: false },
  hour_of_day: { label: "Hour of day", kind: "category", perLine: false },
  country: { label: "Country", kind: "category", perLine: false },
  city: { label: "City", kind: "category", perLine: false },
  sales_channel: { label: "Sales channel", kind: "category", perLine: false },
  customer_type: { label: "Customer type", kind: "category", perLine: false },
  product: { label: "Product", kind: "category", perLine: true },
  variant: { label: "Product variant", kind: "category", perLine: true },
} as const satisfies Record<string, DimensionDefinition>

export type DimensionKey = keyof typeof DIMENSIONS

export const COMPARISONS = {
  none: "No comparison",
  previous_period: "Previous period",
  previous_year: "Previous year",
} as const

export type Comparison = keyof typeof COMPARISONS

export type ReportQuery = {
  dataset: "sales"
  metrics: MetricKey[]
  dimensions: DimensionKey[]
  since: string
  until: string
  compare: Comparison
  orderBy: { field: string; direction: "asc" | "desc" } | null
  limit: number | null
  currency: string | null
}

export const MAX_LIMIT = 1000
export const MAX_DIMENSIONS = 2

const DATE_EXPRESSION = /^(today|yesterday|-\d{1,4}[dwmy]|\d{4}-\d{2}-\d{2})$/

export const isDateExpression = (value: string): boolean =>
  DATE_EXPRESSION.test(value)

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key)

export const isMetric = (value: string): value is MetricKey =>
  hasOwn(METRICS, value)
export const isDimension = (value: string): value is DimensionKey =>
  hasOwn(DIMENSIONS, value)
const isComparison = (value: string): value is Comparison =>
  hasOwn(COMPARISONS, value)

export type ParseResult =
  { ok: true; query: ReportQuery } | { ok: false; error: string }

const fail = (error: string): ParseResult => ({ ok: false, error })

const suggest = (word: string, options: string[]): string => {
  const close = options.filter(
    (option) => option.startsWith(word.slice(0, 3)) || option.includes(word)
  )
  return close.length ? ` Did you mean ${close.slice(0, 3).join(", ")}?` : ""
}

const CLAUSES = [
  "FROM",
  "SHOW",
  "GROUP BY",
  "SINCE",
  "UNTIL",
  "COMPARE TO",
  "ORDER BY",
  "LIMIT",
  "CURRENCY",
] as const

type Clause = (typeof CLAUSES)[number]

const splitClauses = (text: string): Map<Clause, string> | string => {
  const pattern =
    /\b(FROM|SHOW|GROUP\s+BY|SINCE|UNTIL|COMPARE\s+TO|ORDER\s+BY|LIMIT|CURRENCY)\b/gi
  const found: Array<{ clause: Clause; start: number; end: number }> = []

  for (const match of text.matchAll(pattern)) {
    const name = match[0].toUpperCase().replace(/\s+/g, " ")
    const clause = CLAUSES.find((entry) => entry === name)
    if (clause && match.index !== undefined) {
      found.push({
        clause,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  if (!found.length || text.slice(0, found[0].start).trim()) {
    return "A query starts with FROM, for example: FROM sales SHOW orders"
  }

  const clauses = new Map<Clause, string>()
  for (const [index, entry] of found.entries()) {
    if (clauses.has(entry.clause)) {
      return `${entry.clause} appears twice.`
    }
    const next = found[index + 1]
    clauses.set(
      entry.clause,
      text.slice(entry.end, next ? next.start : text.length).trim()
    )
  }
  return clauses
}

const list = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

export const validateQuery = (query: ReportQuery): string | null => {
  if (!query.metrics.length) {
    return "SHOW needs at least one metric, for example: SHOW orders"
  }
  if (new Set(query.metrics).size !== query.metrics.length) {
    return "A metric is listed twice in SHOW."
  }
  if (query.dimensions.length > MAX_DIMENSIONS) {
    return `GROUP BY takes at most ${MAX_DIMENSIONS} dimensions.`
  }
  if (new Set(query.dimensions).size !== query.dimensions.length) {
    return "A dimension is listed twice in GROUP BY."
  }

  const lineDimension = query.dimensions.find(
    (dimension) => DIMENSIONS[dimension].perLine
  )
  if (lineDimension) {
    const blocked = query.metrics.find((metric) => !METRICS[metric].perLine)
    if (blocked) {
      const allowed = Object.entries(METRICS)
        .filter(([, definition]) => definition.perLine)
        .map(([key]) => key)
      return `${blocked} is counted per order, so it cannot be split by ${lineDimension}. With ${lineDimension} you can show: ${allowed.join(", ")}.`
    }
  }

  if (!isDateExpression(query.since) || !isDateExpression(query.until)) {
    return "Dates look like: today, yesterday, -30d, -4w, -3m, -1y or 2026-01-31."
  }
  if (query.orderBy) {
    const field = query.orderBy.field
    if (
      !query.metrics.some((metric) => metric === field) &&
      !query.dimensions.some((dimension) => dimension === field)
    ) {
      return `ORDER BY ${field}: that is not one of the columns in this query.`
    }
  }
  if (
    query.limit !== null &&
    (!Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > MAX_LIMIT)
  ) {
    return `LIMIT is a whole number from 1 to ${MAX_LIMIT}.`
  }
  return null
}

export const parseQuery = (text: string): ParseResult => {
  const clauses = splitClauses(text)
  if (typeof clauses === "string") {
    return fail(clauses)
  }

  const dataset = clauses.get("FROM")?.toLowerCase()
  if (dataset !== "sales") {
    return fail(`FROM ${dataset || "?"}: the only dataset is sales.`)
  }

  const metrics: MetricKey[] = []
  for (const name of list(clauses.get("SHOW") ?? "")) {
    if (!isMetric(name)) {
      return fail(
        `${name} is not a metric.${suggest(name, Object.keys(METRICS))}`
      )
    }
    metrics.push(name)
  }

  const dimensions: DimensionKey[] = []
  for (const name of list(clauses.get("GROUP BY") ?? "")) {
    if (!isDimension(name)) {
      return fail(
        `${name} is not a dimension.${suggest(name, Object.keys(DIMENSIONS))}`
      )
    }
    dimensions.push(name)
  }

  const compareText = (clauses.get("COMPARE TO") ?? "none").toLowerCase()
  if (!isComparison(compareText)) {
    return fail("COMPARE TO takes previous_period or previous_year.")
  }

  let orderBy: ReportQuery["orderBy"] = null
  const orderText = clauses.get("ORDER BY")
  if (orderText) {
    const [field, direction = "asc"] = orderText.toLowerCase().split(/\s+/)
    if (direction !== "asc" && direction !== "desc") {
      return fail("ORDER BY ends with ASC or DESC.")
    }
    orderBy = { field, direction }
  }

  const limitText = clauses.get("LIMIT")
  const currencyText = clauses.get("CURRENCY")
  if (currencyText !== undefined && !/^[a-z]{3}$/i.test(currencyText)) {
    return fail(
      "CURRENCY takes a three-letter currency code, for example CURRENCY usd."
    )
  }
  const query: ReportQuery = {
    dataset: "sales",
    metrics,
    dimensions,
    since: (clauses.get("SINCE") ?? "-30d").toLowerCase(),
    until: (clauses.get("UNTIL") ?? "today").toLowerCase(),
    compare: compareText,
    orderBy,
    limit: limitText === undefined ? null : Number(limitText),
    currency: currencyText === undefined ? null : currencyText.toLowerCase(),
  }

  const problem = validateQuery(query)
  return problem ? fail(problem) : { ok: true, query }
}

export const formatQuery = (query: ReportQuery): string =>
  [
    `FROM ${query.dataset}`,
    `SHOW ${query.metrics.join(", ")}`,
    query.dimensions.length ? `GROUP BY ${query.dimensions.join(", ")}` : null,
    `SINCE ${query.since} UNTIL ${query.until}`,
    query.compare === "none" ? null : `COMPARE TO ${query.compare}`,
    query.orderBy
      ? `ORDER BY ${query.orderBy.field} ${query.orderBy.direction.toUpperCase()}`
      : null,
    query.limit === null ? null : `LIMIT ${query.limit}`,
    query.currency === null ? null : `CURRENCY ${query.currency}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
