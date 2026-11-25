import { MedusaError } from "@medusajs/framework/utils"

const READ_STATEMENT = /^\s*(select|with)\b/i

const FORBIDDEN =
  /\b(set_config|dblink\w*|lo_\w+|pg_read_\w+|pg_ls_\w+|pg_stat_file|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_sleep\w*|pg_advisory\w*|pg_try_advisory\w*)\s*\(/i

const ESCAPED_IDENTIFIER = /\bu&["']/i

const WRITE_KEYWORD = /\b(insert|update|delete|merge|truncate|copy)\b/i

const HIDING_MARKER = /--|\/\*|\$/

export const assertReadStatement = (sql: string): void => {
  const flat = sql.replace(/"/g, "")
  if (
    HIDING_MARKER.test(sql) ||
    !READ_STATEMENT.test(flat) ||
    sql.includes(";") ||
    FORBIDDEN.test(flat) ||
    WRITE_KEYWORD.test(flat) ||
    ESCAPED_IDENTIFIER.test(sql)
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "analyticsReader only runs a single read-only SELECT"
    )
  }
}

export const readOnlySetup = (timeoutMs: number, applicationName: string) =>
  `set default_transaction_read_only = on;
   set statement_timeout = ${timeoutMs};
   set application_name = '${applicationName}';`

export const READ_ONLY_CHECK = "show default_transaction_read_only"

export const isReadOnlyResult = (result: unknown): boolean => {
  if (typeof result !== "object" || result === null || !("rows" in result)) {
    return false
  }
  const { rows } = result
  if (!Array.isArray(rows) || rows.length !== 1) {
    return false
  }
  const [row]: unknown[] = rows
  return (
    typeof row === "object" &&
    row !== null &&
    "default_transaction_read_only" in row &&
    row.default_transaction_read_only === "on"
  )
}
