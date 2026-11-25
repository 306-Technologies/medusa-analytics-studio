import type { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import type { BigNumberValue } from "@medusajs/framework/types"
import { decorateCartTotals, MathBN } from "@medusajs/framework/utils"

// Lines are passed without return quantities, so gross is what was ordered; exchange and claim replacements are left out.

export const notReplacementItem = (alias: string) => `
  not exists (
    select 1
    from order_exchange_item xi
    join order_exchange x on x.id = xi.exchange_id
      and x.deleted_at is null and x.canceled_at is null
    where xi.item_id = ${alias}.item_id and xi.deleted_at is null
  )
  and not exists (
    select 1
    from order_claim_item ci
    join order_claim c on c.id = ci.claim_id
      and c.deleted_at is null and c.canceled_at is null
    where ci.item_id = ${alias}.item_id and ci.is_additional_item
      and ci.deleted_at is null
  )`

/** Exact decimal strings, never floats. */
export type OrderMoney = {
  gross: string
  discounts: string
  shipping: string
  tax: string
  total: string
  lines: Map<string, string>
  unitNet: Map<string, string>
}

type ItemRow = {
  order_id: string
  id: string
  version: number
  quantity: string
  unit_price: string
  is_tax_inclusive: boolean
}
type ShippingRow = {
  order_id: string
  id: string
  version: number
  amount: string
  is_tax_inclusive: boolean
}
type TaxLineRow = { owner_id: string; rate: string }
type AdjustmentRow = {
  owner_id: string
  amount: string
  is_tax_inclusive?: boolean
}
type CreditLineRow = { order_id: string; amount: string }

const placeholders = (count: number) => new Array(count).fill("?").join(", ")

const groupBy = <T extends { [key in K]: string }, K extends keyof T>(
  rows: T[],
  key: K
): Map<string, T[]> => {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const group = groups.get(row[key])
    if (group) {
      group.push(row)
    } else {
      groups.set(row[key], [row])
    }
  }
  return groups
}

const text = (value: BigNumberValue): string => MathBN.convert(value).toFixed()

export const loadOrderMoney = async (
  manager: SqlEntityManager,
  orderIds: string[]
): Promise<Map<string, OrderMoney>> => {
  if (!orderIds.length) {
    return new Map()
  }
  const ids = placeholders(orderIds.length)

  // One after another: they share the transaction's single connection.
  const items = await manager.execute<ItemRow[]>(
    `select o.id as order_id, li.id, oi.version, oi.quantity::text as quantity,
       coalesce(oi.unit_price, li.unit_price)::text as unit_price,
       li.is_tax_inclusive
     from "order" o
     join order_item oi
       on oi.order_id = o.id and oi.version = o.version
       and oi.deleted_at is null
     join order_line_item li on li.id = oi.item_id and li.deleted_at is null
     where o.id in (${ids})
       and ${notReplacementItem("oi")}`,
    orderIds
  )
  const shipping = await manager.execute<ShippingRow[]>(
    `select o.id as order_id, sm.id, osh.version, sm.amount::text as amount,
       sm.is_tax_inclusive
     from "order" o
     join order_shipping osh
       on osh.order_id = o.id and osh.version = o.version
       and osh.deleted_at is null
     join order_shipping_method sm
       on sm.id = osh.shipping_method_id and sm.deleted_at is null
     where o.id in (${ids})
       -- Shipping that sent exchange or claim replacements (see above).
       and osh.exchange_id is null and osh.claim_id is null`,
    orderIds
  )
  // Only version-1 credit lines: Medusa adds one for an over-refund, which is already counted as a refund.
  const credits = await manager.execute<CreditLineRow[]>(
    `select o.id as order_id, cl.amount::text as amount
     from "order" o
     join order_credit_line cl
       on cl.order_id = o.id and cl.version = 1
       and cl.deleted_at is null
     where o.id in (${ids})`,
    orderIds
  )

  const itemIds = items.map((item) => item.id)
  const methodIds = shipping.map((method) => method.id)
  const pairs = (rows: { id: string; version: number }[]) => ({
    sql: `(select distinct k.id, k.version::integer as version
      from (values ${rows.map(() => "(?, ?)").join(", ")}) k(id, version))`,
    bindings: rows.flatMap((row) => [row.id, row.version]),
  })
  const itemPairs = pairs(items)
  const methodPairs = pairs(shipping)
  const itemTax = itemIds.length
    ? await manager.execute<TaxLineRow[]>(
        `select item_id as owner_id, rate::text as rate
         from order_line_item_tax_line
         where item_id in (${placeholders(itemIds.length)})
           and deleted_at is null`,
        itemIds
      )
    : []
  // Adjustments matched by (id, version), like loadItemAdjustments: older versions keep their own rows.
  const itemAdjustments = itemIds.length
    ? await manager.execute<AdjustmentRow[]>(
        `select a.item_id as owner_id, a.amount::text as amount,
           a.is_tax_inclusive
         from order_line_item_adjustment a
         join ${itemPairs.sql} k
           on k.id = a.item_id and k.version = a.version
         where a.deleted_at is null`,
        itemPairs.bindings
      )
    : []
  const shippingTax = methodIds.length
    ? await manager.execute<TaxLineRow[]>(
        `select shipping_method_id as owner_id, rate::text as rate
         from order_shipping_method_tax_line
         where shipping_method_id in (${placeholders(methodIds.length)})
           and deleted_at is null`,
        methodIds
      )
    : []
  const shippingAdjustments = methodIds.length
    ? await manager.execute<AdjustmentRow[]>(
        `select a.shipping_method_id as owner_id, a.amount::text as amount
         from order_shipping_method_adjustment a
         join ${methodPairs.sql} k
           on k.id = a.shipping_method_id and k.version = a.version
         where a.deleted_at is null`,
        methodPairs.bindings
      )
    : []

  const itemsByOrder = groupBy(items, "order_id")
  const shippingByOrder = groupBy(shipping, "order_id")
  const creditsByOrder = groupBy(credits, "order_id")
  const itemTaxBy = groupBy(itemTax, "owner_id")
  const itemAdjustmentsBy = groupBy(itemAdjustments, "owner_id")
  const shippingTaxBy = groupBy(shippingTax, "owner_id")
  const shippingAdjustmentsBy = groupBy(shippingAdjustments, "owner_id")

  const money = new Map<string, OrderMoney>()
  for (const orderId of new Set(orderIds)) {
    const orderItems = (itemsByOrder.get(orderId) ?? []).map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      is_tax_inclusive: item.is_tax_inclusive,
      tax_lines: (itemTaxBy.get(item.id) ?? []).map((line) => ({
        rate: line.rate,
      })),
      adjustments: (itemAdjustmentsBy.get(item.id) ?? []).map((adjustment) => ({
        amount: adjustment.amount,
        is_tax_inclusive: adjustment.is_tax_inclusive,
      })),
    }))
    const methods = (shippingByOrder.get(orderId) ?? []).map((method) => ({
      id: method.id,
      amount: method.amount,
      is_tax_inclusive: method.is_tax_inclusive,
      tax_lines: (shippingTaxBy.get(method.id) ?? []).map((line) => ({
        rate: line.rate,
      })),
      adjustments: (shippingAdjustmentsBy.get(method.id) ?? []).map(
        (adjustment) => ({ amount: adjustment.amount })
      ),
    }))

    const totals = decorateCartTotals({
      items: orderItems,
      shipping_methods: methods,
      credit_lines: (creditsByOrder.get(orderId) ?? []).map((line) => ({
        amount: line.amount,
      })),
    })

    const lineTotals = orderItems.map((item) => ({
      item,
      totals: decorateCartTotals({ items: [item] }),
    }))

    money.set(orderId, {
      gross: text(totals.item_subtotal),
      // Medusa's discount_subtotal is discount_total minus its tax part; CartLikeWithTotals types only those two.
      discounts: text(
        MathBN.sub(totals.discount_total, totals.discount_tax_total)
      ),
      shipping: text(totals.shipping_subtotal),
      tax: text(totals.tax_total),
      total: text(totals.total),
      lines: new Map(
        lineTotals.map(({ item, totals: line }) => [
          item.id,
          text(line.item_subtotal),
        ])
      ),
      unitNet: new Map(
        lineTotals.map(({ item, totals: line }) => [
          item.id,
          MathBN.eq(item.quantity, 0)
            ? "0"
            : text(
                MathBN.div(
                  MathBN.sub(
                    line.item_subtotal,
                    MathBN.sub(line.discount_total, line.discount_tax_total)
                  ),
                  item.quantity
                )
              ),
        ])
      ),
    })
  }
  return money
}
