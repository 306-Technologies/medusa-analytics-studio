import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import { ANALYTICS_SQL_MODULE } from "../modules/analytics-sql"
import { REPORTING_ROLE } from "../modules/analytics-sql/reporting-role"
import type AnalyticsSqlService from "../modules/analytics-sql/service"

/*
 * yarn medusa exec ./src/scripts/setup-sql-role.ts [print]
 * print emits the statements for a DB admin; they hold the SCRAM verifier, so treat the output as a secret.
 */
export default async function setupSqlRole({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const sql: AnalyticsSqlService = container.resolve(ANALYTICS_SQL_MODULE)

  if (args.some((arg) => arg !== "print")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `[script:setup-sql-role] Unknown argument: ${args.join(" ")}. Use "print" or no argument.`
    )
  }

  if (args.includes("print")) {
    // Command output asked for by hand, not a log line.
    process.stdout.write(
      `-- Run as a database user with CREATEROLE, in one transaction.\nbegin;\n${sql
        .setupStatements()
        .map((statement) => `${statement};`)
        .join("\n")}\ncommit;\n`
    )
    return
  }

  try {
    const problem = await sql.setUpRole()
    if (problem) {
      logger.warn(
        `[script:setup-sql-role] ${REPORTING_ROLE} is set up, but SQL mode will stay off: ${problem}`
      )
    } else {
      logger.info(
        `[script:setup-sql-role] ${REPORTING_ROLE} is set up. Restart the app (or wait for the next boot) to turn SQL mode on.`
      )
    }
  } catch (error) {
    logger.error(
      `[script:setup-sql-role] Setting up ${REPORTING_ROLE} failed. If the database user can't create roles, run this again with print and have a database admin run the output.`,
      error
    )
    throw error
  }
}
