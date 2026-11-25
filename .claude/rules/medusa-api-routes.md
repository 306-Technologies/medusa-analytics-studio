---
paths:
  - "src/api/**"
---

Mirror the existing routes in `src/api/admin/analytics/`.

- Every route is under `/admin/analytics/` and uses `AuthenticatedMedusaRequest`. Scope user-owned data (reports, dashboards) by `req.auth_context.actor_id`.
- Validation goes in `src/api/middlewares.ts` with `validateAndTransformBody` / `validateAndTransformQuery` and a schema from `src/schemas/analytics/`. Handlers read `req.validatedBody` / `req.validatedQuery`, never `req.body` or `req.query`.
- Handlers resolve a module service or run a workflow, then respond with `res.status(n).json(...)`. No writes in route files; writes go through a workflow.
- Type the response with `MedusaResponse<T>`, where `T` comes from `src/shared/analytics/types.ts`. Never redeclare a response type.
- Build responses through `src/api/projections/`. Never return raw module records.
- Throw `MedusaError` for expected failures; never hand-write `{ message }`. Keep the error category (`NOT_FOUND`, `NOT_ALLOWED`, ...) instead of turning everything into `INVALID_DATA`.
- Methods: `GET`, `POST`, `DELETE` only. Updates are `POST /resource/:id`, never `PUT`/`PATCH`.
- Status codes: `200` reads, updates, actions; `201` creates; `204` only with no body. A missing resource addressed in the path is `404`.
- Route paths are lowercase kebab-case with plural collections and no CRUD verbs. Paths are public API: a rename is a breaking change, keep the old path as a re-export alias.
- No `any`, `as any`, `as never`, or `as unknown as`.
