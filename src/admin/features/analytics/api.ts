import { sdk } from "../../lib/sdk"
import type {
  DeleteResponse,
  SaveDashboardBody,
  SaveDashboardResponse,
  SaveReportBody,
  SaveReportResponse,
  SqlResultResponse,
  SqlStatusResponse,
  SqlViewsResponse,
} from "../../../shared/analytics/types"
import type { LiveResponse, ReportResult, WorkspaceResponse } from "./types"

export const analyticsApi = {
  report: (query: string) =>
    sdk.client.fetch<ReportResult>("/admin/analytics/query", {
      query: { q: query },
    }),
  live: () => sdk.client.fetch<LiveResponse>("/admin/analytics/live"),
  workspace: () =>
    sdk.client.fetch<WorkspaceResponse>("/admin/analytics/workspace"),
  saveReport: (body: SaveReportBody) =>
    sdk.client.fetch<SaveReportResponse>("/admin/analytics/reports", {
      method: "POST",
      body,
    }),
  deleteReport: (id: string) =>
    sdk.client.fetch<DeleteResponse>(`/admin/analytics/reports/${id}`, {
      method: "DELETE",
    }),
  saveDashboard: (body: SaveDashboardBody) =>
    sdk.client.fetch<SaveDashboardResponse>("/admin/analytics/dashboard", {
      method: "POST",
      body,
    }),
  sqlStatus: () =>
    sdk.client.fetch<SqlStatusResponse>("/admin/analytics/sql/status"),
  sqlViews: () =>
    sdk.client.fetch<SqlViewsResponse>("/admin/analytics/sql/views"),
  // POST only because SQL is too long for a URL; it only reads.
  runSql: (q: string) =>
    sdk.client.fetch<SqlResultResponse>("/admin/analytics/sql", {
      method: "POST",
      body: { q },
    }),
  resetDashboard: () =>
    sdk.client.fetch<DeleteResponse>("/admin/analytics/dashboard", {
      method: "DELETE",
    }),
}
