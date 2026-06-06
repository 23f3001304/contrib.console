#!/usr/bin/env node
// Mechanical enforcement of the contribution rules. Installed as git hooks in
// every cloned target repo by install-hooks.mjs. Blocks the commit on any
// violation so the rules cannot be bypassed by the worker (or anyone).
//
// Usage:
//   node validate.mjs pre-commit            (checks staged size + em dash)
//   node validate.mjs commit-msg <msgfile>  (checks message em dash + AI trailers)
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const MAX_LINES = Number(process.env.CONTRIB_MAX_LINES ?? 50)
const MAX_FILES = Number(process.env.CONTRIB_MAX_FILES ?? 2)
const EM_DASH = "—"
const EN_DASH = "–"

// Fingerprints the harness would otherwise add. These must never reach a commit.
const AI_PATTERNS = [
  /co-authored-by:\s*claude/i,
  /co-authored-by:[^\n]*anthropic/i,
  /generated with[^\n]*claude code/i,
  /noreply@anthropic\.com/i,
  /\u{1F916}/u, // robot emoji
]

function git(args) {
  return execSync(`git ${args}`, { encoding: "utf8" })
}

function finish(errors) {
  if (errors.length > 0) {
    console.error("Commit blocked by contribution rules:")
    for (const error of errors) console.error("  - " + error)
    process.exit(1)
  }
  process.exit(0)
}

function preCommit() {
  const errors = []

  const numstat = git("diff --cached --numstat").split("\n").filter(Boolean)
  const files = numstat.length
  let changed = 0
  for (const row of numstat) {
    const [added, removed] = row.split("\t")
    changed += (added === "-" ? 0 : Number(added)) + (removed === "-" ? 0 : Number(removed))
  }
  if (files > MAX_FILES) {
    errors.push(`${files} files staged, limit is ${MAX_FILES}`)
  }
  if (changed > MAX_LINES) {
    errors.push(`${changed} changed lines, limit is ${MAX_LINES}`)
  }

  const added = git("diff --cached --unified=0")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  if (added.some((line) => line.includes(EM_DASH) || line.includes(EN_DASH))) {
    errors.push("em dash found in staged changes")
  }

  finish(errors)
}

function commitMsg(file) {
  const errors = []
  const message = readFileSync(file, "utf8")
  if (message.includes(EM_DASH) || message.includes(EN_DASH)) {
    errors.push("em dash in commit message")
  }
  for (const pattern of AI_PATTERNS) {
    if (pattern.test(message)) {
      errors.push("AI fingerprint in commit message")
      break
    }
  }
  finish(errors)
}

const [mode, arg] = process.argv.slice(2)
if (mode === "pre-commit") {
  preCommit()
} else if (mode === "commit-msg") {
  commitMsg(arg)
} else {
  console.error("usage: node validate.mjs <pre-commit|commit-msg> [msgfile]")
  process.exit(2)
}
