import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import type { BigNumberValue, Context, Logger } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MathBN,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"

import {
  createNextSet,
  dropNextSet,
  FACT_TABLES,
  nextSetExists,
  nextSetMatches,
  SwapLockWaitError,
  swapSets,
  useNextSet,
} from "./fact-set"
import AnalyticsFactState from "./models/analytics-fact-state"
import AnalyticsLineFact from "./models/analytics-line-fact"
import AnalyticsOrderFact from "./models/analytics-order-fact"
import {
  loadOrderMoney,
  notReplacementItem,
  type OrderMoney,
} from "./order-totals"
import type { StoredRate } from "./fx/rates"
import {
  customerTypeSql,
  FACTS_FORMAT,
} from "../../shared/analytics/facts-format"
import { analyticsLog, type AnalyticsLogger } from "../../shared/analytics/log"
import { fxProviderFrom } from "./fx/frankfurter"
import type { FxRateProvider } from "./fx/provider"
import {
  DRAIN_LOCK,
  FACTS_LOCK,
  lockStatements,
  tryLockStatements,
} from "../../shared/analytics/lock-keys"

// Every query says "deleted_at is null" though rows are hard-deleted: the model indexes are partial on it.

/** Ids per statement: well under Postgres' 65,535 bind parameter limit. */
const BATCH_SIZE = 1000

const placeholders = (count: number): string =>
  Array.from({ length: count }, () => "?").join(", ")

const chunks = <T>(values: T[], size: number): T[][] => {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

type DayRow = { day: string }
export type FxQuote = {
  quote: string
  first_day: string
  fixed_from: string | null
  fixed_until: string | null
  last_fixed: { rate: string; rate_day: string } | null
}
type IdRow = { id: string }
type CursorRow = { id: string; created_at: Date }
type StateRow = {
  id: string
  timezone: string
  facts_format: number | string
  backfilled_at: Date | null
  backfill_cursor_created_at: Date | null
  backfill_cursor_order_id: string | null
  pending_timezone: string | null
  pending_format: number | string | null
  pending_built_at: Date | null
}

const STATE_COLUMNS = `id, timezone, facts_format, backfilled_at,
  backfill_cursor_created_at, backfill_cursor_order_id,
  pending_timezone, pending_format, pending_built_at`

const readState = async (
  manager: SqlEntityManager
): Promise<StateRow | undefined> => {
  const [state] = await manager.execute<StateRow[]>(
    `select ${STATE_COLUMNS}
     from analytics_fact_state
     where deleted_at is null
     order by created_at
     limit 1`
  )
  return state
}

export type RefreshResult = {
  orders: number
  days: string[]
}

export type BackfillResult = {
  processed: number
  order_ids: string[]
  done: boolean
  mode: "fill" | "rebuild" | null
  swapped: boolean
  swap_waiting?: true
  restarted: boolean
  previous_timezone: string | null
  format_changed: boolean
}

type QueueRow = {
  order_id: string
  version: number
}

export type DrainResult = {
  queued: number
  order_ids: string[]
  days: number
  more: boolean
  skipped: boolean
}

const MAX_DRAIN_ATTEMPTS = 3

const FACT_TABLE_LIST = FACT_TABLES.join(", ")

const STATE_ID = "afstate_default"

/** Overlapping refreshes of the same orders would collide on their ids. Held until the transaction ends. */
const lockFacts = async (manager: SqlEntityManager) => {
  for (const statement of lockStatements(FACTS_LOCK)) {
    await manager.execute(statement)
  }
}

/** The global version only goes up, so a day's version never repeats, even across a rebuild. */
export const bumpDataVersion = async (
  manager: SqlEntityManager,
  days: string[]
) => {
  const [state] = await manager.execute<{ data_version: number | string }[]>(
    `update analytics_fact_state
     set data_version = data_version + 1, updated_at = now()
     where deleted_at is null
     returning data_version`
  )
  if (!state) {
    return
  }
  const version = Number(state.data_version)
  for (const batch of chunks([...new Set(days)], BATCH_SIZE)) {
    await manager.execute(
      `insert into analytics_day_version (local_day, version)
       values ${batch.map(() => "(?, ?)").join(", ")}
       on conflict (local_day) do update set version = excluded.version`,
      batch.flatMap((day) => [day, version])
    )
  }
}

const raw = (expression: string): string =>
  `jsonb_build_object('value', (${expression})::text, 'precision', 20)`

const managerOf = (manager: SqlEntityManager | undefined): SqlEntityManager => {
  if (!manager) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Sales facts need a database transaction."
    )
  }
  return manager
}

/** Bindings: timezone, timezone, then the order ids. */
const insertOrderFactsSql = (ids: string) => `
  insert into analytics_order_fact (
    id, order_id, order_version, currency_code, order_created_at, local_day,
    local_hour, customer_id, sales_channel_id, sales_channel, country, city,
    is_new, gross, discounts, refunded, shipping, tax, total, units,
    raw_gross, raw_discounts, raw_refunded, raw_shipping, raw_tax, raw_total
  )
  select
    'aofact_' || x.id, x.id, x.version, x.currency_code, x.created_at,
    x.local_day, x.local_hour, x.customer_id, x.sales_channel_id,
    x.sales_channel, x.country, x.city, x.is_new,
    x.gross, x.discounts, x.refunded, x.shipping, x.tax, x.total, x.units,
    ${raw("x.gross")}, ${raw("x.discounts")}, ${raw("x.refunded")},
    ${raw("x.shipping")}, ${raw("x.tax")}, ${raw("x.total")}
  from (
  select y.*
  from (
    select
      o.id,
      o.version,
      o.currency_code,
      o.created_at,
      to_char(o.created_at at time zone ?, 'YYYY-MM-DD') as local_day,
      extract(hour from o.created_at at time zone ?)::smallint as local_hour,
      o.customer_id,
      o.sales_channel_id,
      coalesce(sc.name, 'Unknown') as sales_channel,
      upper(coalesce(a.country_code, '')) as country,
      coalesce(a.city, '') as city,
      -- Set again for the whole customer right after (refreshFirstOrders).
      false as is_new,
      -- Money comes from Medusa's totals right after the insert
      -- (setFactMoney). Refunds are also events of their own (event facts).
      0 as gross,
      0 as discounts,
      coalesce(rf.refunded, 0) as refunded,
      0 as shipping,
      0 as tax,
      0 as total,
      coalesce(i.units, 0) as units
    from "order" o
    left join order_address a on a.id = o.shipping_address_id
    left join sales_channel sc on sc.id = o.sales_channel_id
    left join lateral (
      select sum(r.amount) as refunded
      from order_payment_collection opc
      join payment p
        on p.payment_collection_id = opc.payment_collection_id
        and p.deleted_at is null
      join refund r on r.payment_id = p.id and r.deleted_at is null
      where opc.order_id = o.id and opc.deleted_at is null
    ) rf on true
    left join lateral (
      select sum(oi.quantity) as units
      from order_item oi
      where oi.order_id = o.id
        and oi.version = o.version
        and oi.deleted_at is null
        and ${notReplacementItem("oi")}
    ) i on true
    where o.id in (${ids})
      and o.deleted_at is null
      and o.is_draft_order = false
      and o.status <> 'canceled'
  ) y
  ) x
`

/** Bindings: the order ids. */
const insertLineFactsSql = (ids: string) => `
  insert into analytics_line_fact (
    id, order_id, item_id, currency_code, order_created_at, local_day,
    local_hour, product_id, variant_id, product_title, variant_title,
    quantity, gross, raw_gross
  )
  select
    'alfact_' || oi.id, f.order_id, li.id, f.currency_code,
    f.order_created_at, f.local_day, f.local_hour, li.product_id,
    li.variant_id, li.product_title, li.variant_title, oi.quantity,
    -- Replaced by Medusa's line subtotal (setFactMoney).
    0, ${raw("0")}
  from analytics_order_fact f
  join order_item oi
    on oi.order_id = f.order_id
    and oi.version = f.order_version
    and oi.deleted_at is null
  join order_line_item li on li.id = oi.item_id
  where f.order_id in (${ids})
    and f.deleted_at is null
    and ${notReplacementItem("oi")}
`

const EVENT_COLUMNS = `
  id, kind, order_id, currency_code, occurred_at, local_day, local_hour,
  customer_id, sales_channel, country, city, is_new, amount, units`
const eventOrderColumns = (at: string) => `
  f.order_id, f.currency_code, ${at},
  to_char(${at} at time zone ?, 'YYYY-MM-DD'),
  extract(hour from ${at} at time zone ?)::smallint,
  f.customer_id, f.sales_channel, f.country, f.city, f.is_new`

/** Bindings: timezone, timezone, then the order ids. */
const insertRefundEventsSql = (ids: string) => `
  insert into analytics_event_fact (${EVENT_COLUMNS})
  select r.id, 'refund', ${eventOrderColumns("r.created_at")}, r.amount, 0
  from analytics_order_fact f
  join order_payment_collection opc
    on opc.order_id = f.order_id and opc.deleted_at is null
  join payment p
    on p.payment_collection_id = opc.payment_collection_id
    and p.deleted_at is null
  join refund r on r.payment_id = p.id and r.deleted_at is null
  where f.order_id in (${ids}) and f.deleted_at is null
`

type ReturnItemRow = {
  return_id: string
  order_id: string
  received_at: Date
  item_id: string
  units: string
}

/** Returns from exchanges or claims are swaps and not counted; dismissed counts as received. */
const RETURN_ITEMS_SQL = (ids: string) => `
  select rt.id as return_id, rt.order_id, rt.received_at, ri.item_id,
    (ri.received_quantity + coalesce(ri.damaged_quantity, 0))::text as units
  from return rt
  join return_item ri on ri.return_id = rt.id and ri.deleted_at is null
  where rt.order_id in (${ids})
    and rt.deleted_at is null
    and rt.canceled_at is null
    and rt.received_at is not null
    and rt.exchange_id is null
    and rt.claim_id is null
    and ri.received_quantity + coalesce(ri.damaged_quantity, 0) > 0
`

const insertReturnEvents = async (
  manager: SqlEntityManager,
  ids: string,
  batch: string[],
  timezone: string,
  money: Map<string, OrderMoney>
) => {
  const items = await manager.execute<ReturnItemRow[]>(
    RETURN_ITEMS_SQL(ids),
    batch
  )
  const returns = new Map<
    string,
    { orderId: string; at: Date; units: BigNumberValue; amount: BigNumberValue }
  >()
  for (const item of items) {
    const unitNet = money.get(item.order_id)?.unitNet.get(item.item_id) ?? "0"
    const current = returns.get(item.return_id) ?? {
      orderId: item.order_id,
      at: item.received_at,
      units: 0,
      amount: 0,
    }
    returns.set(item.return_id, {
      ...current,
      units: MathBN.add(current.units, item.units),
      amount: MathBN.add(current.amount, MathBN.mult(unitNet, item.units)),
    })
  }
  for (const batch of chunks([...returns.entries()], BATCH_SIZE)) {
    await manager.execute(
      `insert into analytics_event_fact (${EVENT_COLUMNS})
       select v.id, 'return', ${eventOrderColumns("v.at")},
         v.amount::numeric, v.units::numeric
       from (values ${batch.map(() => "(?, ?, ?::timestamptz, ?, ?)").join(", ")})
         v(id, order_id, at, amount, units)
       join analytics_order_fact f
         on f.order_id = v.order_id and f.deleted_at is null`,
      [
        timezone,
        timezone,
        ...batch.flatMap(([id, value]) => [
          id,
          value.orderId,
          value.at,
          MathBN.convert(value.amount).toFixed(),
          MathBN.convert(value.units).toFixed(),
        ]),
      ]
    )
  }
}

const setFactMoney = async (
  manager: SqlEntityManager,
  money: Map<string, OrderMoney>
) => {
  const orders = [...money.entries()]
  for (const batch of chunks(orders, BATCH_SIZE)) {
    await manager.execute(
      `update analytics_order_fact f
       set gross = v.gross::numeric, discounts = v.discounts::numeric,
         shipping = v.shipping::numeric, tax = v.tax::numeric,
         total = v.total::numeric,
         ${["gross", "discounts", "shipping", "tax", "total"]
           .map((column) => `raw_${column} = ${raw(`v.${column}`)}`)
           .join(", ")}
       from (values ${batch.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")})
         v(order_id, gross, discounts, shipping, tax, total)
       where f.order_id = v.order_id and f.deleted_at is null`,
      batch.flatMap(([orderId, value]) => [
        orderId,
        value.gross,
        value.discounts,
        value.shipping,
        value.tax,
        value.total,
      ])
    )
  }

  const lines = orders.flatMap(([orderId, value]) =>
    [...value.lines.entries()].map(([itemId, gross]) => [
      orderId,
      itemId,
      gross,
    ])
  )
  for (const batch of chunks(lines, BATCH_SIZE)) {
    await manager.execute(
      `update analytics_line_fact f
       set gross = v.gross::numeric, raw_gross = ${raw("v.gross")}
       from (values ${batch.map(() => "(?, ?, ?)").join(", ")})
         v(order_id, item_id, gross)
       where f.order_id = v.order_id and f.item_id = v.item_id
         and f.deleted_at is null`,
      batch.flat()
    )
  }
}

type CustomerRow = { customer_id: string }

/** Bindings: the order ids. */
const customersOf = (ids: string) => `
  select distinct customer_id
  from analytics_order_fact
  where order_id in (${ids})
    and customer_id is not null
    and deleted_at is null
`

const refreshFirstOrders = async (
  manager: SqlEntityManager,
  customerIds: string[]
): Promise<string[]> => {
  const days: string[] = []
  for (const batch of chunks([...new Set(customerIds)], BATCH_SIZE)) {
    const ids = placeholders(batch.length)
    const rows = await manager.execute<DayRow[]>(
      `with firsts as (
         select distinct on (o.customer_id) o.id
         from "order" o
         where o.customer_id in (${ids})
           and o.deleted_at is null
           and o.is_draft_order = false
           and o.status <> 'canceled'
         order by o.customer_id, o.created_at, o.id
       ),
       wanted as (
         select f.order_id, exists (
             select 1 from firsts where firsts.id = f.order_id
           ) as is_new
         from analytics_order_fact f
         where f.customer_id in (${ids}) and f.deleted_at is null
       ),
       changed as (
         update analytics_order_fact f
         set is_new = w.is_new
         from wanted w
         where f.order_id = w.order_id and f.deleted_at is null
           and f.is_new is distinct from w.is_new
         returning f.order_id, f.local_day, f.is_new
       ),
       events as (
         update analytics_event_fact e
         set is_new = c.is_new
         from changed c
         where e.order_id = c.order_id
         returning e.local_day
       )
       select local_day as day from changed
       union
       select local_day from events`,
      [...batch, ...batch]
    )
    days.push(...rows.map((row) => row.day))
  }
  return days
}

/** Bindings: the order ids, twice. */
const daysOf = (ids: string) => `
  select local_day as day
  from analytics_order_fact
  where order_id in (${ids})
    and deleted_at is null
  union
  select local_day
  from analytics_event_fact
  where order_id in (${ids})
`

const SALES_SUMS = `
  count(*) filter (where is_order) as orders,
  sum(gross) as gross,
  sum(discounts) as discounts,
  sum(refunded) as refunded,
  sum(shipping) as shipping,
  sum(tax) as tax,
  sum(total) as total,
  sum(units) as units,
  count(distinct customer_id) filter (where is_order and is_new) as new_customers,
  sum(returns) as returns,
  sum(returned_units) as returned_units,
  sum(refunds) as refunds
`
const SALES_COLUMNS =
  "orders, gross, discounts, refunded, shipping, tax, total, units, new_customers, returns, returned_units, refunds"

const salesSource = (days: string) => `(
  select local_day, local_hour, currency_code, sales_channel, country,
    customer_id, is_new, true as is_order, gross, discounts, refunded,
    shipping, tax, total, units, 0 as returns, 0 as returned_units,
    0 as refunds
  from analytics_order_fact
  where local_day in (${days}) and deleted_at is null
  union all
  select local_day, local_hour, currency_code, sales_channel, country,
    customer_id, is_new, false, 0, 0, 0, 0, 0, 0, 0,
    case when kind = 'return' then amount else 0 end,
    case when kind = 'return' then units else 0 end,
    case when kind = 'refund' then amount else 0 end
  from analytics_event_fact
  where local_day in (${days})
) s`

type RollupStatement = { sql: string; uses: number }

const rollupSql = (days: string): RollupStatement[] => [
  {
    sql: `delete from analytics_sales_daily where local_day in (${days})`,
    uses: 1,
  },
  {
    sql: `insert into analytics_sales_daily (
     local_day, currency_code, sales_channel, country, customer_type, ${SALES_COLUMNS}
   )
   select
     local_day::date, currency_code, sales_channel, country,
     ${customerTypeSql("s")},
     ${SALES_SUMS}
   from ${salesSource(days)}
   group by 1, 2, 3, 4, 5`,
    uses: 2,
  },

  {
    sql: `delete from analytics_sales_hourly where local_day in (${days})`,
    uses: 1,
  },
  {
    sql: `insert into analytics_sales_hourly (
     local_day, local_hour, currency_code, ${SALES_COLUMNS}
   )
   select local_day::date, local_hour, currency_code, ${SALES_SUMS}
   from ${salesSource(days)}
   group by 1, 2, 3`,
    uses: 2,
  },

  {
    sql: `delete from analytics_product_daily where local_day in (${days})`,
    uses: 1,
  },
  // Keyed by product id; the title kept is the latest one seen that day.
  {
    sql: `insert into analytics_product_daily (
     local_day, currency_code, product_id, product_title, orders, gross, units
   )
   select
     local_day::date, currency_code, coalesce(product_id, ''),
     coalesce(max(product_title), 'Unknown'),
     count(distinct order_id), sum(gross), sum(quantity)
   from analytics_line_fact
   where local_day in (${days}) and deleted_at is null
   group by 1, 2, 3`,
    uses: 1,
  },

  {
    sql: `delete from analytics_variant_daily where local_day in (${days})`,
    uses: 1,
  },
  {
    sql: `insert into analytics_variant_daily (
     local_day, currency_code, product_id, variant_id, product_title,
     variant_title, orders, gross, units
   )
   select
     local_day::date, currency_code, coalesce(product_id, ''),
     coalesce(variant_id, ''), coalesce(max(product_title), 'Unknown'),
     coalesce(max(variant_title), ''), count(distinct order_id), sum(gross),
     sum(quantity)
   from analytics_line_fact
   where local_day in (${days}) and deleted_at is null
   group by 1, 2, 3, 4`,
    uses: 1,
  },
]

export type SalesFactsOptions = {
  jobsEnabled?: boolean
  fxUrl?: string
}

export const resolveSalesFactsOptions = (
  options: SalesFactsOptions | null | undefined
): SalesFactsOptions => {
  const given = options ?? {}
  if (
    given.jobsEnabled !== undefined &&
    typeof given.jobsEnabled !== "boolean"
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "salesFacts: jobsEnabled must be true or false"
    )
  }
  if (given.fxUrl !== undefined && typeof given.fxUrl !== "string") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "salesFacts: fxUrl must be a string"
    )
  }
  return given
}

class SalesFactsService extends MedusaService({
  AnalyticsFactState,
  AnalyticsOrderFact,
  AnalyticsLineFact,
}) {
  protected readonly drainLog_: AnalyticsLogger
  protected readonly options_: SalesFactsOptions

  constructor(container: { logger: Logger }, options?: SalesFactsOptions) {
    super(container)
    this.drainLog_ = analyticsLog(container.logger, "drain")
    this.options_ = resolveSalesFactsOptions(options)
  }

  async jobsEnabled(): Promise<boolean> {
    return this.options_.jobsEnabled !== false
  }

  async fxProvider(): Promise<FxRateProvider | null> {
    return fxProviderFrom(this.options_.fxUrl)
  }

  @InjectManager()
  async refreshOrders(
    orderIds: string[],
    timezone: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<RefreshResult> {
    return await this.refreshOrders_(orderIds, timezone, sharedContext)
  }

  @InjectManager()
  async queueOrders(
    orderIds: string[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<number> {
    const manager = managerOf(sharedContext.manager)
    // Unique ids: "on conflict" can't touch the same row twice in a statement.
    const unique = [...new Set(orderIds)]
    for (const batch of chunks(unique, BATCH_SIZE)) {
      await manager.execute(
        `insert into analytics_fact_queue (order_id)
         values ${batch.map(() => "(?)").join(", ")}
         on conflict (order_id) do update
         set version = analytics_fact_queue.version + 1,
             -- A new change is a new reason to try: earlier failures no
             -- longer count against it.
             attempts = 0`,
        batch
      )
    }
    return unique.length
  }

  /** Rows are removed only at the version read, so an order queued again meanwhile stays for the next batch. */
  @InjectManager()
  async drainQueue(
    limit: number,
    timezone: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<DrainResult> {
    let taken: QueueRow[] = []
    try {
      return await this.drainBatch_(
        limit,
        timezone,
        (rows) => {
          taken = rows
        },
        sharedContext
      )
    } catch (error) {
      if (taken.length) {
        try {
          await this.recordDrainFailure_(taken, sharedContext)
        } catch (recordError) {
          this.drainLog_.error(
            `Recording a failed batch of ${taken.length} queued orders failed too`,
            recordError
          )
        }
      }
      throw error
    }
  }

  @InjectTransactionManager()
  protected async drainBatch_(
    limit: number,
    timezone: string,
    onTaken: (rows: QueueRow[]) => void,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<DrainResult> {
    const manager = managerOf(sharedContext.transactionManager)
    for (const statement of tryLockStatements(DRAIN_LOCK)) {
      const [lock] = await manager.execute<{ locked: boolean }[]>(statement)
      if (!lock?.locked) {
        return { queued: 0, order_ids: [], days: 0, more: false, skipped: true }
      }
    }

    const plain = await manager.execute<QueueRow[]>(
      `select order_id, version
       from analytics_fact_queue
       where attempts = 0
       order by queued_at, order_id
       limit ?`,
      [limit]
    )
    // Failed orders retry alone, only once no new changes wait, so retries never hold up new orders.
    const [retry] = plain.length
      ? []
      : await manager.execute<QueueRow[]>(
          `select order_id, version
           from analytics_fact_queue
           where attempts > 0 and queued_at <= now() - interval '1 minute'
           order by queued_at, order_id
           limit 1`
        )
    const entries = retry ? [retry] : plain
    onTaken(entries)
    if (!entries.length) {
      return { queued: 0, order_ids: [], days: 0, more: false, skipped: false }
    }

    const orderIds = entries.map((entry) => entry.order_id)

    const { days } = await this.refreshOrders_(
      orderIds,
      timezone,
      sharedContext
    )

    for (const batch of chunks(entries, BATCH_SIZE)) {
      await manager.execute(
        `delete from analytics_fact_queue
         where (order_id, version) in (${batch.map(() => "(?, ?)").join(", ")})`,
        batch.flatMap((entry) => [entry.order_id, entry.version])
      )
    }

    return {
      queued: entries.length,
      order_ids: orderIds,
      days: days.length,
      more: Boolean(retry) || plain.length === limit,
      skipped: false,
    }
  }

  @InjectTransactionManager()
  protected async recordDrainFailure_(
    rows: QueueRow[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    const manager = managerOf(sharedContext.transactionManager)
    for (const statement of lockStatements(DRAIN_LOCK)) {
      await manager.execute(statement)
    }
    const dropped: string[] = []
    for (const batch of chunks(rows, BATCH_SIZE)) {
      const ids = placeholders(batch.length)
      const orderIds = batch.map((row) => row.order_id)
      await manager.execute(
        `update analytics_fact_queue
         set attempts = attempts + 1, queued_at = now()
         where order_id in (${ids})`,
        orderIds
      )
      const removed = await manager.execute<IdRow[]>(
        `delete from analytics_fact_queue
         where order_id in (${ids}) and attempts >= ?
         returning order_id as id`,
        [...orderIds, MAX_DRAIN_ATTEMPTS]
      )
      dropped.push(...removed.map((row) => row.id))
    }
    const shown = dropped.slice(0, 20).join(", ")
    this.drainLog_.warn(
      dropped.length
        ? `Batch of ${rows.length} queued orders failed. Dropped after ${MAX_DRAIN_ATTEMPTS} attempts, for the nightly reconcile: ${shown}${dropped.length > 20 ? ` and ${dropped.length - 20} more` : ""}`
        : `Batch of ${rows.length} queued orders failed, retrying them one at a time`
    )
  }

  @InjectManager()
  async listFxQuotes(
    base: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<FxQuote[]> {
    const manager = managerOf(sharedContext.manager)
    return await manager.execute<FxQuote[]>(
      `select q.quote, q.first_day,
         (select to_char(min(x.day), 'YYYY-MM-DD')
          from analytics_fx_rate x
          where x.base = ? and x.quote = q.quote and x.fixed) as fixed_from,
         (select to_char(max(x.day), 'YYYY-MM-DD')
          from analytics_fx_rate x
          where x.base = ? and x.quote = q.quote and x.fixed) as fixed_until,
         (select json_build_object('rate', x.rate::text,
                   'rate_day', to_char(x.rate_day, 'YYYY-MM-DD'))
          from analytics_fx_rate x
          where x.base = ? and x.quote = q.quote and x.fixed
          order by x.day desc
          limit 1) as last_fixed
       from (
         select currency_code as quote, min(local_day) as first_day
         from analytics_order_fact
         where deleted_at is null and currency_code <> ?
         group by currency_code
       ) q
       order by q.quote`,
      [base, base, base, base]
    )
  }

  @InjectManager()
  async saveFxRates(
    base: string,
    quote: string,
    provider: string,
    rows: StoredRate[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<string[]> {
    return await this.saveFxRates_(base, quote, provider, rows, sharedContext)
  }

  @InjectTransactionManager()
  protected async saveFxRates_(
    base: string,
    quote: string,
    provider: string,
    rows: StoredRate[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<string[]> {
    const manager = managerOf(sharedContext.transactionManager)
    const changed: string[] = []
    for (const batch of chunks(rows, BATCH_SIZE)) {
      const result = await manager.execute<DayRow[]>(
        `insert into analytics_fx_rate
           (base, quote, day, rate, rate_day, fixed, provider, fetched_at)
         select ?, ?, v.day::date, v.rate::numeric, v.rate_day::date,
           v.fixed::boolean, ?, now()
         from (values ${batch.map(() => "(?, ?, ?, ?)").join(", ")})
           v(day, rate, rate_day, fixed)
         on conflict (base, quote, day) do update
         set rate = excluded.rate, rate_day = excluded.rate_day,
             fixed = excluded.fixed, provider = excluded.provider,
             fetched_at = excluded.fetched_at
         where not analytics_fx_rate.fixed
           and (analytics_fx_rate.rate <> excluded.rate
             or analytics_fx_rate.rate_day <> excluded.rate_day
             or analytics_fx_rate.fixed <> excluded.fixed)
         returning to_char(day, 'YYYY-MM-DD') as day`,
        [
          base,
          quote,
          provider,
          ...batch.flatMap((row) => [
            row.day,
            row.rate,
            row.rate_day,
            row.fixed,
          ]),
        ]
      )
      changed.push(...result.map((row) => row.day))
    }
    await bumpDataVersion(manager, changed)
    return changed
  }

  /** Includes refunds, which change the order summary but not order.updated_at. */
  @InjectManager()
  async listOrderIdsChangedSince(
    since: Date,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<string[]> {
    const manager = managerOf(sharedContext.manager)
    const rows = await manager.execute<IdRow[]>(
      `select o.id
       from "order" o
       where o.updated_at >= ? or o.created_at >= ?
          or exists (
            select 1 from order_summary s
            where s.order_id = o.id and s.updated_at >= ?
          )`,
      [since, since, since]
    )
    return rows.map((row) => row.id)
  }

  @InjectManager()
  async backfillBatch(
    timezone: string,
    limit: number,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<BackfillResult> {
    try {
      return await this.backfillBatch_(timezone, limit, sharedContext)
    } catch (error) {
      // Lock wait: this method's own transaction rolled back cleanly; in a caller's (now aborted) one the caller must know.
      if (
        !(error instanceof SwapLockWaitError) ||
        sharedContext.transactionManager
      ) {
        throw error
      }
      return {
        processed: 0,
        order_ids: [],
        done: false,
        mode: "rebuild",
        swapped: false,
        swap_waiting: true,
        restarted: false,
        previous_timezone: null,
        format_changed: false,
      }
    }
  }

  @InjectTransactionManager()
  protected async refreshOrders_(
    orderIds: string[],
    timezone: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<RefreshResult> {
    const manager = managerOf(sharedContext.transactionManager)
    await lockFacts(manager)
    const state = await readState(manager)
    const { days } = await this.refreshOrderFacts_(
      orderIds,
      state?.timezone ?? timezone,
      sharedContext
    )
    await this.rebuildRollups_(days, sharedContext)
    await bumpDataVersion(manager, days)
    // Changes during a rebuild go to both sets, or the new one would miss orders the backfill had passed.
    const pending = state?.backfilled_at ? state.pending_timezone : null
    // Skipped when the set is gone or a migration changed a live table: writing it could take the live refresh down.
    if (
      pending &&
      (await nextSetExists(manager)) &&
      (await nextSetMatches(manager))
    ) {
      await useNextSet(manager, async () => {
        const next = await this.refreshOrderFacts_(
          orderIds,
          pending,
          sharedContext
        )
        await this.rebuildRollups_(next.days, sharedContext)
      })
    }
    return { orders: new Set(orderIds).size, days }
  }

  @InjectTransactionManager()
  protected async backfillBatch_(
    timezone: string,
    limit: number,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<BackfillResult> {
    const manager = managerOf(sharedContext.transactionManager)
    await lockFacts(manager)

    const existing = await readState(manager)
    const idle = (restarted = false): BackfillResult => ({
      processed: 0,
      order_ids: [],
      done: true,
      mode: null,
      swapped: false,
      restarted,
      previous_timezone: null,
      format_changed: false,
    })

    if (!existing || !existing.backfilled_at) {
      const stale =
        !!existing &&
        (existing.timezone !== timezone ||
          Number(existing.facts_format) < FACTS_FORMAT)
      const [state] = !existing
        ? await manager.execute<StateRow[]>(
            `insert into analytics_fact_state (id, timezone, facts_format)
             values (?, ?, ?)
             returning ${STATE_COLUMNS}`,
            [STATE_ID, timezone, FACTS_FORMAT]
          )
        : stale
          ? await manager.execute<StateRow[]>(
              `update analytics_fact_state
               set timezone = ?, facts_format = ?,
                   backfill_cursor_created_at = null,
                   backfill_cursor_order_id = null, updated_at = now()
               where id = ?
               returning ${STATE_COLUMNS}`,
              [timezone, FACTS_FORMAT, existing.id]
            )
          : [existing]
      const restarted = !existing || stale
      if (restarted) {
        // From empty tables, so rows built in another timezone (or of deleted orders) can't survive.
        await manager.execute(
          `truncate ${FACT_TABLE_LIST}, analytics_day_version`
        )
      }
      const step = await this.backfillStep_(
        state,
        timezone,
        limit,
        "fill",
        sharedContext
      )
      return {
        ...step,
        restarted,
        previous_timezone:
          existing && existing.timezone !== timezone ? existing.timezone : null,
        format_changed: false,
      }
    }

    const liveCurrent =
      existing.timezone === timezone &&
      Number(existing.facts_format) >= FACTS_FORMAT
    if (liveCurrent) {
      if (existing.pending_timezone !== null) {
        await dropNextSet(manager)
        await manager.execute(
          `update analytics_fact_state
           set pending_timezone = null, pending_format = null,
               pending_built_at = null, backfill_cursor_created_at = null,
               backfill_cursor_order_id = null, updated_at = now()
           where id = ?`,
          [existing.id]
        )
      }
      return idle()
    }

    const sameTarget =
      existing.pending_timezone === timezone &&
      Number(existing.pending_format ?? 0) === FACTS_FORMAT
    const restarted =
      !sameTarget ||
      !(await nextSetExists(manager)) ||
      !(await nextSetMatches(manager))
    let state = existing
    if (restarted) {
      await createNextSet(manager)
      // A copy that can't match the live tables would restart every run and never swap; fail loudly instead.
      if (!(await nextSetMatches(manager))) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "The rebuilt analytics tables differ from the live ones right after copying (an index or constraint fact-set.ts doesn't copy); the rebuild can't swap"
        )
      }
      const [updated] = await manager.execute<StateRow[]>(
        `update analytics_fact_state
         set pending_timezone = ?, pending_format = ?,
             pending_built_at = null, backfill_cursor_created_at = null,
             backfill_cursor_order_id = null, updated_at = now()
         where id = ?
         returning ${STATE_COLUMNS}`,
        [timezone, FACTS_FORMAT, existing.id]
      )
      state = updated ?? existing
    }
    const changes = {
      previous_timezone:
        existing.timezone !== timezone ? existing.timezone : null,
      format_changed: Number(existing.facts_format) < FACTS_FORMAT,
    }

    if (state.pending_built_at && !restarted) {
      await this.swap_(state, sharedContext)
      return { ...idle(restarted), mode: "rebuild", swapped: true, ...changes }
    }
    const step = await useNextSet(manager, () =>
      this.backfillStep_(state, timezone, limit, "rebuild", sharedContext)
    )
    // Not done until swapped, so a swap that waits for a lock doesn't redo this batch.
    return { ...step, done: false, restarted, ...changes }
  }

  @InjectTransactionManager()
  protected async backfillStep_(
    state: StateRow,
    timezone: string,
    limit: number,
    mode: "fill" | "rebuild",
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<
    Pick<
      BackfillResult,
      "processed" | "order_ids" | "done" | "mode" | "swapped"
    >
  > {
    const manager = managerOf(sharedContext.transactionManager)
    if (mode === "fill" && state.backfilled_at) {
      return {
        processed: 0,
        order_ids: [],
        done: true,
        mode: null,
        swapped: false,
      }
    }

    const cursor =
      state.backfill_cursor_created_at && state.backfill_cursor_order_id
        ? {
            sql: "and (created_at, id) > (?, ?)",
            bindings: [
              state.backfill_cursor_created_at,
              state.backfill_cursor_order_id,
            ],
          }
        : { sql: "", bindings: [] }
    const batch = await manager.execute<CursorRow[]>(
      `select id, created_at
       from "order"
       where deleted_at is null ${cursor.sql}
       order by created_at, id
       limit ?`,
      [...cursor.bindings, limit]
    )

    if (batch.length) {
      const { days } = await this.refreshOrderFacts_(
        batch.map((row) => row.id),
        timezone,
        sharedContext
      )
      await this.rebuildRollups_(days, sharedContext)
      if (mode === "fill") {
        await bumpDataVersion(manager, days)
      }
    }

    const last = batch[batch.length - 1]
    const done = batch.length < limit
    await manager.execute(
      `update analytics_fact_state
       set backfill_cursor_created_at = ?, backfill_cursor_order_id = ?,
           ${mode === "fill" ? "backfilled_at" : "pending_built_at"} = ?,
           updated_at = now()
       where id = ?`,
      [
        done ? null : last.created_at,
        done ? null : last.id,
        done ? new Date() : null,
        state.id,
      ]
    )
    return {
      processed: batch.length,
      order_ids: batch.map((row) => row.id),
      done,
      mode,
      swapped: false,
    }
  }

  @InjectTransactionManager()
  protected async swap_(
    state: StateRow,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    const manager = managerOf(sharedContext.transactionManager)
    await swapSets(manager)
    await manager.execute(
      `update analytics_fact_state
       set timezone = pending_timezone, facts_format = pending_format,
           pending_timezone = null, pending_format = null,
           pending_built_at = null, backfilled_at = now(), updated_at = now()
       where id = ?`,
      [state.id]
    )
    const days = await manager.execute<{ local_day: string }[]>(
      `select local_day from analytics_day_version
       union select to_char(local_day, 'YYYY-MM-DD') from analytics_sales_daily`
    )
    await bumpDataVersion(
      manager,
      days.map((row) => String(row.local_day))
    )
  }

  @InjectTransactionManager()
  protected async refreshOrderFacts_(
    orderIds: string[],
    timezone: string,
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<{ days: string[] }> {
    const manager = managerOf(sharedContext.transactionManager)
    const days = new Set<string>()

    for (const batch of chunks([...new Set(orderIds)], BATCH_SIZE)) {
      const ids = placeholders(batch.length)
      const before = await manager.execute<DayRow[]>(daysOf(ids), [
        ...batch,
        ...batch,
      ])
      // Before too: an order moved to another customer changes the old customer's first order.
      const customersBefore = await manager.execute<CustomerRow[]>(
        customersOf(ids),
        batch
      )
      await manager.execute(
        `delete from analytics_event_fact where order_id in (${ids})`,
        batch
      )
      await manager.execute(
        `delete from analytics_line_fact where order_id in (${ids})`,
        batch
      )
      await manager.execute(
        `delete from analytics_order_fact where order_id in (${ids})`,
        batch
      )
      await manager.execute(insertOrderFactsSql(ids), [
        timezone,
        timezone,
        ...batch,
      ])
      await manager.execute(insertLineFactsSql(ids), batch)
      const money = await loadOrderMoney(manager, batch)
      await setFactMoney(manager, money)
      await manager.execute(insertRefundEventsSql(ids), [
        timezone,
        timezone,
        ...batch,
      ])
      await insertReturnEvents(manager, ids, batch, timezone, money)
      const customersAfter = await manager.execute<CustomerRow[]>(
        customersOf(ids),
        batch
      )
      const firstOrderDays = await refreshFirstOrders(
        manager,
        [...customersBefore, ...customersAfter].map((row) => row.customer_id)
      )
      const after = await manager.execute<DayRow[]>(daysOf(ids), [
        ...batch,
        ...batch,
      ])
      for (const day of [
        ...before.map((row) => row.day),
        ...after.map((row) => row.day),
        ...firstOrderDays,
      ]) {
        days.add(day)
      }
    }

    return { days: [...days].sort() }
  }

  @InjectTransactionManager()
  protected async rebuildRollups_(
    days: string[],
    @MedusaContext() sharedContext: Context<SqlEntityManager> = {}
  ): Promise<void> {
    const manager = managerOf(sharedContext.transactionManager)

    for (const batch of chunks([...new Set(days)], BATCH_SIZE)) {
      for (const { sql, uses } of rollupSql(placeholders(batch.length))) {
        await manager.execute(
          sql,
          Array.from({ length: uses }, () => batch).flat()
        )
      }
    }
  }
}

export default SalesFactsService
