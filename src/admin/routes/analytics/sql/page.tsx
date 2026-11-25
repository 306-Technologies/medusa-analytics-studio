import { useLocation } from "react-router-dom"

import {
  SqlEditor,
  type SqlStart,
} from "../../../features/analytics/components/sql-editor"
import { SqlModeRequired } from "../../../features/analytics/components/sql-mode-required"
import { isChartId } from "../../../features/analytics/charts/registry"
import { isColumnIndex } from "../../../features/analytics/sql"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const startFrom = (state: unknown): SqlStart | undefined => {
  if (!isRecord(state) || typeof state.sql !== "string") {
    return undefined
  }
  const chart = isRecord(state.chart) ? state.chart : null
  return {
    name: typeof state.name === "string" ? state.name : "New SQL report",
    sql: state.sql,
    chart:
      chart &&
      typeof chart.kind === "string" &&
      isChartId(chart.kind) &&
      Array.isArray(chart.values) &&
      chart.values.every(isColumnIndex)
        ? {
            kind: chart.kind,
            label: isColumnIndex(chart.label) ? chart.label : null,
            values: chart.values.filter(isColumnIndex),
          }
        : null,
  }
}

// No route config: SQL mode has no sidebar entry.
const SqlPage = () => {
  const location = useLocation()
  const start = startFrom(location.state)
  return (
    <SqlModeRequired>
      <SqlEditor key={location.key} start={start} />
    </SqlModeRequired>
  )
}

export const handle = {
  breadcrumb: () => "SQL",
}

export default SqlPage
