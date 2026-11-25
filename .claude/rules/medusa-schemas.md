---
paths:
  - "src/schemas/**"
---

Mirror `src/schemas/analytics/`.

- Import `z` from `@medusajs/framework/zod`. One file per operation (`<operation>.schema.ts`), exporting the schema and its `z.infer` type, re-exported from `src/schemas/analytics/index.ts`. Never define schemas in `route.ts` or `middlewares.ts`.
- Shared pieces (query text, visualization, report kind) live in `query-text.ts`; reuse them.
- Zod v4: `z.email()`/`z.url()`/`z.uuid()`, `.extend(x.shape)` not `.merge()`, `z.strictObject()`/`z.looseObject()`, `z.enum(MyEnum)` not `z.nativeEnum()`, `z.record(z.string(), v)`.
- Name schemas after the input: `...Schema` for bodies, `...QuerySchema`, `...ParamsSchema`.
- Bound every string and array (`.max()`). Query text and SQL come from admins and reach the report engine.
- Type `AuthenticatedMedusaRequest<T>` with the schema's inferred type.
