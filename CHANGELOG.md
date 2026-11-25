# Changelog

All notable changes to `@306technologies/medusa-analytics-studio` are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the version follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/306-Technologies/medusa-analytics-studio/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/306-Technologies/medusa-analytics-studio/releases/tag/v0.1.0
