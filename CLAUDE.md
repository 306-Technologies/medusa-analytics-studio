# Medusa Analytics Studio

`@306technologies/medusa-analytics-studio`: a single Medusa v2 plugin, published to npm (MIT, public repo). Sales reports, a dashboard, a live view and an optional read-only SQL editor in the Medusa Admin. Reports read pre-computed sales facts on their own read-only connection pool, never raw orders on the main pool.

Public repo: no client names, internal tooling or team process in code, docs or these AI files.

## Commands

- Package manager is npm (`package-lock.json`, CI runs `npm ci`). Don't touch `bun.lock` or add another lockfile.
- `npm run build`: `medusa plugin:build` into `.medusa/server`, then `scripts/link-admin-css.mjs`.
- `npm run dev`: rebuild on change for a Medusa app linked with yalc.
- Check: `npm run lint`, `npm run check-types`, `npm run test:unit`, `npm run format:check`.
- Unit tests live in `src/**/__tests__/*.unit.spec.ts`. There are no integration tests; to check a backend change for real, link the plugin into a Medusa app and hit the route.
- Migrations: `npx medusa plugin:db:generate` after changing a model. Never edit a committed migration.
- Release: `.github/workflows/publish.yml` publishes on a GitHub release whose tag matches `package.json` `version`. Never run `npm publish` locally.

## Read before writing code

- `ai/context/repo-map.md`: where things live.
- `.claude/rules/`: path-scoped rules that load when you edit matching files.
- `README.md`: the public contract (module options, query language, safety layers). Keep it true when behaviour changes.
- Read the nearest existing implementation before proposing structure.

## Medusa MCP

- `medusa-docs`: check it before using a Medusa API, workflow, or config option you aren't sure of. Medusa changes between minor versions.
- Not connected (`/mcp` shows "needs authentication")? Say so and continue from the code, don't guess at the API.

## Hard rules

- No `any`, `Record<string, any>`, `as never`, `as unknown as`, or untyped parameters. Define proper types.
- No `@ts-ignore` or `@ts-expect-error`. Fix the type.
- Exception: test files may cast mocks where they hand a fake to real code. Nowhere else.
- `import type { ... }` when importing only types.
- Strict null checks. Use `?.` and `??`, no non-null assertions unless certain.
- Backend logs through `analyticsLog(logger, area)` (`src/shared/analytics/log.ts`), never `console.*`.
- `npm run lint` runs `@medusajs/eslint-plugin`. Fix the code, don't disable the rule.
- Zod comes from `@medusajs/framework/zod` in backend code.
- All `@medusajs/*` packages stay on the same exact version, in `devDependencies` and `peerDependencies` alike. Upgrade them together.
- Report and SQL-mode queries must stay read-only. Never weaken a layer in the README "Safety" section (allow-listed query language, read-only transactions, statement checks, read-only connections, the restricted SQL role).
- Never read, print, or commit real env values or connection strings.
- Every user-visible change gets a `CHANGELOG.md` entry under `[Unreleased]`. Follow semver; a changed module option, route or exported path is a breaking change.
- Think through the full lifecycle of a change ("what happens at the end of this flow?") before calling it done.
- Match the style of the file you are editing. Prettier: no semicolons, double quotes. Format only files you touched.

## Git and PRs

- Feature branches contain only that feature's changes. Before opening a PR, `git diff main..HEAD --stat` must show only your files.
- Do not commit or push unless asked.
- No AI co-author trailers or AI attribution in commits or PRs.

## Architecture

@ai/context/architecture.md

## Coding standards

@ai/context/coding-standards.md
