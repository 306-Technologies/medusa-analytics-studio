import {
  isUsablePassword,
  REPORTING_ROLE,
  reportingUrlFor,
  scramVerifier,
  grantStatements,
  isListedView,
  setupRoleStatements,
} from "../reporting-role"

describe("reportingUrlFor", () => {
  it("logs in as the reporting role on the same host and database", () => {
    const url = new URL(
      reportingUrlFor(
        "postgres://end_user_ro:ro-secret@db.example.com:5432/app?sslmode=require",
        "a-long-test-password"
      )
    )
    expect(url.username).toBe(REPORTING_ROLE)
    expect(url.password).toBe("a-long-test-password")
    expect(url.host).toBe("db.example.com:5432")
    expect(url.pathname).toBe("/app")
    expect(url.searchParams.get("sslmode")).toBe("require")
  })

  it("swaps a Neon pooler host for the direct host", () => {
    const url = new URL(
      reportingUrlFor(
        "postgresql://u:p@ep-rough-grass-123-pooler.c-2.us-east-1.aws.neon.tech/neondb",
        "a-long-test-password"
      )
    )
    expect(url.hostname).toBe("ep-rough-grass-123.c-2.us-east-1.aws.neon.tech")
  })

  it("keeps special characters in the password intact", () => {
    const password = "p@ss:w/rd#?%&long"
    const url = new URL(
      reportingUrlFor("postgres://u:p@localhost/db", password)
    )
    expect(decodeURIComponent(url.password)).toBe(password)
  })
})

describe("isUsablePassword", () => {
  it.each([
    ["Abcdefgh12345678", true],
    ["short", false],
    ["has a space in it ok", false],
    ["ünïcödé-pässwörd-x", false],
  ])("%s -> %s", (password, usable) => {
    expect(isUsablePassword(password)).toBe(usable)
  })
})

describe("scramVerifier", () => {
  it("has Postgres' SCRAM-SHA-256 verifier format", () => {
    expect(scramVerifier("Abcdefgh12345678")).toMatch(
      /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/
    )
  })

  it("uses a new salt every time", () => {
    expect(scramVerifier("Abcdefgh12345678")).not.toBe(
      scramVerifier("Abcdefgh12345678")
    )
  })
})

describe("setupRoleStatements", () => {
  it("sends the verifier, never the password", () => {
    const password = "Abcdefgh12345678"
    const sql = setupRoleStatements(scramVerifier(password), 5).join("\n")
    expect(sql).toContain("password 'SCRAM-SHA-256$4096:")
    expect(sql).not.toContain(password)
  })

  it("takes the setup lock before anything else", () => {
    expect(setupRoleStatements("SCRAM-SHA-256$4096:a$b:c", 5)[0]).toContain(
      "pg_advisory_xact_lock"
    )
  })

  it("sets the connection limit it is given, and grants no views", () => {
    const sql = setupRoleStatements("SCRAM-SHA-256$4096:a$b:c", 12).join("\n")
    expect(sql).toContain("connection limit 12 ")
    expect(sql).not.toMatch(/grant select/)
  })

  it("never sets no limit (-1) or a fraction", () => {
    for (const limit of [-1, 0, 2.5]) {
      expect(
        setupRoleStatements("SCRAM-SHA-256$4096:a$b:c", limit).join("\n")
      ).toContain("connection limit 5 ")
    }
  })
})

describe("isListedView", () => {
  it.each([
    ["sales_daily", ["sales_daily"], true],
    ["sales_daily_extra", ["sales_daily"], false],
    ["returns_daily", ["returns_*"], true],
    ["sales_daily", ["returns_*"], false],
    ["anything", ["*"], true],
    ["sales_daily", [], false],
  ])("%s in %j -> %s", (name, patterns, listed) => {
    expect(isListedView(name, patterns)).toBe(listed)
  })
})

describe("grantStatements", () => {
  it("revokes everything first, then grants only the listed views", () => {
    const sql = grantStatements(
      ["sales_daily", "loyalty_daily"],
      ["sales_daily"]
    )
    expect(sql[0]).toContain("pg_advisory_xact_lock")
    expect(sql).toContain(
      "alter default privileges in schema reporting revoke all on tables from reporting_reader"
    )
    expect(sql[1]).toContain("pg_advisory_xact_lock")
    expect(
      sql.indexOf(
        "revoke all on all tables in schema reporting from reporting_reader"
      )
    ).toBe(3)
    expect(sql.slice(4)).toEqual([
      'grant select on reporting."sales_daily" to reporting_reader',
    ])
    expect(sql.join("\n")).not.toMatch(/grant select on all tables/)
  })

  it("quotes names instead of trusting them", () => {
    const sql = grantStatements(['bad"; drop table x; --'], ["*"])
    expect(sql.at(-1)).toBe(
      'grant select on reporting."bad""; drop table x; --" to reporting_reader'
    )
  })
})
