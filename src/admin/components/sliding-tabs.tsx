import { Tabs } from "@medusajs/ui"
import { useCallback, useLayoutEffect, useRef, useState } from "react"

type Option = { value: string; label: string }

type Props = {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
}

type Box = { left: number; width: number }

const measure = (element: HTMLElement): Box => ({
  left: element.offsetLeft,
  width: element.offsetWidth,
})

export const SlidingTabs = ({ value, onValueChange, options }: Props) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Box | null>(null)
  const [hovered, setHovered] = useState<Box | null>(null)

  const measureSelected = useCallback(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]'
    )
    setSelected(active ? measure(active) : null)
  }, [])

  useLayoutEffect(() => {
    measureSelected()
    const list = listRef.current
    if (!list || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(measureSelected)
    observer.observe(list)
    return () => observer.disconnect()
  }, [value, measureSelected])

  const highlight = hovered ?? selected

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <Tabs.List
        ref={listRef}
        className="bg-ui-bg-subtle relative rounded-lg p-1"
        onMouseLeave={() => setHovered(null)}
      >
        {highlight ? (
          <div
            aria-hidden
            className="bg-ui-bg-base shadow-elevation-card-rest pointer-events-none absolute inset-y-1 rounded-md transition-all duration-200 ease-out"
            style={{ left: highlight.left, width: highlight.width }}
          />
        ) : null}
        {options.map((option) => (
          <Tabs.Trigger
            key={option.value}
            value={option.value}
            className="relative rounded-md data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            onMouseEnter={(event) => setHovered(measure(event.currentTarget))}
            onFocus={(event) => setHovered(measure(event.currentTarget))}
            onBlur={() => setHovered(null)}
          >
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  )
}
