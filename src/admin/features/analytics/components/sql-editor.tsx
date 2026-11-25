import {
  EllipsisHorizontal,
  PencilSquare,
  SquaresPlus,
  Trash,
} from "@medusajs/icons"
import {
  Button,
  Container,
  Divider,
  DropdownMenu,
  Heading,
  IconButton,
  Select,
  Text,
  Textarea,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { StateMessage } from "../../../components/state-message"
import { ChartView } from "../charts/chart-view"
import { chartFor } from "../charts/registry"
import { ChartCard } from "../charts/shared/chart-card"
import { ChartSkeleton, TableSkeleton } from "../charts/shared/chart-skeleton"
import { sqlReportResult } from "../sql-report"
import { TitledSection } from "../../../components/titled-section"
import { useSqlResult, useSqlStatus, useSqlViews } from "../queries"
import { DASHBOARD_HREF, REPORTS_HREF, reportHref } from "../routes"
import { ReportNameDrawer } from "./report-name-drawer"
import {
  defaultChart,
  fitChart,
  fromSavedChart,
  type SqlChartSettings,
  starterSql,
  toSavedChart,
} from "../sql"
import {
  addReportToDashboard,
  deleteCustomReport,
  saveCustomReport,
} from "../storage"
import type { ReportDefinition } from "../types"
import { ChartPicker } from "./chart-picker"
import { SqlResultTable } from "./sql-result-table"
import { SqlViewsPanel } from "./sql-views-panel"
import { rebuildNotice } from "../rebuild-notice"

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "The query could not be run."

// Select.Item can't hold an empty value.
const ROW_NUMBERS = "rows"

const SQL_CHART_HEIGHT = 300

const EMPTY_HINT = `-- Read-only SQL over the reporting views (listed on the right).
-- One statement, up to 5,000 rows. Run with Ctrl/Cmd + Enter.
select 1 as example`

export type SqlStart = {
  name: string
  sql: string
  chart: SqlChartSettings | null
}

type Props = {
  report?: ReportDefinition
  start?: SqlStart
}

export const SqlEditor = ({ report, start }: Props) => {
  const navigate = useNavigate()
  const isMine = report?.createdBy === "You"
  const opened = report
    ? {
        name: report.name,
        sql: report.query,
        chart: fromSavedChart(report.visualization, report.chart),
      }
    : start

  const views = useSqlViews(true)
  const sqlStatus = useSqlStatus()
  const [name, setName] = useState(opened?.name ?? "New SQL report")
  const [draft, setDraft] = useState<string | null>(opened?.sql ?? null)
  const [applied, setApplied] = useState<string | null>(opened?.sql ?? null)
  const [chart, setChart] = useState<SqlChartSettings | null>(
    opened?.chart ?? null
  )
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const prompt = usePrompt()

  const { data, error, isFetching } = useSqlResult(applied)
  const drawn = useMemo(
    () => (data && chart ? sqlReportResult(data, chart) : undefined),
    [data, chart]
  )

  const firstView = views.data?.views.find((view) => view.enabled)?.name
  const text =
    draft ??
    (firstView ? starterSql(firstView) : views.isLoading ? "" : EMPTY_HINT)

  useEffect(() => {
    if (data) {
      setChart((current) =>
        current ? fitChart(current, data.columns) : defaultChart(data.columns)
      )
    }
  }, [data])

  const run = () => {
    const sql = text.trim()
    if (sql) {
      setDraft(text)
      setApplied(sql)
    }
  }

  const use = (view: string) => {
    const sql = starterSql(view)
    setDraft(sql)
    setApplied(sql)
    setChart(null)
  }

  const savable =
    applied !== null && data !== undefined && chart !== null && !error
  const title = name.trim() || "Untitled SQL report"
  const saveLabel = isMine ? "Save" : "Save as my report"

  const save = async (newName?: string): Promise<boolean> => {
    if (!savable || applied === null || !chart) {
      return false
    }
    const finalName = (newName ?? name).trim() || "Untitled SQL report"
    setSaving(true)
    try {
      const saved = await saveCustomReport({
        id: isMine ? report?.id : undefined,
        name: finalName,
        description: isMine ? (report?.description ?? "") : "",
        kind: "sql",
        query: applied,
        ...toSavedChart(chart),
      })
      setName(finalName)
      if (isMine) {
        toast.success("Report saved")
      } else {
        toast.success("Saved as your own report")
        navigate(reportHref(saved.id))
      }
      return true
    } catch (failure) {
      toast.error("The report was not saved", {
        description: errorText(failure),
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!report) {
      return
    }
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
    } catch (failure) {
      toast.error("The report was not deleted", {
        description: errorText(failure),
      })
    }
  }

  const pin = () => {
    if (savable && applied !== null && chart) {
      addReportToDashboard(
        { name: title, kind: "sql", query: applied, ...toSavedChart(chart) },
        { openDashboard: () => navigate(DASHBOARD_HREF) }
      )
    }
  }

  const numberColumns =
    data?.columns
      .map((column, index) => ({ column, index }))
      .filter(({ column }) => column.kind === "number") ?? []

  const status = error
    ? errorText(error)
    : data && applied !== null && text.trim() === applied
      ? `${data.rows.length.toLocaleString()}${data.truncated ? "+" : ""} rows in ${data.ms}ms.`
      : applied === null
        ? "Write a query and run it."
        : "Edited. Run it to update the result."

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Heading className="truncate">{title}</Heading>
          <Text size="small" className="text-ui-fg-muted">
            SQL over the reporting views, read-only.
            {sqlStatus.data?.facts
              ? ` ${rebuildNotice(sqlStatus.data.facts) ?? ""}`
              : ""}
          </Text>
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
                disabled={!savable}
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
            disabled={!savable}
            isLoading={saving}
          >
            {saveLabel}
          </Button>
        </div>
      </div>

      <ReportNameDrawer
        open={editing}
        onOpenChange={setEditing}
        name={title}
        saveLabel={savable ? saveLabel : "Done"}
        saving={saving}
        onSave={async (next) => {
          if (savable) {
            return save(next)
          }
          setName(next)
          return true
        }}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-y-3">
          <Container className="flex flex-col gap-y-2 p-4">
            <Textarea
              aria-label="SQL"
              value={text}
              spellCheck={false}
              rows={Math.min(Math.max(text.split("\n").length, 4), 16)}
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
                className={error ? "text-ui-fg-error" : "text-ui-fg-muted"}
              >
                {status}
              </Text>
              <Button
                size="small"
                variant="secondary"
                onClick={run}
                isLoading={isFetching}
                disabled={!text.trim()}
              >
                Run
              </Button>
            </div>
          </Container>

          {drawn && chart && !chartFor(chart.kind).isTable ? (
            <ChartCard className="px-6 py-6">
              <ChartView
                result={drawn}
                chartId={chart.kind}
                height={SQL_CHART_HEIGHT}
              />
            </ChartCard>
          ) : isFetching && !error && !data ? (
            <ChartCard className="px-6 py-6">
              <ChartSkeleton
                chartId={chart?.kind ?? "line"}
                height={SQL_CHART_HEIGHT}
              />
            </ChartCard>
          ) : null}

          <Container className="divide-y p-0 overflow-hidden">
            {data && chart ? (
              <SqlResultTable result={data} />
            ) : isFetching && !error ? (
              <TableSkeleton rows={8} />
            ) : (
              <StateMessage>
                {error
                  ? "Fix the query to see the result."
                  : "The result shows here."}
              </StateMessage>
            )}
          </Container>
        </div>

        <div className="flex flex-col gap-y-3 xl:w-80 xl:shrink-0">
          {data && chart ? (
            <Container className="p-0">
              <TitledSection title="Visualization">
                <ChartPicker
                  value={chart.kind}
                  onChange={(kind) => setChart({ ...chart, kind })}
                  result={drawn}
                />
              </TitledSection>
              <Divider variant="dashed" />
              <TitledSection title="Along the bottom">
                <Select
                  size="small"
                  value={
                    chart.label === null ? ROW_NUMBERS : String(chart.label)
                  }
                  onValueChange={(value) =>
                    setChart({
                      ...chart,
                      label: value === ROW_NUMBERS ? null : Number(value),
                    })
                  }
                >
                  <Select.Trigger aria-label="Along the bottom">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ROW_NUMBERS}>Row number</Select.Item>
                    {data.columns.map((column, index) => (
                      <Select.Item key={index} value={String(index)}>
                        {column.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Text size="xsmall" className="text-ui-fg-muted">
                  Rows with the same value here are added up.
                </Text>
              </TitledSection>
              <Divider variant="dashed" />
              <TitledSection title="Value">
                {numberColumns.length === 0 ? (
                  <Text size="small" className="text-ui-fg-muted">
                    The result has no number columns.
                  </Text>
                ) : (
                  <Select
                    size="small"
                    value={
                      chart.values[0] === undefined
                        ? undefined
                        : String(chart.values[0])
                    }
                    onValueChange={(value) =>
                      setChart({ ...chart, values: [Number(value)] })
                    }
                  >
                    <Select.Trigger aria-label="Value">
                      <Select.Value placeholder="Pick a number column" />
                    </Select.Trigger>
                    <Select.Content>
                      {numberColumns.map(({ column, index }) => (
                        <Select.Item key={index} value={String(index)}>
                          {column.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                )}
              </TitledSection>
            </Container>
          ) : null}
          <SqlViewsPanel
            views={views.data?.views}
            loading={views.isLoading}
            onUse={use}
          />
          {views.error ? (
            <Text size="small" className="text-ui-fg-error">
              {errorText(views.error)}
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  )
}
