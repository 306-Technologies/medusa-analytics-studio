import type { SqlBinding } from "../service"

export type { SqlBinding }

export type Raw<T> = { rows: T[] }

export type SqlRunner = {
  raw: (
    sql: string,
    bindings: SqlBinding[]
  ) => Promise<Raw<Record<string, unknown>>>
}
