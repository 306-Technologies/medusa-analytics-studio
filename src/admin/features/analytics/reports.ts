import { isChartId } from "./charts/registry"
import { NEW_REPORT_ID, reportHref } from "./routes"
import type { ReportCategory, ReportDefinition } from "./types"

type BuiltIn = Omit<ReportDefinition, "createdBy" | "kind" | "chart">

const BUILT_IN: BuiltIn[] = [
  {
    id: "sales-over-time",
    name: "Sales over time",
    category: "Sales",
    description: "Total sales per day, against the period before.",
    visualization: "area",
    query:
      "FROM sales\nSHOW total_sales, orders, average_order_value\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "sales-breakdown",
    name: "Gross to net sales",
    category: "Sales",
    description:
      "From gross sales down to what was taken: discounts, returns, refunds, shipping and taxes.",
    visualization: "table",
    query:
      "FROM sales\nSHOW orders, gross_sales, discounts, returns, net_sales, shipping, taxes, refunds, total_sales\nGROUP BY month\nSINCE -89d UNTIL today",
  },
  {
    id: "sales-by-product",
    name: "Sales by product",
    category: "Products",
    description: "Which products bring in the most.",
    visualization: "ranked-bars",
    query:
      "FROM sales\nSHOW gross_sales, units, orders\nGROUP BY product\nSINCE -29d UNTIL today\nORDER BY gross_sales DESC\nLIMIT 10",
  },
  {
    id: "sales-by-variant",
    name: "Sales by product variant",
    category: "Products",
    description: "The same, down to size and colour.",
    visualization: "table",
    query:
      "FROM sales\nSHOW units, gross_sales\nGROUP BY variant\nSINCE -29d UNTIL today\nORDER BY units DESC\nLIMIT 25",
  },
  {
    id: "units-over-time",
    name: "Units sold over time",
    category: "Products",
    description: "How many items leave the shelf each week.",
    visualization: "bar",
    query: "FROM sales\nSHOW units\nGROUP BY week\nSINCE -89d UNTIL today",
  },
  {
    id: "sales-by-country",
    name: "Sales by country",
    category: "Sales",
    description: "Where the money comes from.",
    visualization: "donut",
    query:
      "FROM sales\nSHOW total_sales, orders, customers\nGROUP BY country\nSINCE -89d UNTIL today\nORDER BY total_sales DESC",
  },
  {
    id: "sales-by-city",
    name: "Sales by city",
    category: "Sales",
    description: "The cities that bring in the most, with their orders.",
    visualization: "ranked-list",
    query:
      "FROM sales\nSHOW total_sales, orders\nGROUP BY city\nSINCE -89d UNTIL today\nORDER BY total_sales DESC\nLIMIT 10",
  },
  {
    id: "sales-by-channel",
    name: "Sales by sales channel",
    category: "Sales",
    description: "Webshop, marketplace, point of sale: who sells what.",
    visualization: "share-bar",
    query:
      "FROM sales\nSHOW total_sales, orders\nGROUP BY sales_channel\nSINCE -89d UNTIL today",
  },
  {
    id: "orders-over-time",
    name: "Orders over time",
    category: "Orders",
    description: "Orders per day, against the period before.",
    visualization: "bar",
    query:
      "FROM sales\nSHOW orders, units\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "average-order-value",
    name: "Average order value over time",
    category: "Orders",
    description: "Whether baskets are getting bigger.",
    visualization: "line",
    query:
      "FROM sales\nSHOW average_order_value, orders\nGROUP BY week\nSINCE -89d UNTIL today",
  },
  {
    id: "orders-by-weekday",
    name: "Orders by day of week",
    category: "Orders",
    description: "Which days are busy.",
    visualization: "bar",
    query:
      "FROM sales\nSHOW orders, total_sales\nGROUP BY day_of_week\nSINCE -89d UNTIL today",
  },
  {
    id: "orders-by-hour",
    name: "Orders by hour of day",
    category: "Orders",
    description: "When to staff support and when to send the newsletter.",
    visualization: "bar",
    query:
      "FROM sales\nSHOW orders\nGROUP BY hour_of_day\nSINCE -89d UNTIL today",
  },
  {
    id: "new-vs-returning",
    name: "New vs returning customers",
    category: "Customers",
    description: "How much of sales comes from people who have bought before.",
    visualization: "waffle",
    query:
      "FROM sales\nSHOW total_sales, orders, customers\nGROUP BY customer_type\nSINCE -89d UNTIL today",
  },
  {
    id: "customers-over-time",
    name: "Customers over time",
    category: "Customers",
    description: "New and returning customers per week.",
    visualization: "line",
    query:
      "FROM sales\nSHOW customers, new_customers, returning_customers\nGROUP BY week\nSINCE -89d UNTIL today",
  },
  {
    id: "total-sales",
    name: "Total sales",
    category: "Sales",
    description: "One number: what the store took.",
    visualization: "stat",
    query:
      "FROM sales\nSHOW total_sales\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "total-orders",
    name: "Orders",
    category: "Orders",
    description: "One number: orders placed.",
    visualization: "stat",
    query:
      "FROM sales\nSHOW orders\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "aov",
    name: "Average order value",
    category: "Orders",
    description: "One number: total sales divided by orders.",
    visualization: "stat",
    query:
      "FROM sales\nSHOW average_order_value\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "customer-count",
    name: "Customers",
    category: "Customers",
    description: "One number: different customers who ordered.",
    visualization: "stat",
    query:
      "FROM sales\nSHOW customers\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "net-sales",
    name: "Net sales",
    category: "Sales",
    description: "One big number: what the store kept, and how it moved.",
    visualization: "hero",
    query:
      "FROM sales\nSHOW net_sales\nGROUP BY day\nSINCE -29d UNTIL today\nCOMPARE TO previous_period",
  },
  {
    id: "gross-to-net",
    name: "Gross to total sales, step by step",
    category: "Sales",
    description:
      "From gross sales, take away discounts and returns, add shipping and taxes.",
    visualization: "waterfall",
    query:
      "FROM sales\nSHOW gross_sales, discounts, returns, shipping, taxes, total_sales\nSINCE -29d UNTIL today",
  },
  {
    id: "sales-by-channel-over-time",
    name: "Sales by channel over time",
    category: "Sales",
    description: "Each sales channel stacked, week by week.",
    visualization: "stacked-area",
    query:
      "FROM sales\nSHOW total_sales\nGROUP BY week, sales_channel\nSINCE -89d UNTIL today",
  },
  {
    id: "change-by-country",
    name: "Change by country",
    category: "Sales",
    description:
      "Which countries grew against the period before, and which slipped.",
    visualization: "change-bars",
    query:
      "FROM sales\nSHOW total_sales\nGROUP BY country\nSINCE -29d UNTIL today\nCOMPARE TO previous_period\nORDER BY total_sales DESC\nLIMIT 6",
  },
  {
    id: "product-share",
    name: "Share of sales by product",
    category: "Products",
    description: "Area is share of sales: the biggest products at a glance.",
    visualization: "treemap",
    query:
      "FROM sales\nSHOW gross_sales\nGROUP BY product\nSINCE -29d UNTIL today\nORDER BY gross_sales DESC",
  },
  {
    id: "product-rank",
    name: "Product rank, then and now",
    category: "Products",
    description:
      "The top products, and their earlier rank among products that sold in both periods.",
    visualization: "slope",
    query:
      "FROM sales\nSHOW gross_sales\nGROUP BY product\nSINCE -29d UNTIL today\nCOMPARE TO previous_period\nORDER BY gross_sales DESC",
  },
  {
    id: "aov-by-country",
    name: "Average order value by country",
    category: "Orders",
    description: "Where baskets are biggest.",
    visualization: "lollipop",
    query:
      "FROM sales\nSHOW average_order_value\nGROUP BY country\nSINCE -89d UNTIL today\nORDER BY average_order_value DESC\nLIMIT 7",
  },
  {
    id: "when-people-buy",
    name: "When people buy",
    category: "Orders",
    description: "Orders by weekday and hour: the busy hours light up.",
    visualization: "heatmap",
    query:
      "FROM sales\nSHOW orders\nGROUP BY day_of_week, hour_of_day\nSINCE -89d UNTIL today",
  },
  {
    id: "daily-orders",
    name: "Daily orders",
    category: "Orders",
    description: "The last 26 weeks, one square per day.",
    visualization: "calendar",
    query: "FROM sales\nSHOW orders\nGROUP BY day\nSINCE -181d UNTIL today",
  },
  {
    id: "new-vs-returning-weekly",
    name: "New and returning customers per week",
    category: "Customers",
    description: "Orders per week, split by new and returning customers.",
    visualization: "bar",
    query:
      "FROM sales\nSHOW orders\nGROUP BY week, customer_type\nSINCE -55d UNTIL today",
  },
]

export const BUILT_IN_REPORTS: ReportDefinition[] = BUILT_IN.map((report) => ({
  ...report,
  kind: "query",
  chart: null,
  createdBy: "306",
}))

export const NEW_REPORT_QUERY =
  "FROM sales\nSHOW total_sales, orders\nGROUP BY day\nSINCE -29d UNTIL today"

export const filterReports = (
  reports: ReportDefinition[],
  { search, category }: { search: string; category?: ReportCategory | "All" }
): ReportDefinition[] => {
  const needle = search.trim().toLowerCase()
  return reports.filter(
    (report) =>
      (!category || category === "All" || report.category === category) &&
      (!needle ||
        report.name.toLowerCase().includes(needle) ||
        report.description.toLowerCase().includes(needle))
  )
}

const PARAMS = { query: "q", visualization: "viz", name: "name" } as const

type ReportDraft = Pick<ReportDefinition, "name" | "query" | "visualization">

export const newReportHref = (draft?: ReportDraft): string => {
  const path = reportHref(NEW_REPORT_ID)
  if (!draft) {
    return path
  }
  const params = new URLSearchParams({
    [PARAMS.query]: draft.query,
    [PARAMS.visualization]: draft.visualization,
    [PARAMS.name]: draft.name,
  })
  return `${path}?${params.toString()}`
}

export const newReportFromParams = (
  params: URLSearchParams
): ReportDefinition => {
  const visualization = params.get(PARAMS.visualization) ?? ""
  return {
    id: NEW_REPORT_ID,
    name: params.get(PARAMS.name) ?? "New exploration",
    category: "Custom",
    description: "",
    kind: "query",
    query: params.get(PARAMS.query) ?? NEW_REPORT_QUERY,
    visualization: isChartId(visualization) ? visualization : "line",
    chart: null,
    createdBy: "306",
  }
}
