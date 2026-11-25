import { ChevronDownMini, CircleStack, PlaySolid } from "@medusajs/icons"
import { Badge, Button, Text, Tooltip, clx } from "@medusajs/ui"
import { useState } from "react"

import type { SqlView } from "../types"

type Props = {
  views: SqlView[] | undefined
  loading: boolean
  onUse: (view: string) => void
}

const ViewCard = ({
  view,
  onUse,
}: {
  view: SqlView
  onUse: (view: string) => void
}) => {
  const [expanded, setExpanded] = useState(false)
  const count = view.columns.length

  return (
    <li className="border-ui-border-base bg-ui-bg-component flex flex-col rounded-lg border">
      <div className="flex flex-col gap-y-1 p-3">
        <div className="flex min-w-0 items-center gap-x-2">
          <CircleStack className="text-ui-fg-muted shrink-0" />
          <Text
            size="small"
            weight="plus"
            className="truncate font-mono"
            title={view.name}
          >
            {view.name}
          </Text>
        </div>
        {view.comment ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            {view.comment}
          </Text>
        ) : null}
      </div>

      <div className="border-ui-border-base flex items-center justify-between gap-x-2 border-t py-1.5 pl-1.5 pr-1.5">
        {count ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-component-hover txt-compact-xsmall-plus flex items-center gap-x-1 rounded-md px-1.5 py-1 transition-colors"
          >
            {expanded
              ? "Hide columns"
              : `${count} ${count === 1 ? "column" : "columns"}`}
            <ChevronDownMini
              className={clx(
                "transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180"
              )}
            />
          </button>
        ) : (
          <span />
        )}
        <Tooltip content="Replace the editor with a query on this table">
          <Button
            size="small"
            variant="secondary"
            onClick={() => onUse(view.name)}
          >
            <PlaySolid />
            Query
          </Button>
        </Tooltip>
      </div>

      {expanded ? (
        <ul className="border-ui-border-base flex flex-col border-t py-1">
          {view.columns.map((column) => (
            <li
              key={column.name}
              className="flex flex-col gap-y-0.5 px-3 py-1.5"
            >
              <div className="flex items-center justify-between gap-x-2">
                <Text
                  size="xsmall"
                  className="truncate font-mono"
                  title={column.name}
                >
                  {column.name}
                </Text>
                <Badge size="2xsmall" className="shrink-0 font-mono">
                  {column.type}
                </Badge>
              </div>
              {column.comment ? (
                <Text size="xsmall" className="text-ui-fg-muted">
                  {column.comment}
                </Text>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export const SqlViewsPanel = ({ views, loading, onUse }: Props) => {
  if (loading) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        Loading tables...
      </Text>
    )
  }
  if (!views?.length) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        No reporting views yet. A module adds one in a migration (see "Reporting
        views" in the backend conventions).
      </Text>
    )
  }

  const enabled = views.filter((view) => view.enabled)
  const available = views.filter((view) => !view.enabled)

  return (
    <div className="flex flex-col gap-y-3">
      {enabled.length ? (
        <ul className="flex flex-col gap-y-2">
          {enabled.map((view) => (
            <ViewCard key={view.name} view={view} onUse={onUse} />
          ))}
        </ul>
      ) : (
        <Text size="small" className="text-ui-fg-muted">
          No views enabled for SQL mode yet.
        </Text>
      )}
      {available.length ? (
        <div className="border-ui-border-base flex flex-col gap-y-1 rounded-lg border border-dashed p-3">
          <Text size="xsmall" weight="plus" className="text-ui-fg-subtle">
            Not enabled yet
          </Text>
          <Text size="xsmall" className="text-ui-fg-muted">
            Add to reportingViews in medusa-config.ts and restart to query
            these.
          </Text>
          <ul className="flex flex-col gap-y-0.5 pt-1">
            {available.map((view) => (
              <li key={view.name}>
                <Text
                  size="xsmall"
                  className="text-ui-fg-muted truncate font-mono"
                >
                  {view.name}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
