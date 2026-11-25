export const analyticsKeys = {
  all: ["analytics"] as const,
  report: (query: string) => [...analyticsKeys.all, "report", query] as const,
  live: () => [...analyticsKeys.all, "live"] as const,
  timezone: () => [...analyticsKeys.all, "timezone"] as const,
  sqlStatus: () => [...analyticsKeys.all, "sql", "status"] as const,
  sqlViews: () => [...analyticsKeys.all, "sql", "views"] as const,
  sql: (q: string) => [...analyticsKeys.all, "sql", "run", q] as const,
}
