import { useState, type KeyboardEvent, type PointerEvent } from "react"

import type { WidgetSpan } from "./storage"

/** The dashboard grid's column count (`lg:grid-cols-4` on the page). */
const COLUMNS = 4
const SPANS = [1, 2, 3, 4] as const satisfies readonly WidgetSpan[]

const toSpan = (columns: number): WidgetSpan =>
  SPANS[Math.min(COLUMNS, Math.max(1, Math.round(columns))) - 1]

/** The tile must carry `data-dashboard-tile` and sit directly in the grid. */
export const useSpanResize = (
  span: WidgetSpan,
  onResize: (span: WidgetSpan) => void
) => {
  const [preview, setPreview] = useState<WidgetSpan | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const handle = event.currentTarget
    const tile = handle.closest<HTMLElement>("[data-dashboard-tile]")
    const grid = tile?.parentElement
    if (!tile || !grid || event.button !== 0) {
      return
    }
    // Otherwise the tile's own drag-to-move would start.
    event.preventDefault()
    event.stopPropagation()

    const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0
    const column = (grid.clientWidth - (COLUMNS - 1) * gap) / COLUMNS
    const left = tile.getBoundingClientRect().left
    // A span of n ends at left + n * column + (n - 1) * gap; solve for n.
    const spanAt = (x: number) => toSpan((x - left + gap) / (column + gap))

    let current = span
    const move = (moveEvent: globalThis.PointerEvent) => {
      current = spanAt(moveEvent.clientX)
      setPreview(current)
    }
    const finish = (save: boolean) => () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", done)
      handle.removeEventListener("pointercancel", cancel)
      setPreview(null)
      if (save && current !== span) {
        onResize(current)
      }
    }
    const done = finish(true)
    const cancel = finish(false)

    handle.setPointerCapture(event.pointerId)
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", done)
    handle.addEventListener("pointercancel", cancel)
    setPreview(span)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (step === 0) {
      return
    }
    event.preventDefault()
    const next = toSpan(span + step)
    if (next !== span) {
      onResize(next)
    }
  }

  return {
    span: preview ?? span,
    resizing: preview !== null,
    handleProps: { onPointerDown, onKeyDown },
  }
}
