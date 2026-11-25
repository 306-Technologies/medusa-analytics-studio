import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { sdk } from "../../lib/sdk"
import { reportingTimezoneOf } from "../../../shared/analytics/timezone"
import { analyticsApi } from "./api"
import { analyticsKeys } from "./query-keys"

export const useReport = (query: string | null) =>
  useQuery({
    queryKey: analyticsKeys.report(query ?? ""),
    queryFn: () => analyticsApi.report(query ?? ""),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })

const LIVE_REFRESH_MS = 10_000

export const useLive = () =>
  useQuery({
    queryKey: analyticsKeys.live(),
    queryFn: () => analyticsApi.live(),
    refetchInterval: LIVE_REFRESH_MS,
    placeholderData: keepPreviousData,
  })

export const useReportingTimezone = () =>
  useQuery({
    queryKey: analyticsKeys.timezone(),
    queryFn: async () => {
      const { stores } = await sdk.admin.store.list({ fields: "id,metadata" })
      const store = stores[0]
      return {
        storeId: store?.id ?? null,
        timezone: reportingTimezoneOf(store?.metadata),
      }
    },
  })

export const useSqlStatus = () =>
  useQuery({
    queryKey: analyticsKeys.sqlStatus(),
    queryFn: () => analyticsApi.sqlStatus(),
    staleTime: 60_000,
  })

export const useSqlViews = (enabled: boolean) =>
  useQuery({
    queryKey: analyticsKeys.sqlViews(),
    queryFn: () => analyticsApi.sqlViews(),
    enabled,
  })

export const useSqlResult = (sql: string | null) =>
  useQuery({
    queryKey: analyticsKeys.sql(sql ?? ""),
    queryFn: () => analyticsApi.runSql(sql ?? ""),
    enabled: sql !== null,
    placeholderData: keepPreviousData,
    retry: false,
    // The server caches for 60s too.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
