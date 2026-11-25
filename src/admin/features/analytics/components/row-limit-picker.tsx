import { Select } from "@medusajs/ui"

const PRESETS = [5, 10, 25, 50, 100] as const

const ALL = "all"

type Props = {
  value: number | null
  onChange: (limit: number | null) => void
}

export const RowLimitPicker = ({ value, onChange }: Props) => {
  const limits: number[] =
    value !== null && !PRESETS.some((preset) => preset === value)
      ? [...PRESETS, value].sort((a, b) => a - b)
      : [...PRESETS]

  return (
    <Select
      size="small"
      value={value === null ? ALL : String(value)}
      onValueChange={(next) => {
        const limit = Number(next)
        onChange(next === ALL || !Number.isInteger(limit) ? null : limit)
      }}
    >
      <Select.Trigger aria-label="Rows to show">
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={ALL}>All rows</Select.Item>
        {limits.map((limit) => (
          <Select.Item key={limit} value={String(limit)}>
            {limit} rows
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  )
}
