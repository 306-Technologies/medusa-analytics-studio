// No server imports: the admin bundle uses this too.

export const REPORTING_TIMEZONE_KEY = "reporting_timezone"

export const DEFAULT_REPORTING_TIMEZONE = "UTC"

export const isTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value })
    return true
  } catch {
    return false
  }
}

export const reportingTimezoneOf = (
  metadata: Record<string, unknown> | null | undefined
): string => {
  const value = metadata?.[REPORTING_TIMEZONE_KEY]
  return typeof value === "string" && isTimezone(value)
    ? value
    : DEFAULT_REPORTING_TIMEZONE
}
