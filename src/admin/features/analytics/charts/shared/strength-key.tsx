import { CHART } from "../theme/tokens"

const STEPS = [0.12, 0.34, 0.56, 0.78, 1]

export const StrengthKey = ({
  colorOf,
}: {
  colorOf: (strength: number) => string
}) => (
  <div
    className="flex items-center justify-end gap-x-1.5 text-[11px] leading-4"
    style={{ color: CHART.fgMuted }}
  >
    <span className="pr-0.5">Fewer</span>
    {STEPS.map((step) => (
      <span
        key={step}
        className="size-2.5 rounded-sm"
        style={{ background: colorOf(step) }}
      />
    ))}
    <span className="pl-0.5">More</span>
  </div>
)
