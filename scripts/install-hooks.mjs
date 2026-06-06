#!/usr/bin/env node
// Installs the contribution-rule git hooks into a cloned target repo.
// The worker runs this right after cloning each repo.
//
// Usage: node install-hooks.mjs <repo-path>
import { writeFileSync, chmodSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoPath = process.argv[2]
if (!repoPath) {
  console.error("usage: node install-hooks.mjs <repo-path>")
  process.exit(2)
}

const here = path.dirname(fileURLToPath(import.meta.url))
// Use forward slashes so the path works inside the sh hook on Git for Windows.
const validate = path.join(here, "validate.mjs").replace(/\\/g, "/")
const node = process.execPath.replace(/\\/g, "/")

const hooksDir = path.join(repoPath, ".git", "hooks")
mkdirSync(hooksDir, { recursive: true })

const hooks = {
  "pre-commit": `#!/bin/sh\nexec "${node}" "${validate}" pre-commit\n`,
  "commit-msg": `#!/bin/sh\nexec "${node}" "${validate}" commit-msg "$1"\n`,
}

for (const [name, body] of Object.entries(hooks)) {
  const file = path.join(hooksDir, name)
  writeFileSync(file, body, "utf8")
  try {
    chmodSync(file, 0o755)
  } catch {
    // chmod is a no-op on some Windows setups; the hook still runs under sh.
  }
  console.log(`installed ${name} hook in ${repoPath}`)
}
