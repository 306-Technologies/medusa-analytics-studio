import { glowColor } from "../theme/tokens"

export const GlowFilter = ({
  id,
  color,
  blur = 6,
  opacity = 0.6,
}: {
  id: string
  color: string
  blur?: number
  opacity?: number
}) => (
  <filter id={id} x="-20%" y="-50%" width="140%" height="200%">
    <feDropShadow
      dx="0"
      dy="0"
      stdDeviation={blur}
      style={{ floodColor: glowColor(color, opacity * 100), floodOpacity: 1 }}
    />
  </filter>
)

export const FadeGradient = ({
  id,
  from,
  to = from,
  opacity,
}: {
  id: string
  from: string
  to?: string
  opacity: number
}) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={from} stopOpacity={opacity} />
    <stop offset="100%" stopColor={to} stopOpacity={0} />
  </linearGradient>
)

export const SideGradient = ({
  id,
  from,
  to,
}: {
  id: string
  from: string
  to: string
}) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stopColor={from} />
    <stop offset="100%" stopColor={to} />
  </linearGradient>
)

export const svgId = (reactId: string, name: string): string =>
  `${name}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`
