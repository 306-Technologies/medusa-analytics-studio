import { useState } from "react"

export const useHighlight = (fallback: number) => {
  const [hovered, setHovered] = useState<number | null>(null)
  return {
    active: hovered ?? fallback,
    enter: (index: number) => setHovered(index),
    leave: () => setHovered(null),
  }
}
