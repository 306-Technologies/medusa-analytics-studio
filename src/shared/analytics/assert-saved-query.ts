import { MedusaError } from "@medusajs/framework/utils"

import { parseQuery } from "./query-language"
import type { ReportKind } from "./types"

// SQL reports are not checked here: Postgres checks them on every run as the restricted role.
export const assertSavedQuery = (
  kind: ReportKind,
  query: string,
  what: string
) => {
  if (kind === "sql") {
    return
  }
  const parsed = parseQuery(query)
  if (!parsed.ok) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${what}: ${parsed.error}`
    )
  }
}
