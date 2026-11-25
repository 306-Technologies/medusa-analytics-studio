import {
  dropReportingView,
  REPORTING_SCHEMA,
  reportingView,
} from "../reporting-view"

describe("reportingView", () => {
  const sql = reportingView({
    name: "loyalty_points_daily",
    comment: "Points per day",
    sql: "select 1 as day, 2 as points;  \n",
    columns: { day: "The day", points: "Net points" },
  })

  it("creates the schema, the view and its comments, in that order", () => {
    expect(sql.split("\n").filter((line) => !line.startsWith(" "))).toEqual([
      `create schema if not exists ${REPORTING_SCHEMA};`,
      "create or replace view reporting.loyalty_points_daily as",
      "select 1 as day, 2 as points;",
      "comment on view reporting.loyalty_points_daily is 'Points per day';",
      "comment on column reporting.loyalty_points_daily.day is 'The day';",
      "comment on column reporting.loyalty_points_daily.points is 'Net points';",
    ])
  })

  it("drops a trailing semicolon from the select", () => {
    expect(sql).not.toContain("points;;")
  })

  it("quotes comments safely", () => {
    expect(
      reportingView({
        name: "v",
        comment: "It's a '; drop table x; --",
        sql: "select 1",
      })
    ).toContain("is 'It''s a ''; drop table x; --';")
  })

  it.each(["Loyalty", "loyalty-points", "1points", "a.b", "x; drop", ""])(
    "rejects the view name %p",
    (name) => {
      expect(() =>
        reportingView({ name, comment: "c", sql: "select 1" })
      ).toThrow(/must be lowercase/)
    }
  )

  it("rejects a bad column name", () => {
    expect(() =>
      reportingView({
        name: "v",
        comment: "c",
        sql: "select 1",
        columns: { "Bad Name": "x" },
      })
    ).toThrow(/column "Bad Name"/)
  })

  it("rejects an empty select", () => {
    expect(() =>
      reportingView({ name: "v", comment: "c", sql: " ; " })
    ).toThrow(/empty/)
  })
})

describe("dropReportingView", () => {
  it("drops the view if it exists", () => {
    expect(dropReportingView("loyalty_points_daily")).toBe(
      "drop view if exists reporting.loyalty_points_daily;"
    )
  })

  it("rejects a bad name", () => {
    expect(() => dropReportingView("x; drop table order")).toThrow()
  })
})
