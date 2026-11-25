import { Link, useParams, useSearchParams } from "react-router-dom"

import { StateMessage } from "../../../../components/state-message"
import { ReportEditor } from "../../../../features/analytics/components/report-editor"
import { SqlEditor } from "../../../../features/analytics/components/sql-editor"
import { SqlModeRequired } from "../../../../features/analytics/components/sql-mode-required"
import { newReportFromParams } from "../../../../features/analytics/reports"
import {
  NEW_REPORT_ID,
  REPORTS_HREF,
} from "../../../../features/analytics/routes"
import {
  useAllReports,
  useWorkspaceReady,
} from "../../../../features/analytics/storage"

const ReportPage = () => {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const reports = useAllReports()
  const ready = useWorkspaceReady()

  const report =
    id === NEW_REPORT_ID
      ? newReportFromParams(searchParams)
      : reports.find((entry) => entry.id === id)

  if (!report && !ready) {
    return <StateMessage framed>Loading the report...</StateMessage>
  }

  if (!report) {
    return (
      <StateMessage framed title="This report does not exist.">
        It may have been deleted, or it belongs to someone else.{" "}
        <Link to={REPORTS_HREF} className="text-ui-fg-interactive">
          Back to all reports
        </Link>
      </StateMessage>
    )
  }

  const key = `${report.id}:${report.query}`
  return report.kind === "sql" ? (
    <SqlModeRequired>
      <SqlEditor key={key} report={report} />
    </SqlModeRequired>
  ) : (
    <ReportEditor key={key} report={report} />
  )
}

export const handle = {
  breadcrumb: () => "Report",
}

export default ReportPage
