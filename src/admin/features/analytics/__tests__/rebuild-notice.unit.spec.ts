import { rebuildLabel, rebuildNotice } from "../rebuild-notice"

const base = {
  rebuilding: true,
  filling: false,
  pending_timezone: null,
  progress: null,
  range: { timezone: "Europe/London" },
}

describe("rebuildNotice", () => {
  it("says nothing when nothing is being built", () => {
    expect(rebuildNotice({ ...base, rebuilding: false })).toBeNull()
    expect(rebuildLabel({ ...base, rebuilding: false })).toBeNull()
  })

  it("names both timezones during a timezone change", () => {
    const data = {
      ...base,
      pending_timezone: "America/New_York",
      progress: 0.6,
    }
    expect(rebuildNotice(data)).toBe(
      "Days are still grouped in Europe/London. Switching to America/New_York, about 60% done. Totals are unaffected."
    )
    expect(rebuildLabel(data)).toBe("Switching to America/New_York")
  })

  it("says the first fill shows numbers once done", () => {
    const data = { ...base, filling: true, progress: 0.25 }
    expect(rebuildNotice(data)).toBe(
      "Analytics is being filled for the first time, about 25% done. Reports show numbers once it finishes."
    )
    expect(rebuildLabel(data)).toBe("Filling")
  })

  it("calls a same-timezone rebuild a new release", () => {
    const data = { ...base, pending_timezone: "Europe/London", progress: 0.5 }
    expect(rebuildNotice(data)).toBe(
      "Analytics is being rebuilt for a new release, about 50% done. Numbers update when it finishes."
    )
  })
})
