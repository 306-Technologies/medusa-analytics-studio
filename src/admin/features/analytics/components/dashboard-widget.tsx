import { ChevronRightMini, DotsSix, Resize, Trash } from "@medusajs/icons"
import { IconButton, Text, Tooltip } from "@medusajs/ui"
import type { DragEvent } from "react"
import { Link } from "react-router-dom"

import {
  formatQuery,
  parseQuery,
  type Comparison,
} from "../../../../shared/analytics/query-language"
import type { Period } from "../periods"
import { useReport, useSqlResult, useSqlStatus } from "../queries"
import { newReportHref } from "../reports"
import { SQL_HREF } from "../routes"
import { fitChart, fromSavedChart } from "../sql"
import { sqlReportResult } from "../sql-report"
import type { DashboardWidget as Widget, WidgetSpan } from "../storage"
import { ChartView } from "../charts/chart-view"
import { ChartCard } from "../charts/shared/chart-card"
import { chartFor } from "../charts/registry"
import { SqlResultTable } from "./sql-result-table"
import { rebuildLabel, rebuildNotice } from "../rebuild-notice"
import { useSpanResize } from "../use-span-resize"
import {
  ChartPlaceholder,
  ChartSkeleton,
  TableSkeleton,
} from "../charts/shared/chart-skeleton"

type Props = {
  widget: Widget
  period: Period
  compare: Comparison
  editing: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
  onResize: (span: WidgetSpan) => void
  onRemove: () => void
}

const allowDrop = (event: DragEvent) => event.preventDefault()

const tileHeight = (visualization: string) =>
  chartFor(visualization).id === "stat" ? 96 : 220

export const DashboardWidget = ({
  widget,
  period,
  compare,
  editing,
  dragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onResize,
  onRemove,
}: Props) => {
  const isSql = widget.kind === "sql"
  const parsed = parseQuery(isSql ? "" : widget.query)
  const query =
    !isSql && parsed.ok
      ? formatQuery({ ...parsed.query, ...period, compare })
      : null
  const { data, error } = useReport(query)

  const sqlStatus = useSqlStatus()
  const sqlOn = sqlStatus.data?.enabled === true
  const sql = useSqlResult(isSql && sqlOn ? widget.query : null)
  const savedChart = fromSavedChart(widget.visualization, widget.chart)
  const sqlChart =
    sql.data && savedChart ? fitChart(savedChart, sql.data.columns) : null

  const openLink = isSql
    ? {
        to: SQL_HREF,
        state: { name: widget.title, sql: widget.query, chart: savedChart },
      }
    : {
        to: newReportHref({
          query: query ?? widget.query,
          visualization: widget.visualization,
          name: widget.title,
        }),
      }

  const chart = chartFor(widget.visualization)
  const height = tileHeight(widget.visualization)
  const resize = useSpanResize(widget.span, onResize)

  const sqlSkeleton =
    savedChart?.kind === "table" ? (
      <TableSkeleton rows={6} compact />
    ) : (
      <ChartSkeleton chartId={widget.visualization} height={height} compact />
    )

  const sqlBody =
    !sqlStatus.data && sqlStatus.isLoading ? (
      sqlSkeleton
    ) : !sqlOn ? (
      <Text size="small" className="text-ui-fg-muted">
        SQL mode is off, so this SQL report can't run.
      </Text>
    ) : sql.error ? (
      <Text size="small" className="text-ui-fg-error">
        {sql.error instanceof Error ? sql.error.message : "Could not load."}
      </Text>
    ) : !sql.data || !sqlChart ? (
      sqlSkeleton
    ) : sqlChart.kind === "table" ? (
      <SqlResultTable result={sql.data} compact />
    ) : (
      <ChartView
        result={sqlReportResult(sql.data, sqlChart)}
        chartId={sqlChart.kind}
        height={height}
        compact
      />
    )

  return (
    <ChartCard
      data-dashboard-tile
      className={`group relative flex flex-col ${dragging ? "opacity-40" : ""} ${
        editing ? "cursor-grab" : ""
      } ${resize.resizing ? "ring-ui-border-interactive ring-1" : ""}`}
      style={{ gridColumn: `span ${resize.span} / span ${resize.span}` }}
      draggable={editing}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        onDragStart()
      }}
      onDragEnter={onDragEnter}
      onDragOver={editing ? allowDrop : undefined}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center justify-between gap-x-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-x-1.5">
          {editing ? <DotsSix className="text-ui-fg-muted shrink-0" /> : null}
          <span className="analytics-title truncate">{widget.title}</span>
          {data?.truncated ? (
            <Tooltip
              content={`Showing the top ${data.rows.length.toLocaleString()} rows only. Add a LIMIT or a narrower GROUP BY.`}
            >
              <Text size="xsmall" className="text-ui-fg-muted shrink-0">
                Top rows only
              </Text>
            </Tooltip>
          ) : null}
          {data?.unconverted_orders ? (
            <Tooltip
              content={`${data.unconverted_orders.toLocaleString()} orders in other currencies have no exchange rate for their day yet, so they are left out.`}
            >
              <Text size="xsmall" className="text-ui-fg-muted shrink-0">
                {data.unconverted_orders.toLocaleString()} not converted
              </Text>
            </Tooltip>
          ) : null}
          {data?.rebuilding ? (
            <Tooltip content={rebuildNotice(data) ?? ""}>
              <Text size="xsmall" className="text-ui-fg-muted shrink-0">
                {rebuildLabel(data)}
              </Text>
            </Tooltip>
          ) : null}
        </div>
        {editing ? (
          <div className="flex shrink-0 items-center gap-x-1">
            <IconButton
              size="2xsmall"
              variant="transparent"
              aria-label={`Remove ${widget.title}`}
              onClick={onRemove}
            >
              <Trash />
            </IconButton>
          </div>
        ) : (
          <Tooltip content={isSql ? "Open in SQL mode" : "Open as a report"}>
            <IconButton
              size="2xsmall"
              variant="transparent"
              className="text-ui-fg-muted opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              asChild
            >
              <Link
                to={openLink.to}
                state={"state" in openLink ? openLink.state : undefined}
                aria-label={`Open ${widget.title} as a report`}
              >
                <ChevronRightMini />
              </Link>
            </IconButton>
          </Tooltip>
        )}
      </div>

      <div className={`flex-1 ${chart.isTable ? "pt-3" : "px-4 pb-3 pt-4"}`}>
        {isSql ? (
          sqlBody
        ) : !parsed.ok || error ? (
          <Text size="small" className="text-ui-fg-error">
            {!parsed.ok
              ? parsed.error
              : error instanceof Error
                ? error.message
                : "Could not load."}
          </Text>
        ) : !data ? (
          <ChartSkeleton
            chartId={widget.visualization}
            height={height}
            compact
          />
        ) : data.filling ? (
          <ChartPlaceholder height={height}>
            {rebuildNotice(data)}
          </ChartPlaceholder>
        ) : (
          <ChartView
            result={data}
            chartId={widget.visualization}
            height={height}
            compact
          />
        )}
      </div>

      {editing ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Width of ${widget.title}, in columns`}
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={resize.span}
          aria-valuetext={`${resize.span} of 4 columns`}
          className="text-ui-fg-muted hover:text-ui-fg-base focus-visible:shadow-borders-focus absolute bottom-0 right-0 hidden size-6 cursor-ew-resize touch-none items-center justify-center rounded-md outline-none lg:flex"
          {...resize.handleProps}
        >
          <Resize />
        </div>
      ) : null}
    </ChartCard>
  )
}

export const DashboardWidgetSkeleton = ({ widget }: { widget: Widget }) => {
  const chart = chartFor(widget.visualization)
  return (
    <ChartCard
      className="flex flex-col"
      style={{ gridColumn: `span ${widget.span} / span ${widget.span}` }}
    >
      <div className="box-content flex h-5 items-center px-4 pt-3">
        <span className="analytics-title truncate">{widget.title}</span>
      </div>
      <div className={`flex-1 ${chart.isTable ? "pt-3" : "px-4 pb-3 pt-4"}`}>
        <ChartSkeleton
          chartId={widget.visualization}
          height={tileHeight(widget.visualization)}
          compact
        />
      </div>
    </ChartCard>
  )
}
