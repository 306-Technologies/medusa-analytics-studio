import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { StateMessage } from "../../../components/state-message"
import { useSqlStatus } from "../queries"
import { REPORTS_HREF } from "../routes"

export const SqlModeRequired = ({ children }: { children: ReactNode }) => {
  const status = useSqlStatus()

  if (status.isLoading) {
    return <StateMessage framed>Checking SQL mode...</StateMessage>
  }

  if (!status.data?.enabled) {
    return (
      <StateMessage framed title="SQL mode is off.">
        SQL reports run as a restricted, read-only database user, on a read
        replica unless the server allows the primary.
        {status.data?.reason ? ` Off because: ${status.data.reason}.` : ""}{" "}
        <Link to={REPORTS_HREF} className="text-ui-fg-interactive">
          Back to reports
        </Link>
      </StateMessage>
    )
  }

  return <>{children}</>
}
