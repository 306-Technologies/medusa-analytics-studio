import { Drawer, Text } from "@medusajs/ui"
import { useState } from "react"

import { SearchInput } from "../../../components/search-input"
import { chartFor } from "../charts/registry"
import { filterReports } from "../reports"
import { addReportToDashboard, useAllReports } from "../storage"
import { ReportSummary } from "./report-summary"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const AddWidgetDrawer = ({ open, onOpenChange }: Props) => {
  const reports = useAllReports()
  const [search, setSearch] = useState("")
  const choices = filterReports(reports, { search })

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Add a widget</Drawer.Title>
          <Drawer.Description className="sr-only">
            Pick a report to show on the dashboard.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-3 overflow-y-auto">
          <SearchInput
            label="Search reports"
            value={search}
            onChange={setSearch}
          />
          <ul className="flex flex-col">
            {choices.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  className="hover:bg-ui-bg-base-hover flex w-full items-center justify-between gap-x-3 rounded-md px-2 py-2 text-left"
                  onClick={() => addReportToDashboard(report)}
                >
                  <ReportSummary report={report} size="xsmall" />
                  <Text size="xsmall" className="text-ui-fg-muted shrink-0">
                    {chartFor(report.visualization).label}
                  </Text>
                </button>
              </li>
            ))}
          </ul>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  )
}
