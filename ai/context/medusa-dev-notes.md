# Medusa's official agent skills vs ours

Medusa publishes Claude Code skills at [medusajs/medusa-agent-skills](https://github.com/medusajs/medusa-agent-skills). We reviewed the `medusa-dev` plugin (v1.0.15, repo commit `4b495d5`, 2026-10-15) and **do not install it**: it assumes a standalone Medusa app, not a plugin, and tells Claude its skills take priority. Useful rules are restated in `.claude/rules/` in our own words (their repo has no license).

Re-check when Medusa bumps the plugin version or a Medusa minor release changes conventions.

## Where we deliberately differ

| Topic           | `medusa-dev`                                              | Ours                                               | Why                                    |
| --------------- | --------------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| Migrations      | `npx medusa db:generate <module>`                         | `npx medusa plugin:db:generate`                    | Theirs doesn't work for plugin modules |
| Schema location | Exported from `middlewares.ts` / `validators.ts`          | `src/schemas/analytics/<operation>.schema.ts`      | One place per operation                |
| Workflow files  | `src/workflows/<name>.ts` + shared `src/workflows/steps/` | `src/workflows/<name>/index.ts` + its own `steps/` | Each workflow self-contained           |
| Response shape  | Spread `...req.queryConfig` (client picks fields)         | Mapped through `src/api/projections/`              | Stable response contract               |
| Wrap-up         | Long "Implementation Complete" with curl examples         | Short handoff + `CHANGELOG.md` entry               | Written for reviewers                  |

## What we took from it

- `@medusajs/eslint-plugin` recommended config (`eslint.config.ts`).
- Workflow composition constraints (`.claude/rules/medusa-workflows.md`).
- Zod v4 syntax changes.
- `GET`/`POST`/`DELETE` only.
- Business and ownership checks in workflow steps; trust `authenticate`.
- Event payloads are id-only.
- camelCase module names.
