import { Button, Drawer, Label, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { Combobox } from "../../../components/combobox"
import { sdk } from "../../../lib/sdk"
import { analyticsKeys } from "../query-keys"
import {
  DEFAULT_REPORTING_TIMEZONE,
  REPORTING_TIMEZONE_KEY,
  isTimezone,
} from "../../../../shared/analytics/timezone"

// The admin's ES2020 TypeScript lib does not declare Intl.supportedValuesOf.
const supportedTimezones = (): string[] | null => {
  const supportedValuesOf: unknown = Reflect.get(Intl, "supportedValuesOf")
  if (typeof supportedValuesOf !== "function") {
    return null
  }
  const values: unknown = supportedValuesOf.call(Intl, "timeZone")
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string")
    : null
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
]

const timezoneOptions = (current: string): string[] => {
  const all = supportedTimezones() ?? FALLBACK_TIMEZONES
  return [...new Set([DEFAULT_REPORTING_TIMEZONE, current, ...all])].sort(
    (a, b) => a.localeCompare(b)
  )
}

type Props = {
  storeId: string
  current: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const ReportingTimezoneDrawer = ({
  storeId,
  current,
  open,
  onOpenChange,
}: Props) => {
  const [selected, setSelected] = useState(current)
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const options = useMemo(
    () =>
      timezoneOptions(current).map((timezone) => ({
        value: timezone,
        label: timezone,
      })),
    [current]
  )

  useEffect(() => {
    if (open) {
      setSelected(current)
    }
  }, [open, current])

  const save = useMutation({
    mutationFn: async (timezone: string) => {
      // The store update replaces the whole metadata object, so merge into the latest.
      const { store: latest } = await sdk.admin.store.retrieve(storeId, {
        fields: "id,metadata",
      })
      return sdk.admin.store.update(storeId, {
        metadata: { ...latest.metadata, [REPORTING_TIMEZONE_KEY]: timezone },
      })
    },
    onSuccess: async (_, timezone) => {
      await queryClient.invalidateQueries({ queryKey: analyticsKeys.all })
      toast.success(`Reports now use ${timezone}`)
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "The timezone was not saved."
      )
    },
  })

  const submit = async () => {
    if (!isTimezone(selected)) {
      toast.error(`${selected} is not a known timezone.`)
      return
    }
    const confirmed = await prompt({
      title: "Change the reporting timezone?",
      description: `Every report, including past periods, will count its days and hours in ${selected} instead of ${current}. Totals for each day will change.`,
      confirmText: "Change timezone",
      cancelText: "Cancel",
    })
    if (confirmed) {
      save.mutate(selected)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit reporting timezone</Drawer.Title>
          <Drawer.Description className="sr-only">
            Choose the timezone analytics counts days and hours in.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-2 overflow-y-auto">
          <Label size="small" weight="plus" htmlFor="reporting-timezone">
            Timezone
          </Label>
          <Combobox
            id="reporting-timezone"
            value={selected}
            onValueChange={setSelected}
            options={options}
            placeholder="Select a timezone"
            searchPlaceholder="Search timezones"
            emptyText="No matching timezone"
            disabled={save.isPending}
          />
          <Text size="small" className="text-ui-fg-subtle">
            Analytics counts days and hours in this timezone for everyone.
            Changing it re-splits every report's days, past ones included.
          </Text>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary" disabled={save.isPending}>
              Cancel
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            disabled={selected === current}
            isLoading={save.isPending}
            onClick={submit}
          >
            Save
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
