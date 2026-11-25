import { Module } from "@medusajs/framework/utils"

import SalesFactsService from "./service"

export const SALES_FACTS_MODULE = "salesFacts"

export default Module(SALES_FACTS_MODULE, {
  service: SalesFactsService,
})
