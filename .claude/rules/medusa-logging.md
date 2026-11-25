---
paths:
  - "src/**"
---

- Backend code logs only through `analyticsLog(logger, area)` from `src/shared/analytics/log.ts`. Get `logger` from `container.resolve(ContainerRegistrationKeys.LOGGER)` or the service's injected logger. Never `console.*` outside `src/admin`, which is browser code.
- The prefix is `[analytics:<area>]`. Add a new area to `AnalyticsLogArea` rather than inventing a prefix.
- Log ids and counts only. Never customer details, query bindings, report or SQL query text from admins, connection strings, passwords or role verifiers.
- Pass the caught error as the second argument so the stack is kept. Never log only `error.message`.
- Levels: `error` = failed and needs attention, `warn` = recovered or unexpected, `info` = key lifecycle events, `debug` = everything else.
