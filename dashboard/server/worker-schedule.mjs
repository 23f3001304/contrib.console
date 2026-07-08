import { readFileSync, writeFileSync, unlinkSync, promises as fs } from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const stripAnsi = (s) =>
  s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b[()][AB0]/g, "")
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

const DEFAULT_PROMPT =
  "Start a worker run per WORKER.md: take the top approved or queued issue, make one small change (max 50 lines, max 2 files), write a commit review for me, then stop. Do not push. You are granted full permission to read/write/modify any file within the scoped directory by default. If you need any tool, pull and install it directly within the scoped directory (e.g., .tools/) and invoke its binary directly by path; do not run global installs or modify the system PATH."

const RESUME_PROMPT =
  "A commit review was just answered in the dashboard. Apply the newest response in pipeline/responses now, per WORKER.md: if it is approve, continue toward the issue with the next small commit (or finish the task if that was the final commit); if it is changes-requested, make the requested change as one new small reviewed commit. Then write the new review and stop. Do not push."

// Drives scheduled and on-demand worker runs by typing into the live terminal.
// Reads the schedule the dashboard saved and, at each due time (or when you
// click Run now), launches the configured agent and tells it to
// start the worker. Runs inside the worker host so it works with no browser open.
export function startScheduler({ root, write, getRecent, getIdleMs, restart }) {
  let lastLaunchedCommand = null
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

  function agentRunning() {
    return /esc to interrupt|\? for shortcuts|welcome back|release-notes|│\s*>|antigravity|agy|ollama|>>>|#\s*$/i.test(
      stripAnsi(getRecent()),
    )
  }

  function promptFor(cfg) {
    let p = (cfg.prompt && cfg.prompt.trim()) || DEFAULT_PROMPT
    if (cfg.parallelism === true) {
      p += " Parallel multi-tasking is enabled: you can spawn subagents or background shells to process multiple queued issues in parallel, or iterate through them sequentially. Do not stop or wait for reviews on completed commits; proceed directly to work on and write commits for subsequent queued tasks in the pipeline."
    }
    return p
  }

  async function launch(cfg, promptText) {
    let cmd = cfg.agentCommand || "agy"
    const isAgy = /\b(agy)(\.exe)?\b/i.test(cmd)
    const isClaude = /\b(claude)(\.exe)?\b/i.test(cmd)

    const sessionFile = path.join(root, "pipeline", "worker-session.json")
    let sessionMap = {}
    try {
      const raw = await fs.readFile(sessionFile, "utf8")
      sessionMap = JSON.parse(raw)
    } catch {
      sessionMap = {}
    }

    if (isClaude && !sessionMap.claude) {
      sessionMap.claude = crypto.randomUUID()
    }
    if (isAgy && !sessionMap.agy) {
      sessionMap.agy = crypto.randomUUID()
    }

    try {
      await fs.mkdir(path.dirname(sessionFile), { recursive: true })
      await fs.writeFile(sessionFile, JSON.stringify(sessionMap, null, 2), "utf8")
    } catch {
      // ignore
    }

    const sessionId = isClaude ? sessionMap.claude : sessionMap.agy

    if (cfg.bypassPermissions !== false) {
      if (isAgy && !cmd.toLowerCase().includes("--dangerously-skip-permissions")) {
        cmd += " --dangerously-skip-permissions"
      }
      if (isAgy && !cmd.toLowerCase().includes("--sandbox")) {
        cmd += " --sandbox"
      }
      if (isClaude && !cmd.toLowerCase().includes("--permission-mode")) {
        cmd += " --permission-mode bypassPermissions"
      }
    }

    if (isClaude && !cmd.toLowerCase().includes("--session-id")) {
      cmd += ` --session-id ${sessionId}`
    }
    if (isAgy && !cmd.toLowerCase().includes("--conversation")) {
      cmd += ` --conversation ${sessionId}`
    }

    if (agentRunning()) {
      if (lastLaunchedCommand && lastLaunchedCommand !== cmd && restart) {
        restart()
        await delay(2000)
      } else {
        write(promptText + "\r\n")
        lastLaunchedCommand = cmd
        return
      }
    }
    write(cmd + "\r\n")
    lastLaunchedCommand = cmd
    // Wait for the agent's input box or prompt, accepting the one-time bypass warning if it
    // appears, then send the prompt.
    const start = Date.now()
    while (Date.now() - start < 25000) {
      await delay(700)
      const recent = stripAnsi(getRecent())
      if (/bypass permissions|do you want to proceed|accept the risk/i.test(recent)) {
        write("\r\n")
      }
      if (/\? for shortcuts|esc to interrupt|│\s*>|antigravity|agy|ollama|>>>|#\s*$/i.test(recent)) break
    }
    await delay(700)
    write(promptText + "\r\n")
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
        let text = RESUME_PROMPT
        if (resumeCfg.parallelism === true) {
          text += " Continue working on all other queued issues concurrently or sequentially as well."
        }
        await launch(resumeCfg, text)
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
