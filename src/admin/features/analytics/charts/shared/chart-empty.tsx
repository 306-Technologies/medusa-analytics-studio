import type { ReactNode } from "react"

import { CHART } from "../theme/tokens"

export const ChartEmpty = ({ children }: { children: ReactNode }) => (
  <div
    className="flex h-full min-h-24 items-center justify-center text-center text-xs"
    style={{ color: CHART.fgMuted }}
  >
    {children}
  </div>
)
