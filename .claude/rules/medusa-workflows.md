---
paths:
  - "src/workflows/**"
---

Mirror the existing workflows in `src/workflows/`.

- Writes flow route or job -> workflow -> steps -> module service. A workflow composes steps; each step does one thing and returns a `StepResponse`. Steps live in the workflow's `steps/` folder. Move one to `workflows/shared-steps/` only after a second workflow reuses it.
- Steps that write need a compensation function. Keep existing compensation when refactoring.
- Fail by throwing `MedusaError`; never return an error object as data. `workflow.run()` already throws, so do not add `errors.length` checks. Let the original error propagate.
- Check required results before dereferencing them (for example `result[0]`).
- No HTTP concerns (request, response, status codes) in workflows.
- The `createWorkflow` body runs once at load time: `function (input) {}` (not async, not arrow), no `await`, `if`/ternary/`??`/`?.`, loops, `new Date()`, `try/catch`, or mutation. Use `when(...).then()` (named) and `transform()`. A step used twice needs `.config({ name })`. `npm run lint` enforces most of this.
- Business rules and ownership checks run in steps, not in the route.
- Export every workflow from `src/workflows/index.ts`. It is the public `./workflows` export, so renaming or removing one is a breaking change.
