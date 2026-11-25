import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaError, MedusaService } from "@medusajs/framework/utils"

import AnalyticsDashboard from "./models/analytics-dashboard"
import AnalyticsReport from "./models/analytics-report"

export type AnalyticsReportRecord = InferTypeOf<typeof AnalyticsReport>
export type AnalyticsDashboardRecord = InferTypeOf<typeof AnalyticsDashboard>

export type AnalyticsWorkspaceOptions = {
  /** The host refuses writes, so the admin keeps reports in the browser. */
  readOnly?: boolean
}

export const resolveWorkspaceReadOnly = (
  options: AnalyticsWorkspaceOptions | null | undefined
): boolean => {
  const readOnly = options?.readOnly ?? false
  if (typeof readOnly !== "boolean") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "analyticsWorkspace: readOnly must be true or false"
    )
  }
  return readOnly
}

class AnalyticsWorkspaceService extends MedusaService({
  AnalyticsReport,
  AnalyticsDashboard,
}) {
  protected readonly readOnly_: boolean

  constructor(container: object, options?: AnalyticsWorkspaceOptions) {
    super(container)
    this.readOnly_ = resolveWorkspaceReadOnly(options)
  }

  async isReadOnly(): Promise<boolean> {
    return this.readOnly_
  }

  async findUserReport(
    userId: string,
    id: string
  ): Promise<AnalyticsReportRecord | null> {
    const [report] = await this.listAnalyticsReports(
      { id, user_id: userId },
      { take: 1 }
    )
    return report ?? null
  }

  async findUserDashboard(
    userId: string
  ): Promise<AnalyticsDashboardRecord | null> {
    const [dashboard] = await this.listAnalyticsDashboards(
      { user_id: userId },
      { take: 1 }
    )
    return dashboard ?? null
  }
}

export default AnalyticsWorkspaceService
