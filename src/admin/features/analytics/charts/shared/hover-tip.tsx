import { type MouseEvent, type ReactNode, useRef, useState } from "react"

import { TooltipCard, type TooltipRow } from "./chart-tooltip"

export type Tip = { label?: ReactNode; rows: TooltipRow[] }

type Shown = Tip & { x: number; y: number; width: number }

const EDGE = 90

export const useHoverTip = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<Shown | null>(null)

  const bind = (
    tip: Tip,
    also?: { enter?: () => void; leave?: () => void }
  ) => ({
    onMouseMove: (event: MouseEvent) => {
      const box = ref.current?.getBoundingClientRect()
      if (box) {
        setShown({
          ...tip,
          x: event.clientX - box.left,
          y: event.clientY - box.top,
          width: box.width,
        })
      }
    },
    onMouseEnter: also?.enter,
    onMouseLeave: () => {
      setShown(null)
      also?.leave?.()
    },
  })

  const layer = shown ? (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: Math.min(
          Math.max(shown.x, EDGE),
          Math.max(shown.width - EDGE, EDGE)
        ),
        top: shown.y,
        transform: "translate(-50%, calc(-100% - 14px))",
      }}
    >
      <TooltipCard label={shown.label} rows={shown.rows} />
    </div>
  ) : null

  return { ref, bind, layer }
}
