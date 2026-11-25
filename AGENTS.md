# AGENTS.md

Instructions for AI coding agents live in [`CLAUDE.md`](CLAUDE.md). Read it first, then the files it imports (`ai/context/architecture.md`, `ai/context/coding-standards.md`).

- Path-scoped rules: `.claude/rules/*.md`. Each file's `paths:` frontmatter lists the files it covers; follow it when editing those files.
- Repo layout: `ai/context/repo-map.md`.
- Checks before calling work done: `npm run lint`, `npm run check-types`, `npm run test:unit`, `npm run build`.
