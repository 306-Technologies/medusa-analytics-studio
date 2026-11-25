import { createHash } from "node:crypto"

import type { ICacheService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { analyticsLog } from "./log"

const KEY_PREFIX = "analytics:v1"

const inFlight = new Map<string, Promise<unknown>>()

// Part of every key: relative dates like -30d shift at midnight.
export const localToday = (timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

export const cacheKey = (
  kind: "report" | "live" | "sql",
  parts: (string | number)[],
  long?: string
) =>
  [
    KEY_PREFIX,
    kind,
    ...parts,
    ...(long ? [createHash("sha1").update(long).digest("hex")] : []),
  ].join(":")

// A cache that is down never fails the request: the value is just computed.
export const cached = async <T>(
  container: MedusaContainer,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<{ value: T; hit: boolean }> => {
  const log = analyticsLog(
    container.resolve(ContainerRegistrationKeys.LOGGER),
    "cache"
  )
  const cache = container.resolve<ICacheService>(Modules.CACHE)

  try {
    const hit = await cache.get<T>(key)
    if (hit !== null && hit !== undefined) {
      return { value: hit, hit: true }
    }
  } catch (error) {
    log.warn(`Reading ${key} failed, computing without the cache`, error)
  }

  const running = inFlight.get(key)
  if (running) {
    log.debug(`Joined a running computation for ${key}`)
    // Stored by the same function below, so it holds a T.
    return { value: (await running) as T, hit: true }
  }

  const promise = compute()
  inFlight.set(key, promise)
  try {
    const value = await promise
    try {
      await cache.set(key, value, ttlSeconds)
    } catch (error) {
      log.warn(`Storing ${key} failed, the next request computes again`, error)
    }
    return { value, hit: false }
  } finally {
    inFlight.delete(key)
  }
}
