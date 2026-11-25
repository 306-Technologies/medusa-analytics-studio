import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// plugin:build writes index.css but no entry imports it, so the dashboard would never load it.
const dir = ".medusa/server/src/admin"
if (existsSync(join(dir, "index.css"))) {
  for (const [file, line] of [
    ["index.mjs", 'import "./index.css";\n'],
    ["index.js", 'require("./index.css");\n'],
  ]) {
    const path = join(dir, file)
    const source = readFileSync(path, "utf8")
    if (source.includes(line)) {
      continue
    }
    const strict = '"use strict";\n'
    writeFileSync(
      path,
      source.startsWith(strict)
        ? strict + line + source.slice(strict.length)
        : line + source
    )
  }
}
