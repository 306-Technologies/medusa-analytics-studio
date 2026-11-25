import { clx } from "@medusajs/ui"
import type { ComponentPropsWithoutRef } from "react"

import "../theme/chart-theme.css"

type Props = ComponentPropsWithoutRef<"div">

export const ChartCard = ({ className, ...props }: Props) => (
  <div {...props} className={clx("analytics-card", className)} />
)
