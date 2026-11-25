import type { MetricKey } from "../../../shared/analytics/query-language"

export type MetricSql = {
  rollup?: string
  rollupLine?: string
  facts: string
  factsLine?: string
  /** Needs the return and refund event rows. */
  events: boolean
}

export const METRIC_SQL = {
  orders: {
    rollup: "coalesce(sum(r.orders), 0)",
    rollupLine: "coalesce(sum(r.orders), 0)",
    facts: "count(*) filter (where f.is_order)",
    factsLine: "count(distinct f.order_id)",
    events: false,
  },
  gross_sales: {
    rollup: "coalesce(sum(r.gross), 0)",
    rollupLine: "coalesce(sum(r.gross), 0)",
    facts: "coalesce(sum(f.gross), 0)",
    factsLine: "coalesce(sum(l.gross * f.factor), 0)",
    events: false,
  },
  discounts: {
    rollup: "coalesce(sum(r.discounts), 0)",
    facts: "coalesce(sum(f.discounts), 0)",
    events: false,
  },
  returns: {
    rollup: "coalesce(sum(r.returns), 0)",
    facts: "coalesce(sum(f.returns), 0)",
    events: true,
  },
  refunds: {
    rollup: "coalesce(sum(r.refunds), 0)",
    facts: "coalesce(sum(f.refunds), 0)",
    events: true,
  },
  net_sales: {
    rollup: "coalesce(sum(r.gross - r.discounts - r.returns), 0)",
    facts: "coalesce(sum(f.gross - f.discounts - f.returns), 0)",
    events: true,
  },
  shipping: {
    rollup: "coalesce(sum(r.shipping), 0)",
    facts: "coalesce(sum(f.shipping), 0)",
    events: false,
  },
  taxes: {
    rollup: "coalesce(sum(r.tax), 0)",
    facts: "coalesce(sum(f.tax), 0)",
    events: false,
  },
  total_sales: {
    rollup: "coalesce(sum(r.total - r.refunds), 0)",
    facts: "coalesce(sum(f.total - f.refunds), 0)",
    events: true,
  },
  average_order_value: {
    rollup:
      "case when sum(r.orders) > 0 then sum(r.total - r.refunds) / sum(r.orders) else 0 end",
    facts:
      "case when count(*) filter (where f.is_order) > 0 then sum(f.total - f.refunds) / count(*) filter (where f.is_order) else 0 end",
    events: true,
  },
  units: {
    rollup: "coalesce(sum(r.units), 0)",
    rollupLine: "coalesce(sum(r.units), 0)",
    facts: "coalesce(sum(f.units), 0)",
    factsLine: "coalesce(sum(l.quantity), 0)",
    events: false,
  },
  returned_units: {
    rollup: "coalesce(sum(r.returned_units), 0)",
    facts: "coalesce(sum(f.returned_units), 0)",
    events: true,
  },
  net_units: {
    rollup: "coalesce(sum(r.units - r.returned_units), 0)",
    facts: "coalesce(sum(f.units - f.returned_units), 0)",
    events: true,
  },
  customers: {
    facts: "count(distinct f.customer_id) filter (where f.is_order)",
    events: false,
  },
  new_customers: {
    // Each customer has exactly one first order, so this one adds up.
    rollup: "coalesce(sum(r.new_customers), 0)",
    facts:
      "count(distinct f.customer_id) filter (where f.is_order and f.is_new)",
    events: false,
  },
  returning_customers: {
    facts:
      "count(distinct f.customer_id) filter (where f.is_order and not f.is_new)",
    events: false,
  },
} as const satisfies Record<MetricKey, MetricSql>

export const metricSql = (metric: MetricKey): MetricSql => METRIC_SQL[metric]
