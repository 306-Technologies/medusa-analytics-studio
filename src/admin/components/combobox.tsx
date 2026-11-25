import { CheckMini, TrianglesMini } from "@medusajs/icons"
import { Input, Popover, Text, clx } from "@medusajs/ui"
import type { KeyboardEvent } from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"

export type ComboboxOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

type Props = {
  value: string | null
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  size?: "base" | "small"
  id?: string
  className?: string
  "aria-label"?: string
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[_/\-,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const matches = (option: ComboboxOption, query: string): boolean => {
  const haystack = normalize(
    `${option.label} ${option.value} ${option.description ?? ""}`
  )
  return normalize(query)
    .split(" ")
    .every((word) => haystack.includes(word))
}

export const Combobox = ({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search",
  emptyText = "No results",
  disabled,
  size = "base",
  id,
  className,
  "aria-label": ariaLabel,
}: Props) => {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find((option) => option.value === value) ?? null

  const filtered = useMemo(
    () => (query.trim() ? options.filter((o) => matches(o, query)) : options),
    [options, query]
  )

  useEffect(() => {
    if (!open) {
      return
    }
    setQuery("")
    const index = options.findIndex((option) => option.value === value)
    setActiveIndex(Math.max(index, 0))
  }, [open, options, value])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open, filtered])

  const choose = (option: ComboboxOption | undefined) => {
    if (!option || option.disabled) {
      return
    }
    onValueChange(option.value)
    setOpen(false)
  }

  const onSearchChange = (next: string) => {
    setQuery(next)
    setActiveIndex(0)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = filtered.length - 1
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, last))
        break
      case "ArrowUp":
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case "Home":
        event.preventDefault()
        setActiveIndex(0)
        break
      case "End":
        event.preventDefault()
        setActiveIndex(Math.max(last, 0))
        break
      case "Enter":
        event.preventDefault()
        choose(filtered[activeIndex])
        break
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`

  return (
    // modal keeps the list scrollable inside a Drawer or FocusModal.
    <Popover open={open} onOpenChange={setOpen} modal>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          className={clx(
            "bg-ui-bg-field shadow-buttons-neutral transition-fg txt-compact-small flex w-full select-none items-center justify-between gap-x-2 rounded-md px-2 outline-none",
            "hover:bg-ui-bg-field-hover",
            "focus-visible:shadow-borders-interactive-with-active data-[state=open]:!shadow-borders-interactive-with-active",
            "disabled:!bg-ui-bg-disabled disabled:!text-ui-fg-disabled disabled:cursor-not-allowed",
            size === "base" ? "h-8 py-1.5" : "h-7 py-1",
            selected ? "text-ui-fg-base" : "text-ui-fg-muted",
            className
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <TrianglesMini className="text-ui-fg-muted shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Content
        className="flex w-[var(--radix-popover-trigger-width)] flex-col gap-y-1 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchRef.current?.focus()
        }}
      >
        <div className="border-ui-border-base border-b p-4">
          <Input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-controls={listId}
            aria-activedescendant={
              filtered.length ? optionId(activeIndex) : undefined
            }
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="max-h-[300px] overflow-y-auto p-1"
        >
          {filtered.length === 0 ? (
            <Text
              size="small"
              className="text-ui-fg-muted px-2 py-1.5 text-center"
            >
              {emptyText}
            </Text>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value
              return (
                <div
                  key={option.value}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={clx(
                    "txt-compact-small grid cursor-pointer grid-cols-[15px_1fr] items-center gap-x-2 rounded-[4px] px-2 py-1.5",
                    index === activeIndex && "bg-ui-bg-component-hover",
                    isSelected && "txt-compact-small-plus",
                    option.disabled && "text-ui-fg-disabled cursor-not-allowed"
                  )}
                >
                  <span className="flex items-center">
                    {isSelected && <CheckMini />}
                  </span>
                  <span className="flex min-w-0 items-center gap-x-2">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-ui-fg-muted truncate">
                        {option.description}
                      </span>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </Popover.Content>
    </Popover>
  )
}
