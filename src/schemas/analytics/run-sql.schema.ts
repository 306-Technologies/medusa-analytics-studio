import { z } from "@medusajs/framework/zod"

export const SQL_MAX_LENGTH = 20_000

export const RunSqlSchema = z.object({
  q: z.string().trim().min(1).max(SQL_MAX_LENGTH),
})

export type RunSqlBody = z.infer<typeof RunSqlSchema>
