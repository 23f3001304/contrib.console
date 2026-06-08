import { readFileSync, writeFileSync, unlinkSync } from "node:fs"
import path from "node:path"

const stripAnsi = (s) =>
  s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b[()][AB0]/g, "")
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const DEFAULT_PROMPT =
  "Start a worker run per WORKER.md: take the top approved or queued issue, make one small change (max 50 lines, max 2 files), write a commit review for me, then stop. Do not push."

const RESUME_PROMPT =
  "A commit review was just answered in the dashboard. Apply the newest response in pipeline/responses now, per WORKER.md: if it is approve, continue toward the issue with the next small commit (or finish the task if that was the final commit); if it is changes-requested, make the requested change as one new small reviewed commit. Then write the new review and stop. Do not push."

// Drives scheduled and on-demand worker runs by typing into the live terminal.
// Reads the schedule the dashboard saved and, at each due time (or when you
// click Run now), launches claude with bypassed permissions and tells it to
// start the worker. Runs inside the worker host so it works with no browser open.
export function startScheduler({ root, write, getRecent, getIdleMs }) {
  const configPath = path.join(root, "pipeline", "schedule.json")
  const statePath = path.join(root, "pipeline", "schedule-state.json")
  const triggerPath = path.join(root, "pipeline", "schedule-trigger.json")
  const resumePath = path.join(root, "pipeline", "resume-trigger.json")

  const readJson = (file, fallback) => {
    try {
      return JSON.parse(readFileSync(file, "utf8"))
    } catch {
      return fallback
    }
  }
  const state = readJson(statePath, { firedDay: {}, lastIntervalFire: null })
  const saveState = () => {
    try {
      writeFileSync(statePath, JSON.stringify(state, null, 2))
    } catch {
      // pipeline not ready; retried on the next tick
    }
  }
  let busy = false

  function claudeRunning() {
    return /esc to interrupt|\? for shortcuts|welcome back|release-notes|│\s*>/i.test(
      stripAnsi(getRecent()),
    )
  }

  function promptFor(cfg) {
    return (cfg.prompt && cfg.prompt.trim()) || DEFAULT_PROMPT
  }

  async function launch(cfg, promptText) {
    if (claudeRunning()) {
      write(promptText + "\r")
      return
    }
    const flag =
      cfg.bypassPermissions === false ? "" : " --dangerously-skip-permissions"
    write("claude" + flag + "\r")
    // Wait for claude's input box, accepting the one-time bypass warning if it
    // appears, then send the prompt.
    const start = Date.now()
    while (Date.now() - start < 25000) {
      await delay(700)
      const recent = stripAnsi(getRecent())
      if (/bypass permissions|do you want to proceed|accept the risk/i.test(recent)) {
        write("\r")
      }
      if (/\? for shortcuts|esc to interrupt|│\s*>/i.test(recent)) break
    }
    await delay(700)
    write(promptText + "\r")
  }

  function minutesSince(t, now) {
    const [h, m] = t.split(":").map(Number)
    return now.getHours() * 60 + now.getMinutes() - (h * 60 + m)
  }

  async function tick() {
    if (busy) return

    // Run now: a one-shot trigger written by the dashboard.
    const trigger = readJson(triggerPath, null)
    if (trigger) {
      if (getIdleMs() < 1500) return // terminal busy; keep the trigger, retry
      try {
        unlinkSync(triggerPath)
      } catch {
        // already consumed
      }
      busy = true
      try {
        const runCfg = readJson(configPath, {})
        await launch(runCfg, promptFor(runCfg))
      } finally {
        busy = false
      }
      return
    }

    // Resume: the dashboard answered a review. Nudge the worker to apply it,
    // whether or not scheduled runs are enabled.
    const resume = readJson(resumePath, null)
    if (resume) {
      if (getIdleMs() < 5000) return // wait until the worker is at a prompt
      try {
        unlinkSync(resumePath)
      } catch {
        // already consumed
      }
      busy = true
      try {
        const resumeCfg = readJson(configPath, {})
        await launch(resumeCfg, RESUME_PROMPT)
      } finally {
        busy = false
      }
      return
    }

    const cfg = readJson(configPath, null)
    if (!cfg || !cfg.enabled) return
    const now = new Date()
    const today = now.toISOString().slice(0, 10)

    let slot = null
    for (const t of cfg.times || []) {
      const since = minutesSince(t, now)
      if (since >= 0 && since <= 20 && state.firedDay[t] !== today) {
        slot = t
        break
      }
    }
    if (!slot && cfg.intervalMinutes > 0) {
      const last = state.lastIntervalFire
        ? new Date(state.lastIntervalFire).getTime()
        : 0
      if (Date.now() - last >= cfg.intervalMinutes * 60000) slot = "interval"
    }
    if (!slot) return
    if (getIdleMs() < 5000) return // wait until the terminal is at a prompt

    busy = true
    try {
      await launch(cfg, promptFor(cfg))
      if (slot === "interval") state.lastIntervalFire = new Date().toISOString()
      else state.firedDay[slot] = today
      saveState()
    } finally {
      busy = false
    }
  }

  // Seed the interval clock so enabling does not fire instantly on host start.
  if (!state.lastIntervalFire) {
    state.lastIntervalFire = new Date().toISOString()
    saveState()
  }
  const timer = setInterval(() => {
    tick().catch(() => {})
  }, 8000)
  return () => clearInterval(timer)
}
