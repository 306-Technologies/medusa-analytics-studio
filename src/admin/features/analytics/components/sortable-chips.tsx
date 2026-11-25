import { DotsSix, XMark } from "@medusajs/icons"
import { IconButton, Text, clx } from "@medusajs/ui"
import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react"

type Item<K extends string> = {
  key: K
  label: string
  onRemove?: () => void
}

type Props<K extends string> = {
  items: Item<K>[]
  onReorder: (keys: K[]) => void
  noun: string
}

const SLIDE = { duration: 320, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }

const currentOffset = (node: HTMLElement) => {
  const transform = getComputedStyle(node).transform
  return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

const useSlide = <K extends string>(order: K[]) => {
  const nodes = useRef(new Map<K, HTMLElement>())
  const last = useRef(new Map<K, number>())

  useLayoutEffect(() => {
    const animate = !reducedMotion()
    for (const key of last.current.keys()) {
      if (!nodes.current.has(key)) {
        last.current.delete(key)
      }
    }
    for (const [key, node] of nodes.current) {
      const offset = currentOffset(node)
      const top = node.getBoundingClientRect().top - offset
      const before = last.current.get(key)
      last.current.set(key, top)
      if (!animate || before === undefined || before === top) {
        continue
      }
      const from = before + offset - top
      for (const running of node.getAnimations()) {
        running.cancel()
      }
      node.animate(
        [
          { transform: `translateY(${from}px)` },
          { transform: "translateY(0)" },
        ],
        SLIDE
      )
    }
  }, [order.join()])

  return (key: K) => (node: HTMLElement | null) => {
    if (node) {
      nodes.current.set(key, node)
    } else {
      nodes.current.delete(key)
    }
  }
}

const move = <K,>(keys: K[], from: number, to: number): K[] => {
  const next = [...keys]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export const SortableChips = <K extends string>({
  items,
  onReorder,
  noun,
}: Props<K>) => {
  const keys = items.map((item) => item.key)
  const [preview, setPreview] = useState<K[] | null>(null)
  const [dragging, setDragging] = useState<K | null>(null)

  const order = preview ?? keys
  const slideRef = useSlide(order)
  const byKey = new Map(items.map((item) => [item.key, item]))

  const end = (save: boolean) => {
    if (save && preview && preview.join() !== keys.join()) {
      onReorder(preview)
    }
    setPreview(null)
    setDragging(null)
  }

  const onDragOver = (event: DragEvent<HTMLElement>, over: K) => {
    if (!dragging) {
      return
    }
    event.preventDefault()
    if (over === dragging) {
      return
    }
    const from = order.indexOf(dragging)
    const to = order.indexOf(over)
    const box = event.currentTarget.getBoundingClientRect()
    const middle = box.top + box.height / 2
    if (
      (to > from && event.clientY < middle) ||
      (to < from && event.clientY > middle)
    ) {
      return
    }
    setPreview(move(order, from, to))
  }

  const onHandleKeyDown = (event: KeyboardEvent<HTMLElement>, key: K) => {
    const step =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0
    const from = keys.indexOf(key)
    const to = from + step
    if (step === 0 || to < 0 || to >= keys.length) {
      return
    }
    event.preventDefault()
    onReorder(move(keys, from, to))
  }

  return (
    <ul className="flex flex-col gap-y-2">
      {order.map((key, index) => {
        const item = byKey.get(key)
        if (!item) {
          return null
        }
        return (
          <li
            key={key}
            ref={slideRef(key)}
            draggable={items.length > 1}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move"
              // Firefox needs data set for the drag to start.
              event.dataTransfer.setData("text/plain", item.label)
              setDragging(key)
              setPreview(keys)
            }}
            onDragOver={(event) => onDragOver(event, key)}
            onDrop={(event) => {
              event.preventDefault()
              end(true)
            }}
            onDragEnd={() => end(false)}
            className={clx(
              "bg-ui-bg-component-hover dark:bg-ui-bg-subtle flex items-center gap-x-1 rounded-md py-1 pl-1 pr-1 transition-opacity duration-200 ease-out motion-reduce:transition-none",
              dragging === key && "opacity-50"
            )}
          >
            {items.length > 1 ? (
              <button
                type="button"
                aria-label={`Move ${item.label}, ${noun} ${index + 1} of ${items.length}. Use the up and down arrows.`}
                onKeyDown={(event) => onHandleKeyDown(event, key)}
                className="text-ui-fg-muted hover:text-ui-fg-subtle focus-visible:shadow-borders-focus flex cursor-grab items-center rounded outline-none active:cursor-grabbing"
              >
                <DotsSix />
              </button>
            ) : (
              <span className="w-1" />
            )}
            <Text size="small" className="flex-1 truncate">
              {item.label}
            </Text>
            {item.onRemove ? (
              <IconButton
                size="xsmall"
                variant="transparent"
                onClick={item.onRemove}
                aria-label={`Remove ${item.label}`}
              >
                <XMark />
              </IconButton>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
