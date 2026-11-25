import { CalendarMini } from "@medusajs/icons"
import { Button, DatePicker, DropdownMenu, Popover, Text } from "@medusajs/ui"
import { useState } from "react"

import {
  COMPARISONS,
  type Comparison,
} from "../../../../shared/analytics/query-language"
import {
  PERIOD_PRESETS,
  periodLabel,
  toDateExpression,
  type Period,
} from "../periods"

const DATE = /^\d{4}-\d{2}-\d{2}$/

const toDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export const PeriodPicker = ({
  value,
  onChange,
}: {
  value: Period
  onChange: (period: Period) => void
}) => {
  const [open, setOpen] = useState(false)
  const today = toDateExpression(new Date())
  const [from, setFrom] = useState<Date | null>(
    toDate(DATE.test(value.since) ? value.since : today)
  )
  const [to, setTo] = useState<Date | null>(
    toDate(DATE.test(value.until) ? value.until : today)
  )
  const customValid = from !== null && to !== null && from <= to

  const choose = (period: Period) => {
    onChange(period)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="small" variant="secondary">
          <CalendarMini />
          {periodLabel(value) === "Custom"
            ? `${value.since} to ${value.until}`
            : periodLabel(value)}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="flex w-40 flex-col gap-y-1 p-2">
        {PERIOD_PRESETS.map((preset) => {
          const selected = periodLabel(value) === preset.label
          return (
            <Button
              key={preset.label}
              size="small"
              variant="transparent"
              onClick={() =>
                choose({ since: preset.since, until: preset.until })
              }
              className={`justify-start w-full ${
                selected ? "text-ui-fg-base" : "text-ui-fg-subtle font-normal"
              }`}
            >
              {preset.label}
            </Button>
          )
        })}
        <div className="border-ui-border-base mt-1 flex flex-col gap-y-2 border-t px-2 pb-1 pt-3">
          <Text size="xsmall" weight="plus" className="text-ui-fg-muted">
            Custom range
          </Text>
          <DatePicker
            size="small"
            granularity="day"
            aria-label="From"
            value={from}
            maxValue={to ?? undefined}
            onChange={setFrom}
          />
          <DatePicker
            size="small"
            granularity="day"
            aria-label="To"
            value={to}
            minValue={from ?? undefined}
            onChange={setTo}
          />
          <Button
            size="small"
            variant="secondary"
            className="w-full"
            disabled={!customValid}
            onClick={() => {
              if (from && to) {
                choose({
                  since: toDateExpression(from),
                  until: toDateExpression(to),
                })
              }
            }}
          >
            Apply
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  )
}

const isComparison = (value: string): value is Comparison =>
  value in COMPARISONS

export const ComparePicker = ({
  value,
  onChange,
}: {
  value: Comparison
  onChange: (comparison: Comparison) => void
}) => (
  <DropdownMenu>
    <DropdownMenu.Trigger asChild>
      <Button size="small" variant="secondary">
        {value === "none"
          ? "No comparison"
          : `vs ${COMPARISONS[value].toLowerCase()}`}
      </Button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start">
      <DropdownMenu.RadioGroup
        value={value}
        onValueChange={(next) => {
          if (isComparison(next)) {
            onChange(next)
          }
        }}
      >
        {Object.entries(COMPARISONS).map(([key, label]) => (
          <DropdownMenu.RadioItem key={key} value={key}>
            {label}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu>
)
