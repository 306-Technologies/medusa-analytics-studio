import { resolveWorkspaceReadOnly } from "../service"

describe("resolveWorkspaceReadOnly", () => {
  it("is off when the option is left out", () => {
    expect(resolveWorkspaceReadOnly(undefined)).toBe(false)
    expect(resolveWorkspaceReadOnly(null)).toBe(false)
    expect(resolveWorkspaceReadOnly({})).toBe(false)
  })

  it("keeps a boolean", () => {
    expect(resolveWorkspaceReadOnly({ readOnly: true })).toBe(true)
    expect(resolveWorkspaceReadOnly({ readOnly: false })).toBe(false)
  })

  it("refuses anything else", () => {
    const options = JSON.parse('{"readOnly":"true"}')
    expect(() => resolveWorkspaceReadOnly(options)).toThrow(/readOnly/)
  })
})
