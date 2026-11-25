import { Text } from "@medusajs/ui"
import type { ReactNode } from "react"

import type { ReportDefinition } from "../types"

type Props = {
  report: Pick<ReportDefinition, "name" | "description" | "kind">
  title?: ReactNode
  size?: "small" | "xsmall"
}

export const ReportSummary = ({ report, title, size = "small" }: Props) => (
  <span className="flex min-w-0 flex-1 flex-col">
    {title ?? (
      <Text size="small" weight="plus">
        {report.name}
      </Text>
    )}
    <Text size={size} className="text-ui-fg-subtle truncate">
      {report.description ||
        (report.kind === "sql" ? "Your own SQL report" : "Your own report")}
    </Text>
  </span>
)
