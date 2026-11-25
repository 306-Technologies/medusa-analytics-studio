import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { ANALYTICS_WORKSPACE_MODULE } from "../../../../../modules/analytics-workspace"
import { GET } from "../route"

const call = async (readOnly: boolean) => {
  const service = {
    isReadOnly: async () => readOnly,
    listAnalyticsReports: jest.fn(async () => []),
    findUserDashboard: jest.fn(async () => null),
  }
  const req = {
    auth_context: { actor_id: "user_1" },
    scope: {
      resolve: (key: string) =>
        key === ANALYTICS_WORKSPACE_MODULE ? service : undefined,
    },
  } as unknown as AuthenticatedMedusaRequest
  let body: unknown
  const res = {
    status: () => res,
    json: (value: unknown) => {
      body = value
    },
  } as unknown as MedusaResponse
  await GET(req, res)
  return { body, service }
}

describe("GET /admin/analytics/workspace", () => {
  it("returns nothing saved and reads nothing when read-only", async () => {
    const { body, service } = await call(true)
    expect(body).toEqual({ reports: [], dashboard: null, read_only: true })
    expect(service.listAnalyticsReports).not.toHaveBeenCalled()
    expect(service.findUserDashboard).not.toHaveBeenCalled()
  })

  it("returns the user's workspace otherwise", async () => {
    const { body, service } = await call(false)
    expect(body).toEqual({ reports: [], dashboard: null, read_only: false })
    expect(service.listAnalyticsReports).toHaveBeenCalledWith(
      { user_id: "user_1" },
      expect.anything()
    )
  })
})
