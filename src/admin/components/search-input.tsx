import { MagnifyingGlass } from "@medusajs/icons"
import { Input, clx } from "@medusajs/ui"

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
}

export const SearchInput = ({ value, onChange, label, className }: Props) => (
  <div className={clx("relative", className)}>
    <MagnifyingGlass className="text-ui-fg-muted pointer-events-none absolute left-2 top-1/2 -translate-y-1/2" />
    <Input
      size="small"
      aria-label={label}
      placeholder={label}
      className="pl-8"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
)
