# AI Development Workspace

Development-time AI assets for Claude Code and other coding agents. Not for app prompts or anything that ships in the npm package (`files` in `package.json` only ships `.medusa/server` and `sql/`).

## Where things live

| What                   | Where                   | Notes                                                                                                                                                                                                                                |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Always-on repo context | `CLAUDE.md`             | Commands, hard rules, gotchas. `AGENTS.md` points other agents to it.                                                                                                                                                                |
| Path-scoped rules      | `.claude/rules/*.md`    | Load when editing matching files.                                                                                                                                                                                                    |
| Guardrails             | `.claude/settings.json` | Lint, typecheck, build and tests run without a prompt. Migrations, `git push` and `npm publish` ask first. Env files, force-push and `--no-verify` are denied. Personal overrides go in `.claude/settings.local.json` (git-ignored). |
| MCP servers            | `.mcp.json`             | `medusa-docs` (Medusa docs and guides).                                                                                                                                                                                              |
| Shared reference       | `ai/context/`           | `architecture.md` and `coding-standards.md` are imported into `CLAUDE.md` (every session, keep them short). `repo-map.md` is read on demand.                                                                                         |

## Rules

1. **Write only what the code cannot tell you.** Gotchas, invariants, and "never do X because Y". Skip anything Claude can read from the files.
2. **Keep it short.** `CLAUDE.md` under about 100 lines. Stale docs are worse than none.
3. **One source of truth.** `README.md` owns the public contract (options, query language, safety). Link to it instead of repeating it.
4. **Fix it when it is wrong.** If Claude gets something wrong twice, add a line to the right file. If a rule stopped mattering, delete it.
5. **Mark guesses.** Anything inferred and not confirmed gets _(verify)_ until someone checks it.
6. **Public repo.** Nothing internal, client-specific or secret goes in these files.
