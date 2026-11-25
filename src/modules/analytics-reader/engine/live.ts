import type { LiveResponse } from "../../../shared/analytics/types"
import { type Raw, type SqlRunner } from "./sql-runner"
import { fxFactorSql } from "./plan"

type TodayRow = { from_ts: Date; to_ts: Date }
type TotalsRow = {
  sales: string
  orders: string
  units: string
  new_customers: string
  returning_customers: string
}
type HourRow = { hour: number; sales: string; orders: string }
type CartRow = { active: string; checking_out: string }
type LocationRow = {
  city: string
  country: string
  orders: string
  sales: string
}
type OrderRow = {
  id: string
  display_id: number | string | null
  created_at: Date
  total: string
  city: string
  country: string
}
type ProductRow = { title: string; units: string; sales: string }

const ACTIVE_CART_MINUTES = 30

export const LIVE_TTL_SECONDS = 10

export type TodayRows = {
  totals: Raw<TotalsRow>
  hours: Raw<HourRow>
  locations: Raw<LocationRow>
  orders: Raw<OrderRow>
  products: Raw<ProductRow>
}

export const NO_ROWS_TODAY: TodayRows = {
  totals: { rows: [] },
  hours: { rows: [] },
  locations: { rows: [] },
  orders: { rows: [] },
  products: { rows: [] },
}

/** Bindings: base, base, day, base, base, day. The fact indexes only cover live rows, hence "deleted_at is null". */
const TODAY_CTE = `
  fo as (
    select t.order_id, t.order_created_at, t.local_hour, t.city, t.country,
      t.customer_id, t.is_new, t.units, t.total * fx.factor as total,
      t.refunded * fx.factor as refunded
    from analytics_order_fact t
    cross join lateral (select ${fxFactorSql("t")} as factor) fx
    where t.deleted_at is null and t.local_day = ? and fx.factor is not null
  ),
  fr as (
    select t.local_hour, t.amount * fx.factor as amount
    from analytics_event_fact t
    cross join lateral (select ${fxFactorSql("t")} as factor) fx
    where t.kind = 'refund' and t.local_day = ? and fx.factor is not null
  )
`

export const todayFromFacts = async (
  pg: SqlRunner,
  currency: string,
  day: string
): Promise<TodayRows> => {
  const today = [currency, currency, day, currency, currency, day]
  const [totals, hours, locations, orders, products] = await Promise.all([
    pg.raw(
      `with ${TODAY_CTE}
       select
         coalesce(sum(f.total), 0)
           - (select coalesce(sum(fr.amount), 0) from fr) as sales,
         count(*) as orders,
         coalesce(sum(f.units), 0) as units,
         count(distinct f.customer_id) filter (where f.is_new) as new_customers,
         count(distinct f.customer_id) filter (where not f.is_new) as returning_customers
       from fo f`,
      today
    ) as Promise<Raw<TotalsRow>>,
    pg.raw(
      `with ${TODAY_CTE}
       select x.hour, sum(x.sales) as sales, sum(x.orders) as orders
       from (
         select f.local_hour as hour, f.total as sales, 1 as orders from fo f
         union all
         select fr.local_hour, -fr.amount, 0 from fr
       ) x
       group by 1`,
      today
    ) as Promise<Raw<HourRow>>,
    // Each order net of all its refunds so far, unlike the sales total, so locations don't sum to sales.
    pg.raw(
      `with ${TODAY_CTE}
       select f.city, f.country, count(*) as orders,
              coalesce(sum(f.total - f.refunded), 0) as sales
       from fo f
       group by 1, 2
       order by sales desc
       limit 50`,
      today
    ) as Promise<Raw<LocationRow>>,
    // No names or emails: the live view may be left open on a wall display.
    pg.raw(
      `with ${TODAY_CTE}
       select f.order_id as id, o.display_id, f.order_created_at as created_at,
              f.total - f.refunded as total, f.city, f.country
       from fo f
       join "order" o on o.id = f.order_id
       order by f.order_created_at desc
       limit 8`,
      today
    ) as Promise<Raw<OrderRow>>,
    pg.raw(
      `select coalesce(max(l.product_title), 'Unknown') as title,
              coalesce(sum(l.quantity), 0) as units,
              coalesce(sum(l.gross * fx.factor), 0) as sales
       from analytics_line_fact l
       cross join lateral (select ${fxFactorSql("l")} as factor) fx
       where l.deleted_at is null and l.local_day = ? and fx.factor is not null
       group by l.product_id
       order by sales desc
       limit 5`,
      [currency, currency, day]
    ) as Promise<Raw<ProductRow>>,
  ])
  return { totals, hours, locations, orders, products }
}

/** Every condition stays in WHERE to match the partial index on open carts (Migration20261123110000). */
export const cartsNow = (pg: SqlRunner) =>
  pg.raw(
    `select
       count(*) as active,
       count(*) filter (
         where c.email is not null and c.shipping_address_id is not null
       ) as checking_out
     from cart c
     where c.deleted_at is null
       and c.completed_at is null
       and c.updated_at >= now() - make_interval(mins => ?)`,
    [ACTIVE_CART_MINUTES]
  ) as Promise<Raw<CartRow>>

export const buildLive = (
  { totals, hours, locations, orders, products }: TodayRows,
  carts: Raw<CartRow>,
  currency: string,
  timezone: string
): Omit<LiveResponse, "filling"> => {
  const byHour = new Map(hours.rows.map((row) => [Number(row.hour), row]))
  const total = totals.rows[0]
  const cart = carts.rows[0]

  return {
    as_of: new Date().toISOString(),
    currency_code: currency,
    timezone,
    today: {
      sales: Number(total?.sales ?? 0),
      orders: Number(total?.orders ?? 0),
      units: Number(total?.units ?? 0),
    },
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      sales: Number(byHour.get(hour)?.sales ?? 0),
      orders: Number(byHour.get(hour)?.orders ?? 0),
    })),
    carts: {
      active: Number(cart?.active ?? 0),
      checking_out: Number(cart?.checking_out ?? 0),
      purchased: Number(total?.orders ?? 0),
    },
    customers: {
      new: Number(total?.new_customers ?? 0),
      returning: Number(total?.returning_customers ?? 0),
    },
    locations: locations.rows.map((row) => ({
      city: row.city,
      country_code: row.country,
      orders: Number(row.orders),
      sales: Number(row.sales),
    })),
    recent_orders: orders.rows.map((row) => ({
      id: row.id,
      display_id: row.display_id == null ? null : Number(row.display_id),
      created_at: new Date(row.created_at).toISOString(),
      total: Number(row.total),
      city: row.city,
      country_code: row.country,
    })),
    top_products: products.rows.map((row) => ({
      title: row.title,
      units: Number(row.units),
      sales: Number(row.sales),
    })),
  }
}
