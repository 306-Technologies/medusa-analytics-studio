import { ReportTable } from "../../components/report-table"
import type { ChartProps } from "../types"

export const TableChartView = ({ result }: ChartProps) => (
  <ReportTable result={result} compact />
)
