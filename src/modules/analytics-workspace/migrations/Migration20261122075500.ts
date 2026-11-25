import { Migration } from "@medusajs/framework/mikro-orm/migrations"

import {
  dropReportingView,
  reportingView,
} from "../../../shared/analytics/reporting-view"

/*
 * Reporting view: saved analytics reports per day and chart type, for SQL
 * mode. Counts only: no report names, queries or admin user ids.
 * Hand-written (db:generate never creates views). See "Reporting views" in
 * docs/conventions/backend.md.
 */
export class Migration20261122075500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      reportingView({
        name: "analytics_reports_daily",
        comment: "Saved analytics reports, per day created and chart type",
        sql: `
          select date_trunc('day', created_at)::date as day,
                 visualization,
                 count(*) as reports,
                 count(distinct user_id) as authors
          from analytics_report
          where deleted_at is null
          group by 1, 2`,
        columns: {
          day: "Day the reports were saved (UTC)",
          visualization: "Chart type",
          reports: "Reports saved that day",
          authors: "Admins who saved them",
        },
      })
    )
  }

  override async down(): Promise<void> {
    this.addSql(dropReportingView("analytics_reports_daily"))
  }
}
