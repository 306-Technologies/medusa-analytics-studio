import { Button, Drawer, Input, Label } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  saveLabel: string
  saving: boolean
  onSave: (name: string) => Promise<boolean>
}

export const ReportNameDrawer = ({
  open,
  onOpenChange,
  name,
  saveLabel,
  saving,
  onSave,
}: Props) => {
  const [draft, setDraft] = useState(name)

  useEffect(() => {
    if (open) {
      setDraft(name)
    }
  }, [open, name])

  const submit = async () => {
    if (await onSave(draft.trim() || "Untitled report")) {
      onOpenChange(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Edit report</Drawer.Title>
          <Drawer.Description className="sr-only">
            Change the report's name.
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-y-2 overflow-y-auto">
          <Label size="small" weight="plus" htmlFor="report-name">
            Name
          </Label>
          <Input
            id="report-name"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void submit()
              }
            }}
          />
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary" disabled={saving}>
              Cancel
            </Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={saving}
            disabled={!draft.trim()}
            onClick={() => void submit()}
          >
            {saveLabel}
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
