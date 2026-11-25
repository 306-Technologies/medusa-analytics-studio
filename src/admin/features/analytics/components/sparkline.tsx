import { useId } from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { GlowFilter, svgId } from "../charts/shared/svg-defs"
import { SERIES_COLORS } from "../colors"
import "../charts/theme/chart-theme.css"

type Props = {
  values: number[]
  height: number
  width?: number
  fill?: "flat" | "fade"
  color?: string
  glow?: boolean
}

type EndDotProps = { cx?: number; cy?: number; index?: number }

export const Sparkline = ({
  values,
  height,
  width,
  fill = "flat",
  color = SERIES_COLORS[0],
  glow = false,
}: Props) => {
  const reactId = useId()
  const gradientId = svgId(reactId, "spark")
  const glowId = svgId(reactId, "spark-glow")
  const last = values.length - 1

  return (
    <div style={{ height, width }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={values.map((value) => ({ value }))}
          margin={{
            top: glow ? 6 : 2,
            right: glow ? 4 : 0,
            bottom: 0,
            left: 0,
          }}
        >
          <defs>
            {fill === "fade" ? (
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ) : null}
            {glow ? (
              <GlowFilter id={glowId} color={color} blur={5} opacity={0.55} />
            ) : null}
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={glow ? 2 : 1.5}
            fill={fill === "fade" ? `url(#${gradientId})` : color}
            fillOpacity={fill === "fade" ? 1 : 0.12}
            filter={glow ? `url(#${glowId})` : undefined}
            dot={
              glow
                ? ({ cx, cy, index }: EndDotProps) =>
                    index === last && cx !== undefined && cy !== undefined ? (
                      <circle key="end" cx={cx} cy={cy} r={3.5} fill={color} />
                    ) : (
                      <g key={index} />
                    )
                : false
            }
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
