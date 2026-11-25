import { defineRouteConfig } from "@medusajs/admin-sdk"

import { StateMessage } from "../../../components/state-message"
import {
  LiveView,
  LiveViewSkeleton,
} from "../../../features/analytics/components/live-view"
import { useLive } from "../../../features/analytics/queries"

const LiveViewPage = () => {
  const { data, isError } = useLive()

  if (isError && !data) {
    return (
      <StateMessage framed>The live view could not be loaded.</StateMessage>
    )
  }
  return data ? <LiveView data={data} /> : <LiveViewSkeleton />
}

export const config = defineRouteConfig({
  label: "Live view",
})

export const handle = {
  breadcrumb: () => "Live view",
}

export default LiveViewPage
