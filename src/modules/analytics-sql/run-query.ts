import { MedusaError } from "@medusajs/framework/utils"
import { type Pool, type PoolClient, type QueryResult, TypeOverrides } from "pg"
import Cursor from "pg-cursor"

import type {
  SqlColumn,
  SqlColumnKind,
  SqlJson,
  SqlResultResponse,
} from "../../shared/analytics/types"
import { ROLE_STATEMENT_TIMEOUT } from "./reporting-role"

// One statement only: a cursor uses the extended protocol, which refuses "select 1; select 2" by itself.

export const ROW_LIMIT = 5_000

export type SqlRun = Omit<SqlResultResponse, "cached">

const OID = {
  bool: 16,
  bytea: 17,
  char: 18,
  name: 19,
  int8: 20,
  int2: 21,
  int4: 23,
  text: 25,
  oid: 26,
  json: 114,
  float4: 700,
  float8: 701,
  money: 790,
  bpchar: 1042,
  varchar: 1043,
  date: 1082,
  time: 1083,
  timestamp: 1114,
  timestamptz: 1184,
  interval: 1186,
  timetz: 1266,
  numeric: 1700,
  uuid: 2950,
  jsonb: 3802,
} as const

const KINDS: Record<number, SqlColumnKind> = {
  [OID.int2]: "number",
  [OID.int4]: "number",
  [OID.int8]: "number",
  [OID.oid]: "number",
  [OID.float4]: "number",
  [OID.float8]: "number",
  [OID.numeric]: "number",
  [OID.money]: "number",
  [OID.bool]: "boolean",
  [OID.date]: "date",
  [OID.timestamp]: "date",
  [OID.timestamptz]: "date",
  [OID.char]: "text",
  [OID.name]: "text",
  [OID.text]: "text",
  [OID.bpchar]: "text",
  [OID.varchar]: "text",
  [OID.uuid]: "text",
  [OID.json]: "json",
  [OID.jsonb]: "json",
}

/** Dates stay text: pg would parse a date as midnight in the server's timezone. bigint and numeric stay text for precision. */
export const sqlTypes = (() => {
  const types = new TypeOverrides()
  const asText = (value: string) => value
  for (const oid of [
    OID.bytea,
    OID.date,
    OID.time,
    OID.timestamp,
    OID.timestamptz,
    OID.interval,
    OID.timetz,
  ]) {
    types.setTypeParser(oid, asText)
  }
  return types
})()

export const toJson = (value: unknown): SqlJson => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value
  }
  if (value === undefined) {
    return null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value)
  }
  if (Array.isArray(value)) {
    return value.map(toJson)
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJson(item)])
    )
  }
  return String(value)
}

type PgErrorLike = { code: string; message: string; position?: string }

const pgError = (error: unknown): PgErrorLike | null =>
  error instanceof Error &&
  "code" in error &&
  typeof error.code === "string" &&
  /^[0-9A-Z]{5}$/.test(error.code)
    ? {
        code: error.code,
        message: error.message,
        position:
          "position" in error && typeof error.position === "string"
            ? error.position
            : undefined,
      }
    : null

export class SqlQueryError extends MedusaError {
  readonly sqlState: string | undefined

  constructor(type: string, message: string, sqlState: string | undefined) {
    super(type, message)
    this.sqlState = sqlState
  }
}

export const sqlErrorCode = (error: unknown): string | undefined =>
  error instanceof SqlQueryError ? error.sqlState : pgError(error)?.code

const INFRASTRUCTURE = /^(08|53|57P|58|XX)/

export const toMedusaError = (error: unknown): SqlQueryError => {
  const pg = pgError(error)
  if (!pg || INFRASTRUCTURE.test(pg.code)) {
    return new SqlQueryError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The query could not run on the reporting replica. Try again shortly.",
      pg?.code
    )
  }
  if (pg.code === "57014") {
    return new SqlQueryError(
      MedusaError.Types.INVALID_DATA,
      `The query ran longer than ${ROLE_STATEMENT_TIMEOUT} and was cancelled. Narrow it down (fewer days, fewer joins) and try again.`,
      pg.code
    )
  }
  if (pg.code === "40001") {
    return new SqlQueryError(
      MedusaError.Types.INVALID_DATA,
      "The replica cancelled the query because rows it was reading changed meanwhile. Run it again.",
      pg.code
    )
  }
  const where = pg.position ? ` (at character ${pg.position})` : ""
  const hint =
    pg.code === "42501" || pg.code === "42P01"
      ? ". SQL mode reads only views in the reporting schema."
      : ""
  return new SqlQueryError(
    MedusaError.Types.INVALID_DATA,
    `${pg.message}${where}${hint}`,
    pg.code
  )
}

const readRows = (
  cursor: Cursor<unknown[]>,
  count: number
): Promise<{ rows: unknown[][]; result: QueryResult }> =>
  new Promise((resolve, reject) => {
    cursor.read(count, (error, rows, result) =>
      error ? reject(error) : resolve({ rows, result })
    )
  })

const typeNames = new Map<number, string>()

const columnsOf = async (
  client: PoolClient,
  result: QueryResult
): Promise<SqlColumn[]> => {
  const missing = [
    ...new Set(
      result.fields.map((f) => f.dataTypeID).filter((id) => !typeNames.has(id))
    ),
  ]
  if (missing.length) {
    const found = await client.query<{ oid: number; name: string }>(
      "select oid::int as oid, format_type(oid, null) as name from pg_catalog.pg_type where oid = any($1::oid[])",
      [missing]
    )
    for (const row of found.rows) {
      typeNames.set(row.oid, row.name)
    }
  }
  return result.fields.map((field) => ({
    name: field.name,
    type: typeNames.get(field.dataTypeID) ?? String(field.dataTypeID),
    kind: KINDS[field.dataTypeID] ?? "other",
  }))
}

/** set_config can change session defaults, so each query gets its own read-only transaction (select 1 blocks a later set transaction read write) and local timeout, on a connection never reused. */
export const runQuery = async (pool: Pool, sql: string): Promise<SqlRun> => {
  const started = Date.now()
  const client = await pool.connect()
  try {
    await client.query("begin transaction read only")
    await client.query(
      `set local statement_timeout = '${ROLE_STATEMENT_TIMEOUT}'`
    )
    await client.query("select 1")
    const cursor = client.query(
      new Cursor<unknown[]>(sql, [], { rowMode: "array", types: sqlTypes })
    )
    const { rows, result } = await readRows(cursor, ROW_LIMIT + 1)
    const ms = Date.now() - started
    await cursor.close()
    const columns = await columnsOf(client, result)
    await client.query("rollback")
    return {
      columns,
      rows: rows.slice(0, ROW_LIMIT).map((row) => row.map(toJson)),
      row_limit: ROW_LIMIT,
      truncated: rows.length > ROW_LIMIT,
      ms,
      ran_at: new Date(started).toISOString(),
    }
  } finally {
    client.release(true)
  }
}
