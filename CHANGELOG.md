# Changelog

All notable changes to `@306technologies/medusa-analytics-studio` are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the version follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.2] - 2026-11-25

### Changed

- README: the install example reads `ssl` for `analytics-sql` from
  `ANALYTICS_SQL_SSL` (on unless set to `false`) instead of hard-coding `true`,
  and lists it in the `.env.template` names.

## [0.2.1] - 2026-11-25

### Changed

- README: the install example now configures `analytics-sql` from env vars
  (`ANALYTICS_SQL_DISABLED`, `ANALYTICS_SQL_PASSWORD`, `ANALYTICS_DATABASE_URL`,
  `ANALYTICS_SQL_ALLOW_PRIMARY`), with `ssl: true` and the two shipped
  reporting views listed.

## [0.2.0] - 2026-11-25

### Changed

- The admin pages moved from `/app/analytics` to `/app/analytics-studio` so
  they no longer clash with other analytics plugins. Old bookmarks to
  `/app/analytics` stop working.
- The sidebar entry and dashboard title are now "Analytics Studio", with the
  Analytics Studio icon.
- README: how the reporting timezone works and what changing it does.

## [0.1.2] - 2026-11-25

### Changed

- README: theme-aware Medusa and 306 Technologies logo, lighter WebP
  screenshots and tidier layout.

## [0.1.1] - 2026-11-25

### Changed

- README: screenshots, logos and project links.
- Releases publish through npm trusted publishing instead of a stored token.

## [0.1.0] - 2026-11-25

First release.

### Added

- Modules `analyticsReader`, `analyticsSql`, `analyticsWorkspace` and
  `salesFacts`, the `/admin/analytics/*` routes and their validation, the
  analytics workflows, jobs and subscribers, and the Analytics admin pages and
  store reporting timezone widget.
- `analyticsWorkspace` option `readOnly`: `GET /admin/analytics/workspace`
  returns `read_only: true` and the admin keeps reports and dashboards in the
  browser.
- Options are validated at startup; invalid values stop boot with an
  `INVALID_DATA` error.
- Migration script `analytics-core-indexes`, which indexes Medusa's `order` and
  `cart` tables after all module migrations, so `medusa db:migrate` works on an
  empty database.
- Exports `./modules/<name>`, `./workflows`, `./admin` and `./src/<path>`.
- `sql/create-indexes-concurrently.sql`, to build the `order` and `cart`
  indexes without blocking writes on a large store before the first migration.
- `setup-sql-role` script for SQL mode: run it from a one-line re-export in the
  host app, with `print` to output the statements for a database admin.
- Releases publish to npm from GitHub Releases, with provenance.

### Security

- Report queries are read-only in four layers: the query language accepts only
  its own clauses and listed names; each query runs in its own
  `SET TRANSACTION READ ONLY` transaction with a local statement timeout; the
  reader runs only a single `SELECT` or `WITH` with no write keywords and
  refuses session, lock and out-of-database functions; and every connection is
  opened with `default_transaction_read_only = on`, or discarded if that cannot
  be confirmed.
- SQL mode stays off unless the `disabled` option is explicitly `false`.
- A failed reporting-role setup logs only the Postgres error code, never the
  statement that carries the SCRAM verifier.

[Unreleased]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/306-Technologies/medusa-analytics-studio/releases/tag/v0.1.0
