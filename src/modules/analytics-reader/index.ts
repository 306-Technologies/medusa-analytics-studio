import { Module } from "@medusajs/framework/utils"

import AnalyticsReaderService from "./service"

export const ANALYTICS_READER_MODULE = "analyticsReader"

export default Module(ANALYTICS_READER_MODULE, {
  service: AnalyticsReaderService,
})
