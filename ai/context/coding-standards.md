# Coding Standards

Guide AI-generated changes unless a nearby file clearly establishes a different local pattern.

## General

- Prefer small, local, reversible changes over broad rewrites.
- Reuse what is in `src/shared/analytics/` before adding a new helper.
- No new abstractions unless they remove real duplication or improve clarity.
- Name files by responsibility, not by task wording. No generic `utils.ts` or `helpers.ts`.

## TypeScript

- Don't work around types; see the hard rules in `CLAUDE.md`.
- Upstream type wrong? Fix it at the source (module augmentation, corrected input type), never cast at the call site.
- Shared request/response shapes are defined once in `src/shared/analytics/types.ts`. The admin imports them; don't redeclare them.

## Placement

- `src/modules/*`: data and services. `src/workflows/*`: writes. `src/api/*`: admin routes, `middlewares.ts`, `projections/`.
- `src/schemas/analytics/`: Zod request schemas. `src/shared/analytics/`: code used by both backend and admin, or by several modules.
- `src/admin/`: browser code (routes, widgets, `features/analytics`, `components`).
- Anything exported from `package.json` `exports` is public API. Changing or removing it is a breaking change.

## Formatting

- Prettier config at the root (no semicolons, double quotes, `es5` trailing commas). Run `npx prettier --write <files>` on files you touched only.

## Validation

After meaningful changes, run the smallest relevant check first, then broader:

1. `npm run test:unit`, `npm run check-types`, `npm run lint`
2. `npm run build`
   For backend or admin changes, link the plugin into a Medusa app and open the page or hit the route.

## Working as an AI

1. Read the nearest existing implementation before proposing structure.
2. Call out assumptions when requirements are missing rather than inventing architecture.
3. Keep changes understandable to a maintainer who did not see the prompt.
4. End feature work with a short handoff: what changed, what was checked, what wasn't, and the `CHANGELOG.md` entry.
