import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CommandLine, Plus, SquaresPlus } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Text,
  Tooltip,
} from "@medusajs/ui"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { SearchInput } from "../../../components/search-input"
import { SlidingTabs } from "../../../components/sliding-tabs"
import { StateMessage } from "../../../components/state-message"
import { ReportSummary } from "../../../features/analytics/components/report-summary"
import { useSqlStatus } from "../../../features/analytics/queries"
import {
  filterReports,
  newReportHref,
} from "../../../features/analytics/reports"
import { reportHref, SQL_HREF } from "../../../features/analytics/routes"
import { chartFor } from "../../../features/analytics/charts/registry"
import {
  addReportToDashboard,
  useAllReports,
} from "../../../features/analytics/storage"
import {
  isReportCategory,
  REPORT_CATEGORIES,
  type ReportCategory,
} from "../../../features/analytics/types"

const CATEGORY_TABS = ["All", ...REPORT_CATEGORIES].map((entry) => ({
  value: entry,
  label: entry,
}))

const ReportsPage = () => {
  const navigate = useNavigate()
  const reports = useAllReports()
  const sqlEnabled = useSqlStatus().data?.enabled === true

  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<ReportCategory | "All">("All")

  const visible = filterReports(reports, { search, category })

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading>Reports</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Every report is a query you can open, change and save as your own.
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          {sqlEnabled ? (
            <Button size="small" variant="secondary" asChild>
              <Link to={SQL_HREF}>
                <CommandLine />
                SQL
              </Link>
            </Button>
          ) : null}
          <Button size="small" asChild>
            <Link to={newReportHref()}>
              <Plus />
              New exploration
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <SlidingTabs
          value={category}
          onValueChange={(value) =>
            setCategory(isReportCategory(value) ? value : "All")
          }
          options={CATEGORY_TABS}
        />
        <SearchInput
          label="Search reports"
          value={search}
          onChange={setSearch}
          className="w-64"
        />
      </div>

      {visible.length === 0 ? (
        <StateMessage>
          {category === "Custom" && !search.trim()
            ? "No reports of your own yet. Open any report, change it and save it."
            : "No reports match."}
        </StateMessage>
      ) : (
        <ul data-tour-anchor="reports.list">
          {visible.map((report) => (
            <li
              key={report.id}
              className="border-ui-border-base hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-x-4 border-b px-6 py-3 last:border-b-0"
              onClick={() => navigate(reportHref(report.id))}
            >
              <ReportSummary
                report={report}
                title={
                  <Link
                    to={reportHref(report.id)}
                    className="txt-compact-small-plus text-ui-fg-base"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {report.name}
                  </Link>
                }
              />
              <Text
                size="small"
                className="text-ui-fg-muted hidden w-28 md:block"
              >
                {chartFor(report.visualization).label}
              </Text>
              <div className="w-24">
                <Badge size="2xsmall">{report.category}</Badge>
              </div>
              <Tooltip content="Add to dashboard">
                <IconButton
                  size="small"
                  variant="transparent"
                  aria-label={`Add ${report.name} to the dashboard`}
                  onClick={(event) => {
                    event.stopPropagation()
                    addReportToDashboard(report)
                  }}
                >
                  <SquaresPlus />
                </IconButton>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Reports",
})

export const handle = {
  breadcrumb: () => "Reports",
}

export default ReportsPage
