import { Module } from "@medusajs/framework/utils"

import AnalyticsWorkspaceService from "./service"

// Not "analytics": that name belongs to Medusa's own analytics module.
export const ANALYTICS_WORKSPACE_MODULE = "analyticsWorkspace"

export default Module(ANALYTICS_WORKSPACE_MODULE, {
  service: AnalyticsWorkspaceService,
})
