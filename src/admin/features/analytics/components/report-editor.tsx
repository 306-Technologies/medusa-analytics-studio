import {
  EllipsisHorizontal,
  PencilSquare,
  PlusMini,
  SquaresPlus,
  Trash,
  XMark,
} from "@medusajs/icons"
import {
  Button,
  Container,
  Divider,
  DropdownMenu,
  Heading,
  IconButton,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  DIMENSIONS,
  formatQuery,
  MAX_DIMENSIONS,
  METRICS,
  parseQuery,
  validateQuery,
  type DimensionKey,
  type MetricKey,
  type ReportQuery,
} from "../../../../shared/analytics/query-language"
import { StateMessage } from "../../../components/state-message"
import { TitledSection } from "../../../components/titled-section"
import { formatRange } from "../format"
import { useReport } from "../queries"
import { DASHBOARD_HREF, REPORTS_HREF, reportHref } from "../routes"
import {
  addReportToDashboard,
  deleteCustomReport,
  saveCustomReport,
} from "../storage"
import { ChartView } from "../charts/chart-view"
import { chartFor } from "../charts/registry"
import { ChartCard } from "../charts/shared/chart-card"
import {
  ChartPlaceholder,
  ChartSkeleton,
  TableSkeleton,
} from "../charts/shared/chart-skeleton"
import { ChartPicker } from "./chart-picker"
import type { ReportDefinition, Visualization } from "../types"
import { ComparePicker, PeriodPicker } from "./period-picker"
import { ReportNameDrawer } from "./report-name-drawer"
import { ReportTable } from "./report-table"
import { RowLimitPicker } from "./row-limit-picker"
import { SortableChips } from "./sortable-chips"
import { rebuildNotice } from "../rebuild-notice"

const REPORT_CHART_HEIGHT = 300

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "The report could not be run."

const Chip = ({
  label,
  onRemove,
}: {
  label: string
  onRemove?: () => void
}) => (
  <div className="bg-ui-bg-component-hover dark:bg-ui-bg-subtle flex items-center justify-between gap-x-2 rounded-md py-1 pl-2 pr-1">
    <Text size="small">{label}</Text>
    {onRemove ? (
      <IconButton
        size="xsmall"
        variant="transparent"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        <XMark />
      </IconButton>
    ) : null}
  </div>
)

const AddMenu = ({
  label,
  options,
  onAdd,
}: {
  label: string
  options: Array<{ key: string; label: string }>
  onAdd: (key: string) => void
}) =>
  options.length ? (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button size="small" variant="transparent" className="self-start">
          <PlusMini />
          {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="max-h-72 overflow-y-auto">
        {options.map((option) => (
          <DropdownMenu.Item key={option.key} onClick={() => onAdd(option.key)}>
            {option.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  ) : null

const isMetricKey = (value: string): value is MetricKey => value in METRICS
const isDimensionKey = (value: string): value is DimensionKey =>
  value in DIMENSIONS

export const ReportEditor = ({ report }: { report: ReportDefinition }) => {
  const prompt = usePrompt()
  const navigate = useNavigate()
  const isMine = report.createdBy === "You"

  const [name, setName] = useState(report.name)
  const [editing, setEditing] = useState(false)
  const saveLabel = isMine ? "Save" : "Save as my report"
  const [draft, setDraft] = useState(report.query)
  const [applied, setApplied] = useState(report.query)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [visualization, setVisualization] = useState<Visualization>(
    report.visualization
  )
  const [metric, setMetric] = useState<string | undefined>(undefined)

  const parsed = parseQuery(applied)
  const query = parsed.ok ? parsed.query : null
  const { data, error, isFetching } = useReport(parsed.ok ? applied : null)
  const chart = chartFor(visualization)

  const run = () => {
    const next = parseQuery(draft)
    if (!next.ok) {
      setDraftError(next.error)
      return
    }
    const text = formatQuery(next.query)
    setDraftError(null)
    setDraft(text)
    setApplied(text)
  }

  const update = (change: Partial<ReportQuery>) => {
    if (!query) {
      return
    }
    const next: ReportQuery = { ...query, ...change }
    if (
      next.orderBy &&
      !next.metrics.some((entry) => entry === next.orderBy?.field) &&
      !next.dimensions.some((entry) => entry === next.orderBy?.field)
    ) {
      next.orderBy = null
    }
    const problem = validateQuery(next)
    if (problem) {
      toast.error("That does not work", { description: problem })
      return
    }
    const text = formatQuery(next)
    setDraftError(null)
    setDraft(text)
    setApplied(text)
  }

  const [saving, setSaving] = useState(false)

  const save = async (newName?: string): Promise<boolean> => {
    const finalName = (newName ?? name).trim() || "Untitled report"
    setSaving(true)
    try {
      const saved = await saveCustomReport({
        id: isMine ? report.id : undefined,
        name: finalName,
        description: isMine ? report.description : "",
        kind: "query",
        query: applied,
        visualization,
        chart: null,
      })
      setName(finalName)
      if (isMine) {
        toast.success("Report saved")
      } else {
        toast.success("Saved as your own report")
        navigate(reportHref(saved.id))
      }
      return true
    } catch (error) {
      toast.error("The report was not saved", {
        description: errorText(error),
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const confirmed = await prompt({
      title: "Delete this report?",
      description: `"${report.name}" will be deleted. This can't be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    })
    if (!confirmed) {
      return
    }
    try {
      await deleteCustomReport(report.id)
      toast.success("Report deleted")
      navigate(REPORTS_HREF)
    } catch (error) {
      toast.error("The report was not deleted", {
        description: errorText(error),
      })
    }
  }

  const pin = () =>
    addReportToDashboard(
      {
        name: name.trim() || "Untitled report",
        kind: "query",
        query: applied,
        visualization,
        chart: null,
      },
      { openDashboard: () => navigate(DASHBOARD_HREF) }
    )

  const perLine = query?.dimensions.some((entry) => DIMENSIONS[entry].perLine)
  const metricOptions = Object.entries(METRICS)
    .filter(
      ([key, value]) =>
        !query?.metrics.some((entry) => entry === key) &&
        (!perLine || value.perLine)
    )
    .map(([key, value]) => ({ key, label: value.label }))
  const dimensionOptions = Object.entries(DIMENSIONS)
    .filter(([key]) => !query?.dimensions.some((entry) => entry === key))
    .map(([key, value]) => ({ key, label: value.label }))

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Heading className="truncate">{name}</Heading>
          {query ? (
            <>
              <PeriodPicker
                value={{ since: query.since, until: query.until }}
                onChange={(period) => update(period)}
              />
              <ComparePicker
                value={query.compare}
                onChange={(compare) => update({ compare })}
              />
            </>
          ) : null}
          {data ? (
            <Text size="small" className="text-ui-fg-muted max-w-xl">
              {formatRange(data.range.since, data.range.until)}, times in{" "}
              {data.range.timezone}
              {data.rebuilding ? `. ${rebuildNotice(data) ?? ""}` : null}
              {data.truncated
                ? `. Showing the top ${data.rows.length.toLocaleString()} rows only: add a LIMIT or a narrower GROUP BY.`
                : null}
              {data.unconverted_orders
                ? `. ${data.unconverted_orders.toLocaleString()} ${data.unconverted_orders === 1 ? "order" : "orders"} in other currencies not converted yet (no exchange rate for their day), left out.`
                : null}
            </Text>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-x-2">
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <IconButton
                size="small"
                variant="transparent"
                aria-label="Report actions"
              >
                <EllipsisHorizontal />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item
                className="gap-x-2"
                onClick={() => setEditing(true)}
              >
                <PencilSquare className="text-ui-fg-subtle" />
                Edit name
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="gap-x-2"
                disabled={!parsed.ok}
                onClick={pin}
              >
                <SquaresPlus className="text-ui-fg-subtle" />
                Add to dashboard
              </DropdownMenu.Item>
              {isMine ? (
                <>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    className="gap-x-2"
                    onClick={() => void remove()}
                  >
                    <Trash className="text-ui-fg-subtle" />
                    Delete
                  </DropdownMenu.Item>
                </>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu>
          <Button
            size="small"
            onClick={() => void save()}
            disabled={!parsed.ok}
            isLoading={saving}
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      <ReportNameDrawer
        open={editing}
        onOpenChange={setEditing}
        name={name}
        saveLabel={saveLabel}
        saving={saving}
        onSave={save}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-y-3">
          <Container
            className="flex flex-col gap-y-2 p-4"
            data-tour-anchor="reports.query"
          >
            <Textarea
              aria-label="Report query"
              value={draft}
              spellCheck={false}
              rows={Math.min(Math.max(draft.split("\n").length, 3), 10)}
              className="font-mono"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  run()
                }
              }}
            />
            <div className="flex items-center justify-between gap-x-3">
              <Text
                size="small"
                className={
                  draftError || error ? "text-ui-fg-error" : "text-ui-fg-muted"
                }
              >
                {draftError ??
                  (error
                    ? errorText(error)
                    : draft === applied
                      ? "Edit the query, or use the controls on the right."
                      : "Edited. Run it to update the chart.")}
              </Text>
              <Button
                size="small"
                variant="secondary"
                onClick={run}
                isLoading={isFetching}
                disabled={draft === applied && !draftError}
              >
                Run
              </Button>
            </div>
          </Container>

          {chart.isTable || (error && !data) ? null : (
            <ChartCard className="px-6 py-6" data-tour-anchor="reports.chart">
              {!data ? (
                <ChartSkeleton
                  chartId={visualization}
                  height={REPORT_CHART_HEIGHT}
                />
              ) : data.filling ? (
                <ChartPlaceholder height={REPORT_CHART_HEIGHT}>
                  The chart appears once analytics is filled.
                </ChartPlaceholder>
              ) : (
                <ChartView
                  result={data}
                  chartId={visualization}
                  metric={metric}
                  height={REPORT_CHART_HEIGHT}
                />
              )}
            </ChartCard>
          )}

          <Container className="divide-y p-0 overflow-hidden">
            {data?.filling ? (
              <StateMessage>{rebuildNotice(data)}</StateMessage>
            ) : data ? (
              <ReportTable
                result={data}
                metric={metric ?? data.query.metrics[0]}
                onMetricChange={setMetric}
              />
            ) : error ? (
              <StateMessage>Fix the query to see the report.</StateMessage>
            ) : (
              <TableSkeleton rows={8} />
            )}
          </Container>
        </div>

        <Container className="p-0 xl:w-72 xl:shrink-0">
          <TitledSection title="Metrics">
            {query ? (
              <SortableChips
                noun="metric"
                items={query.metrics.map((entry) => ({
                  key: entry,
                  label: METRICS[entry].label,
                  onRemove:
                    query.metrics.length > 1
                      ? () =>
                          update({
                            metrics: query.metrics.filter(
                              (key) => key !== entry
                            ),
                          })
                      : undefined,
                }))}
                onReorder={(metrics) => update({ metrics })}
              />
            ) : null}
            <AddMenu
              label="Add metric"
              options={metricOptions}
              onAdd={(key) => {
                if (query && isMetricKey(key)) {
                  update({ metrics: [...query.metrics, key] })
                }
              }}
            />
          </TitledSection>
          <Divider variant="dashed" />
          <TitledSection title="Group by">
            {query?.dimensions.length ? null : (
              <Text size="small" className="text-ui-fg-muted">
                Nothing: one total for the period.
              </Text>
            )}
            {query?.dimensions.map((entry) => (
              <Chip
                key={entry}
                label={DIMENSIONS[entry].label}
                onRemove={() =>
                  update({
                    dimensions: query.dimensions.filter((key) => key !== entry),
                  })
                }
              />
            ))}
            {query && query.dimensions.length < MAX_DIMENSIONS ? (
              <AddMenu
                label="Add dimension"
                options={dimensionOptions}
                onAdd={(key) => {
                  if (isDimensionKey(key)) {
                    update({ dimensions: [...query.dimensions, key] })
                  }
                }}
              />
            ) : null}
          </TitledSection>
          <Divider variant="dashed" />
          <TitledSection title="Visualization">
            <ChartPicker
              value={visualization}
              onChange={setVisualization}
              result={data}
            />
          </TitledSection>
          <Divider variant="dashed" />
          <TitledSection title="Rows">
            <RowLimitPicker
              value={query?.limit ?? null}
              onChange={(limit) => update({ limit })}
            />
          </TitledSection>
        </Container>
      </div>
    </div>
  )
}
