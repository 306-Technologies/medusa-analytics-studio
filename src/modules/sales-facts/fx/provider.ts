export type ProviderRate = {
  day: string
  base: string
  quote: string
  /** An exact decimal string, never a float. */
  rate: string
}

export type ProviderRequest = {
  base: string
  quote: string
  from: string
  to: string
}

export interface FxRateProvider {
  readonly name: string
  fetchRates(request: ProviderRequest): Promise<ProviderRate[]>
}

export class FxProviderError extends Error {
  constructor(
    message: string,
    readonly unreachable: boolean,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = "FxProviderError"
  }
}
