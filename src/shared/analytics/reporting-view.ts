import { MedusaError } from "@medusajs/framework/utils"

// A view runs with its owner's rights, so it may join any table while exposing only its own columns.

export const REPORTING_SCHEMA = "reporting"

export type ReportingViewDefinition = {
  name: string
  comment: string
  sql: string
  columns?: Record<string, string>
}

const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/

const checkedName = (name: string, what: string): string => {
  if (!IDENTIFIER.test(name)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Reporting view ${what} "${name}" must be lowercase letters, digits and _, starting with a letter (max 63)`
    )
  }
  return name
}

// Doubling quotes is all a Postgres string literal needs.
const literal = (text: string) => `'${text.replace(/'/g, "''")}'`

const selectOf = (sql: string): string => {
  const body = sql.trim().replace(/;\s*$/, "")
  if (!body) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Reporting view sql is empty"
    )
  }
  return body
}

export const reportingView = ({
  name,
  comment,
  sql,
  columns = {},
}: ReportingViewDefinition): string => {
  const view = `${REPORTING_SCHEMA}.${checkedName(name, "name")}`
  return [
    `create schema if not exists ${REPORTING_SCHEMA}`,
    `create or replace view ${view} as\n${selectOf(sql)}`,
    `comment on view ${view} is ${literal(comment)}`,
    ...Object.entries(columns).map(
      ([column, label]) =>
        `comment on column ${view}.${checkedName(column, "column")} is ${literal(label)}`
    ),
  ]
    .map((statement) => `${statement};`)
    .join("\n")
}

export const dropReportingView = (name: string): string =>
  `drop view if exists ${REPORTING_SCHEMA}.${checkedName(name, "name")};`
