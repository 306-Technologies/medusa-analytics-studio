import { CHART } from "../theme/tokens"

export const ChartLegend = ({
  items,
}: {
  items: ReadonlyArray<{ key: string; name: string; color: string }>
}) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {items.map((item) => (
      <li key={item.key} className="flex items-center gap-x-1.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: item.color }}
        />
        <span
          className="text-[11px] leading-4"
          style={{ color: CHART.fgTitle }}
        >
          {item.name}
        </span>
      </li>
    ))}
  </ul>
)
