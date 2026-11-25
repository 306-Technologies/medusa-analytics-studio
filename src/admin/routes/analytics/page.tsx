import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar, CogSixTooth, Plus } from "@medusajs/icons"
import { Button, Heading, Text, toast } from "@medusajs/ui"
import { useState } from "react"

import type { Comparison } from "../../../shared/analytics/query-language"
import { AddWidgetDrawer } from "../../features/analytics/components/add-widget-drawer"
import {
  DashboardWidget,
  DashboardWidgetSkeleton,
} from "../../features/analytics/components/dashboard-widget"
import {
  ComparePicker,
  PeriodPicker,
} from "../../features/analytics/components/period-picker"
import { DEFAULT_PERIOD, type Period } from "../../features/analytics/periods"
import { useReportingTimezone } from "../../features/analytics/queries"
import {
  DEFAULT_DASHBOARD,
  moveWidget,
  removeWidget,
  resetDashboard,
  resizeWidget,
  useDashboard,
  useWorkspaceMode,
} from "../../features/analytics/storage"

const AnalyticsDashboardPage = () => {
  const widgets = useDashboard()
  const mode = useWorkspaceMode()
  const { data: reporting } = useReportingTimezone()
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD)
  const [compare, setCompare] = useState<Comparison>("previous_period")
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-x-3">
          <Heading>Analytics</Heading>
          <PeriodPicker value={period} onChange={setPeriod} />
          <ComparePicker value={compare} onChange={setCompare} />
          {reporting ? (
            <Text size="small" className="text-ui-fg-muted">
              Times in {reporting.timezone}
            </Text>
          ) : null}
        </div>
        <div className="flex items-center gap-x-2">
          {editing ? (
            <>
              <Button
                size="small"
                variant="transparent"
                onClick={() => {
                  resetDashboard()
                  toast.success("Dashboard put back to the default")
                }}
              >
                Reset
              </Button>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setAdding(true)}
              >
                <Plus />
                Add widget
              </Button>
              <Button size="small" onClick={() => setEditing(false)}>
                Done
              </Button>
            </>
          ) : (
            <Button
              size="small"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              <CogSixTooth />
              Customize
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <Text size="small" className="text-ui-fg-subtle">
          Drag a tile to move it. Drag its bottom-right corner to make it wider
          or narrower.{" "}
          {mode === "browser"
            ? "This demo is read-only, so your layout is kept in this browser."
            : "Changes are saved to your account as you go."}
        </Text>
      ) : null}

      {mode === "loading" ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          {DEFAULT_DASHBOARD.map((widget) => (
            <DashboardWidgetSkeleton key={widget.id} widget={widget} />
          ))}
        </div>
      ) : widgets.length === 0 ? (
        <div className="border-ui-border-strong flex flex-col items-center gap-y-3 rounded-lg border border-dashed px-6 py-16">
          <Text size="small" className="text-ui-fg-subtle">
            The dashboard is empty.
          </Text>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setAdding(true)}
          >
            <Plus />
            Add a widget
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-4"
          data-tour-anchor="analytics.dashboard"
        >
          {widgets.map((widget) => (
            <DashboardWidget
              key={widget.id}
              widget={widget}
              period={period}
              compare={compare}
              editing={editing}
              dragging={draggedId === widget.id}
              onDragStart={() => setDraggedId(widget.id)}
              onDragEnter={() => {
                if (draggedId) {
                  moveWidget(draggedId, widget.id)
                }
              }}
              onDragEnd={() => setDraggedId(null)}
              onResize={(span) => resizeWidget(widget.id, span)}
              onRemove={() => removeWidget(widget.id)}
            />
          ))}
        </div>
      )}

      <AddWidgetDrawer open={adding} onOpenChange={setAdding} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
  icon: ChartBar,
})

export const handle = {
  breadcrumb: () => "Analytics",
}

export default AnalyticsDashboardPage
