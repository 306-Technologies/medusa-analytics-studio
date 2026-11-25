import type { MedusaContainer } from "@medusajs/framework/types"

import { SALES_FACTS_MODULE } from "../../modules/sales-facts"
import type SalesFactsService from "../../modules/sales-facts/service"

export const factsJobsEnabled = (
  container: MedusaContainer
): Promise<boolean> =>
  container.resolve<SalesFactsService>(SALES_FACTS_MODULE).jobsEnabled()
