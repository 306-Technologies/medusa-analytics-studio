import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminStore, DetailWidgetProps } from "@medusajs/framework/types"
import { EllipsisHorizontal, PencilSquare } from "@medusajs/icons"
import {
  Badge,
  Container,
  DropdownMenu,
  Heading,
  IconButton,
  Text,
} from "@medusajs/ui"
import { useState } from "react"

import { ReportingTimezoneDrawer } from "../features/analytics/components/reporting-timezone-drawer"
import { useReportingTimezone } from "../features/analytics/queries"
import { useWorkspaceReadOnly } from "../features/analytics/storage"
import {
  DEFAULT_REPORTING_TIMEZONE,
  REPORTING_TIMEZONE_KEY,
} from "../../shared/analytics/timezone"

const StoreReportingTimezoneWidget = ({
  data: store,
}: DetailWidgetProps<AdminStore>) => {
  const { data: reporting, isPending } = useReportingTimezone()
  const readOnly = useWorkspaceReadOnly()
  const [editing, setEditing] = useState(false)

  const current = reporting?.timezone ?? DEFAULT_REPORTING_TIMEZONE
  const isDefault =
    current === DEFAULT_REPORTING_TIMEZONE &&
    !store.metadata?.[REPORTING_TIMEZONE_KEY]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">Reporting timezone</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Analytics counts days and hours in this timezone.
          </Text>
        </div>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <IconButton size="small" variant="transparent">
              <EllipsisHorizontal />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              className="gap-x-2"
              disabled={readOnly || isPending}
              onClick={() => setEditing(true)}
            >
              <PencilSquare className="text-ui-fg-subtle" />
              Edit
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <div className="text-ui-fg-subtle grid grid-cols-2 items-center px-6 py-4">
        <Text size="small" weight="plus" leading="compact">
          Timezone
        </Text>
        <div className="flex items-center gap-x-2">
          <Text size="small" leading="compact">
            {isPending ? "-" : current}
          </Text>
          {!isPending && isDefault && (
            <Badge size="2xsmall" color="grey">
              Default
            </Badge>
          )}
        </div>
      </div>
      <ReportingTimezoneDrawer
        storeId={store.id}
        current={current}
        open={editing}
        onOpenChange={setEditing}
      />
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "store.details.after",
})

export default StoreReportingTimezoneWidget
