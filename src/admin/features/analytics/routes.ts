export const DASHBOARD_HREF = "/analytics"
export const LIVE_HREF = "/analytics/live"
export const REPORTS_HREF = "/analytics/reports"
export const SQL_HREF = "/analytics/sql"

export const NEW_REPORT_ID = "new"

export const reportHref = (id: string): string => `${REPORTS_HREF}/${id}`
