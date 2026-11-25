import type { ReportResult } from "./types"

type RebuildFields = Pick<
  ReportResult,
  "rebuilding" | "filling" | "pending_timezone" | "progress"
> & { range: Pick<ReportResult["range"], "timezone"> }

const percent = (progress: number | null) =>
  progress === null ? "" : `, about ${Math.round(progress * 100)}% done`

export const rebuildNotice = (data: RebuildFields): string | null => {
  if (!data.rebuilding) {
    return null
  }
  if (data.filling) {
    return `Analytics is being filled for the first time${percent(data.progress)}. Reports show numbers once it finishes.`
  }
  if (data.pending_timezone && data.pending_timezone !== data.range.timezone) {
    return `Days are still grouped in ${data.range.timezone}. Switching to ${data.pending_timezone}${percent(data.progress)}. Totals are unaffected.`
  }
  return `Analytics is being rebuilt for a new release${percent(data.progress)}. Numbers update when it finishes.`
}

export const rebuildLabel = (data: RebuildFields): string | null =>
  !data.rebuilding
    ? null
    : data.filling
      ? "Filling"
      : data.pending_timezone && data.pending_timezone !== data.range.timezone
        ? `Switching to ${data.pending_timezone}`
        : "Rebuilding"
