import {
  METRICS,
  type MetricKey,
} from "../../../../shared/analytics/query-language"
import { metricSql } from "../metrics"

const keys = Object.keys(METRICS) as MetricKey[]

describe("metric registry", () => {
  it("has line SQL for every metric a report can split by product", () => {
    for (const metric of keys.filter((key) => METRICS[key].perLine)) {
      expect({
        metric,
        rollupLine: Boolean(metricSql(metric).rollupLine),
      }).toEqual({
        metric,
        rollupLine: true,
      })
      expect({
        metric,
        factsLine: Boolean(metricSql(metric).factsLine),
      }).toEqual({
        metric,
        factsLine: true,
      })
    }
  })

  it("has no line SQL for a metric the query language keeps off product splits", () => {
    for (const metric of keys.filter((key) => !METRICS[key].perLine)) {
      expect({
        metric,
        line: metricSql(metric).rollupLine ?? metricSql(metric).factsLine,
      }).toEqual({
        metric,
        line: undefined,
      })
    }
  })

  it("names only the aliases its source has", () => {
    for (const metric of keys) {
      const sql = metricSql(metric)
      expect(sql.facts).not.toMatch(/\br\./)
      if (sql.rollup) {
        expect(sql.rollup).not.toMatch(/\b[fl]\./)
      }
    }
  })
})
