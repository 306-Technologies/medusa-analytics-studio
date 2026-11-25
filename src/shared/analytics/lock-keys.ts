// Each lock also takes the legacy hashtext lock first, so old and new instances exclude each other during a deploy.

/** "anly" as a 32-bit integer. */
const NAMESPACE = 0x616e6c79

export type AdvisoryLock = { legacy: string; key: number }

export const FACTS_LOCK: AdvisoryLock = { legacy: "sales-facts", key: 1 }
export const DRAIN_LOCK: AdvisoryLock = { legacy: "sales-facts-drain", key: 2 }
export const SQL_SETUP_LOCK: AdvisoryLock = {
  legacy: "analytics-sql-setup",
  key: 3,
}

export const lockStatements = (lock: AdvisoryLock): string[] => [
  `select pg_advisory_xact_lock(hashtext('${lock.legacy}'))`,
  `select pg_advisory_xact_lock(${NAMESPACE}, ${lock.key})`,
]

export const tryLockStatements = (lock: AdvisoryLock): string[] => [
  `select pg_try_advisory_xact_lock(hashtext('${lock.legacy}')) as locked`,
  `select pg_try_advisory_xact_lock(${NAMESPACE}, ${lock.key}) as locked`,
]
