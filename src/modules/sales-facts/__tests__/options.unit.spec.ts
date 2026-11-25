import { resolveSalesFactsOptions } from "../service"

describe("resolveSalesFactsOptions", () => {
  it("treats missing options as the defaults", () => {
    expect(resolveSalesFactsOptions(undefined)).toEqual({})
    expect(resolveSalesFactsOptions(null)).toEqual({})
  })

  it("keeps valid options", () => {
    expect(
      resolveSalesFactsOptions({ jobsEnabled: false, fxUrl: "off" })
    ).toEqual({ jobsEnabled: false, fxUrl: "off" })
  })

  it("refuses a jobsEnabled that is not a boolean", () => {
    const options = JSON.parse('{"jobsEnabled":"false"}')
    expect(() => resolveSalesFactsOptions(options)).toThrow(/jobsEnabled/)
  })

  it("refuses an fxUrl that is not a string", () => {
    const options = JSON.parse('{"fxUrl":1}')
    expect(() => resolveSalesFactsOptions(options)).toThrow(/fxUrl/)
  })
})
