import type { ConfigModule, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { analyticsLog } from "./log"

const NEEDED = [
  {
    module: "event-bus-redis",
    why: "events are lost on a restart, so orders changed meanwhile wait for the nightly reconcile",
  },
  {
    module: "workflow-engine-redis",
    why: "every instance runs the analytics jobs",
  },
]

let checked = false

const resolvesOf = (config: ConfigModule): string[] =>
  Object.values(config.modules ?? {}).flatMap((entry) =>
    typeof entry === "object" &&
    entry !== null &&
    "resolve" in entry &&
    typeof entry.resolve === "string"
      ? [entry.resolve]
      : []
  )

export const warnAboutInfrastructure = (container: MedusaContainer): void => {
  if (checked) {
    return
  }
  checked = true
  if (process.env.NODE_ENV !== "production") {
    return
  }
  const resolves = resolvesOf(
    container.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE)
  )
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "infrastructure"
  )
  for (const { module, why } of NEEDED) {
    if (!resolves.some((resolve) => resolve.includes(module))) {
      log.warn(
        `No Redis ${module.replace("-redis", "").replace(/-/g, " ")} (${module}): ${why}. Set REDIS_URL.`
      )
    }
  }
}
