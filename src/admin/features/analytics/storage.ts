import { toast } from "@medusajs/ui"
import { useEffect, useSyncExternalStore } from "react"

import { analyticsApi } from "./api"
import { isChartId } from "./charts/registry"
import { BUILT_IN_REPORTS } from "./reports"
import { isColumnIndex } from "./sql"
import type {
  ReportDefinition,
  ReportKind,
  SavedReport,
  SavedWidget,
  SqlChartColumns,
  Visualization,
} from "./types"

export type WidgetSpan = SavedWidget["span"]
export type DashboardWidget = SavedWidget

type Mode = "loading" | "server" | "browser"

const REPORTS_KEY = "analytics.reports.v1"
const DASHBOARD_KEY = "analytics.dashboard.v1"

const widgetFrom = (reportId: string, span: WidgetSpan): DashboardWidget => {
  const report = BUILT_IN_REPORTS.find((entry) => entry.id === reportId)
  if (!report) {
    throw new Error(`Unknown built-in report: ${reportId}`)
  }
  return {
    id: `default-${reportId}`,
    title: report.name,
    kind: "query",
    query: report.query,
    visualization: report.visualization,
    chart: null,
    span,
  }
}

export const DEFAULT_DASHBOARD: DashboardWidget[] = [
  widgetFrom("total-sales", 1),
  widgetFrom("total-orders", 1),
  widgetFrom("aov", 1),
  widgetFrom("customer-count", 1),
  widgetFrom("sales-over-time", 2),
  widgetFrom("net-sales", 2),
  widgetFrom("sales-by-product", 2),
  widgetFrom("sales-by-country", 2),
  widgetFrom("when-people-buy", 2),
  widgetFrom("new-vs-returning", 2),
  widgetFrom("gross-to-net", 2),
  widgetFrom("product-rank", 2),
]

type State = {
  mode: Mode
  readOnly: boolean
  reports: ReportDefinition[]
  dashboard: DashboardWidget[]
}

let state: State = {
  mode: "loading",
  readOnly: false,
  reports: [],
  dashboard: DEFAULT_DASHBOARD,
}
const listeners = new Set<() => void>()

const setState = (change: Partial<State>) => {
  state = { ...state, ...change }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const toDefinition = (report: SavedReport): ReportDefinition => ({
  ...report,
  category: "Custom",
  createdBy: "You",
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isSpan = (value: unknown): value is WidgetSpan =>
  value === 1 || value === 2 || value === 3 || value === 4

const toKind = (value: unknown): ReportKind =>
  value === "sql" ? "sql" : "query"

const toChart = (value: unknown): SqlChartColumns | null =>
  isRecord(value) &&
  Array.isArray(value.values) &&
  value.values.every(isColumnIndex)
    ? {
        label: isColumnIndex(value.label) ? value.label : null,
        values: value.values.filter(isColumnIndex),
      }
    : null

const toWidget = (value: unknown): DashboardWidget | null =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.query === "string" &&
  typeof value.visualization === "string" &&
  isChartId(value.visualization) &&
  isSpan(value.span)
    ? {
        id: value.id,
        title: value.title,
        kind: toKind(value.kind),
        query: value.query,
        visualization: value.visualization,
        chart: toChart(value.chart),
        span: value.span,
      }
    : null

const toReport = (value: unknown): ReportDefinition | null =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.query === "string" &&
  typeof value.visualization === "string" &&
  isChartId(value.visualization)
    ? toDefinition({
        id: value.id,
        name: value.name,
        description:
          typeof value.description === "string" ? value.description : "",
        kind: toKind(value.kind),
        query: value.query,
        visualization: value.visualization,
        chart: toChart(value.chart),
      })
    : null

const readBrowser = <T>(
  key: string,
  parse: (value: unknown) => T | null
): T[] | null => {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed)
      ? parsed.flatMap((entry) => {
          const item = parse(entry)
          return item ? [item] : []
        })
      : null
  } catch {
    return null
  }
}

const writeBrowser = (key: string, value: unknown) => {
  try {
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // Private windows can refuse storage; the change lasts until closed.
  }
}

let loading: Promise<void> | null = null

const load = (): Promise<void> => {
  loading ??= (async () => {
    let readOnly = false
    try {
      const workspace = await analyticsApi.workspace()
      readOnly = workspace.read_only
      if (!readOnly) {
        setState({
          mode: "server",
          readOnly,
          reports: workspace.reports.map(toDefinition),
          dashboard: workspace.dashboard ?? DEFAULT_DASHBOARD,
        })
        return
      }
    } catch {
      // Fall through to browser storage rather than fail the page.
    }

    setState({
      mode: "browser",
      readOnly,
      reports: readBrowser(REPORTS_KEY, toReport) ?? [],
      dashboard: readBrowser(DASHBOARD_KEY, toWidget) ?? DEFAULT_DASHBOARD,
    })
  })()
  return loading
}

const useWorkspace = (): State => {
  useEffect(() => {
    void load()
  }, [])
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  )
}

export const useWorkspaceReady = (): boolean =>
  useWorkspace().mode !== "loading"

export const useWorkspaceMode = (): Mode => useWorkspace().mode

export const useWorkspaceReadOnly = (): boolean => useWorkspace().readOnly

export const useCustomReports = (): ReportDefinition[] => useWorkspace().reports

export const useAllReports = (): ReportDefinition[] => {
  const custom = useCustomReports()
  return [...custom, ...BUILT_IN_REPORTS]
}

export const useDashboard = (): DashboardWidget[] => useWorkspace().dashboard

export const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const failed = (what: string, error: unknown) =>
  toast.error(what, {
    description: error instanceof Error ? error.message : undefined,
  })

export type ReportInput = {
  id?: string
  name: string
  description: string
  kind: ReportKind
  query: string
  visualization: Visualization
  chart: SqlChartColumns | null
}

export const saveCustomReport = async (
  input: ReportInput
): Promise<ReportDefinition> => {
  await load()
  const saved =
    state.mode === "server"
      ? toDefinition((await analyticsApi.saveReport(input)).report)
      : toDefinition({ ...input, id: input.id ?? newId() })

  const reports = [
    saved,
    ...state.reports.filter((entry) => entry.id !== saved.id),
  ]
  setState({ reports })
  if (state.mode === "browser") {
    writeBrowser(REPORTS_KEY, reports)
  }
  return saved
}

export const deleteCustomReport = async (id: string): Promise<void> => {
  await load()
  if (state.mode === "server") {
    await analyticsApi.deleteReport(id)
  }
  const reports = state.reports.filter((entry) => entry.id !== id)
  setState({ reports })
  if (state.mode === "browser") {
    writeBrowser(REPORTS_KEY, reports)
  }
}

const SAVE_DELAY_MS = 500
let pendingSave: ReturnType<typeof setTimeout> | null = null

const pushDashboard = () => {
  if (pendingSave) {
    clearTimeout(pendingSave)
  }
  pendingSave = setTimeout(() => {
    pendingSave = null
    analyticsApi
      .saveDashboard({ widgets: state.dashboard })
      .catch((error: unknown) => failed("The dashboard was not saved", error))
  }, SAVE_DELAY_MS)
}

export const saveDashboard = (widgets: DashboardWidget[]) => {
  setState({ dashboard: widgets })
  if (state.mode === "server") {
    pushDashboard()
  } else {
    writeBrowser(DASHBOARD_KEY, widgets)
  }
}

export const resetDashboard = () => {
  if (pendingSave) {
    clearTimeout(pendingSave)
    pendingSave = null
  }
  setState({ dashboard: DEFAULT_DASHBOARD })
  if (state.mode === "server") {
    analyticsApi
      .resetDashboard()
      .catch((error: unknown) => failed("The dashboard was not reset", error))
  } else {
    writeBrowser(DASHBOARD_KEY, null)
  }
}

const defaultSpan = (visualization: Visualization): WidgetSpan =>
  visualization === "stat" ? 1 : 2

export const addReportToDashboard = (
  report: Pick<
    ReportDefinition,
    "name" | "kind" | "query" | "visualization" | "chart"
  >,
  { openDashboard }: { openDashboard?: () => void } = {}
) => {
  // The dashboard may not be loaded yet (the SQL page doesn't read it).
  void load().then(() => addWidget(report, openDashboard))
}

const addWidget = (
  report: Pick<
    ReportDefinition,
    "name" | "kind" | "query" | "visualization" | "chart"
  >,
  openDashboard: (() => void) | undefined
) => {
  const widget: DashboardWidget = {
    id: newId(),
    title: report.name,
    kind: report.kind,
    query: report.query,
    visualization: report.visualization,
    chart: report.chart,
    span: defaultSpan(report.visualization),
  }
  saveDashboard([...state.dashboard, widget])
  toast.success(`${report.name} added to the dashboard`, {
    action: openDashboard
      ? {
          label: "Open dashboard",
          altText: "Open the dashboard",
          onClick: openDashboard,
        }
      : undefined,
  })
}

export const moveWidget = (id: string, targetId: string) => {
  if (id === targetId) {
    return
  }
  const from = state.dashboard.findIndex((widget) => widget.id === id)
  const to = state.dashboard.findIndex((widget) => widget.id === targetId)
  if (from === -1 || to === -1) {
    return
  }
  const next = [...state.dashboard]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  saveDashboard(next)
}

export const resizeWidget = (id: string, span: WidgetSpan) =>
  saveDashboard(
    state.dashboard.map((widget) =>
      widget.id === id ? { ...widget, span } : widget
    )
  )

export const removeWidget = (id: string) =>
  saveDashboard(state.dashboard.filter((widget) => widget.id !== id))
