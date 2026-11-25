import { MedusaError } from "@medusajs/framework/utils"

export type AnalyticsReaderOptions = {
  databaseUrl?: string
  poolMax?: number
  statementTimeoutMs?: number
  ssl?: boolean
  separateDatabase?: boolean
}

export type ReaderSettings = {
  databaseUrl: string | undefined
  poolMax: number
  statementTimeoutMs: number
  ssl: boolean
  separateDatabase: boolean
}

const DEFAULT_POOL_MAX = 3
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000

const invalid = (message: string): MedusaError =>
  new MedusaError(MedusaError.Types.INVALID_DATA, `analyticsReader: ${message}`)

const positiveInt = (
  name: string,
  value: number | undefined,
  fallback: number
): number => {
  if (value === undefined) {
    return fallback
  }
  if (!Number.isInteger(value) || value < 1) {
    throw invalid(`${name} must be a whole number above zero`)
  }
  return value
}

const flag = (name: string, value: boolean | undefined): boolean => {
  if (value === undefined) {
    return false
  }
  if (typeof value !== "boolean") {
    throw invalid(`${name} must be true or false`)
  }
  return value
}

export const resolveReaderOptions = (
  options: AnalyticsReaderOptions | undefined
): ReaderSettings => {
  const given = options ?? {}
  if (
    given.databaseUrl !== undefined &&
    typeof given.databaseUrl !== "string"
  ) {
    throw invalid("databaseUrl must be a string")
  }
  const settings: ReaderSettings = {
    databaseUrl: given.databaseUrl || undefined,
    poolMax: positiveInt("poolMax", given.poolMax, DEFAULT_POOL_MAX),
    statementTimeoutMs: positiveInt(
      "statementTimeoutMs",
      given.statementTimeoutMs,
      DEFAULT_STATEMENT_TIMEOUT_MS
    ),
    ssl: flag("ssl", given.ssl),
    separateDatabase: flag("separateDatabase", given.separateDatabase),
  }
  if (settings.separateDatabase && !settings.databaseUrl) {
    throw invalid("separateDatabase needs databaseUrl")
  }
  return settings
}
