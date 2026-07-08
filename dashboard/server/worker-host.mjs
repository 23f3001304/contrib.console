import { createRequire } from "node:module"
import { writeFileSync, readFileSync } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { startScheduler } from "./worker-schedule.mjs"

const stripAnsi = (s) =>
  s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b[()][AB0]/g, "")

function agentRunning(recent) {
  return /esc to interrupt|\? for shortcuts|welcome back|release-notes|│\s*>|antigravity|agy|ollama|>>>|#\s*$/i.test(
    stripAnsi(recent),
  )
}

function hasChildProcesses(pid) {
  if (!pid) return false
  try {
    if (process.platform === "win32") {
      const out = execSync(`wmic process where ParentProcessId=${pid} get ProcessId`, {
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 1000,
      }).toString()
      const lines = out.split("\n").map((l) => l.trim()).filter(Boolean)
      return lines.length > 1
    } else {
      const out = execSync(`pgrep -P ${pid}`, {
        stdio: ["pipe", "pipe", "ignore"],
        timeout: 1000,
      }).toString()
      return out.trim().length > 0
    }
  } catch {
    return false
  }
}

function detectAgentError(recent) {
  const cleanText = stripAnsi(recent)
  const ERROR_SIGNATURES = [
    { pattern: /\b(session expired|login expired)\b/i, message: "CLI Session Expired: Please log in again inside the terminal." },
    { pattern: /\b(unauthorized|auth failed|authentication failed|invalid API key|401 Unauthorized)\b/i, message: "CLI Authorization Error: Invalid token or credentials." },
    { pattern: /\b(permission denied|EACCES)\b/i, message: "CLI Permission Error: Scoped file-system access denied." },
    { pattern: /is not recognized as an internal or external command/i, message: "CLI Error: Command not found. Please install the agent CLI." },
    { pattern: /command not found/i, message: "CLI Error: Command not found. Please install the agent CLI." },
    { pattern: /\b(FATAL ERROR|uncaughtException|crashed)\b/i, message: "CLI Critical Error: The agent process crashed." },
  ]
  
  for (const sig of ERROR_SIGNATURES) {
    if (sig.pattern.test(cleanText)) {
      return sig.message
    }
  }
  return null
}

function readScheduleConfig() {
  try {
    const file = path.join(root, "pipeline", "schedule.json")
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return {}
  }
}

const require = createRequire(import.meta.url)
const { spawn } = require("node-pty")
const { WebSocketServer } = require("ws")

// Standalone worker host. It owns the PTY (PowerShell, where you run claude) and
// runs as its own process, independent of the dashboard dev server. Stopping or
// restarting the dashboard does not touch it, so the worker keeps running. The
// browser connects straight to this port; on (re)connect it replays the recent
// output to rebuild the screen, then streams live.
const PORT = Number(process.env.WORKER_HOST_PORT) || 7757
const MAX_BUFFER = 200_000
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const shell = process.platform === "win32" ? "powershell.exe" : "bash"
const statusPath =
  process.env.WORKER_STATUS_PATH ||
  path.join(root, "pipeline", "worker-status.json")

let pty = null
let lastActivity = Date.now()
let chunks = []
let size = 0
const clients = new Set()

function broadcast(data) {
  lastActivity = Date.now()
  chunks.push(data)
  size += data.length
  while (size > MAX_BUFFER && chunks.length > 1) {
    const dropped = chunks.shift()
    if (dropped) size -= dropped.length
  }
  for (const ws of clients) if (ws.readyState === 1) ws.send(data)
}

function spawnPty(cols, rows) {
  chunks = []
  size = 0
  const next = spawn(shell, [], {
    name: "xterm-color",
    cols: cols || 80,
    rows: rows || 24,
    cwd: root,
    env: process.env,
  })
  next.onData(broadcast)
  next.onExit(() => {
    if (pty === next) pty = null
  })

  // Wait 1.5 seconds for shell initialization, then auto-launch the agent CLI if not already running
  setTimeout(() => {
    const recent = chunks.join("")
    if (!agentRunning(recent)) {
      const cfg = readScheduleConfig()
      let cmd = cfg.agentCommand || "agy"
      if (cfg.bypassPermissions !== false) {
        const isBypassedAgent = /\b(claude|agy|ollama)(\.exe)?\b/i.test(cmd)
        const hasFlag = cmd.toLowerCase().includes("--dangerously-skip-permissions")
        if (isBypassedAgent && !hasFlag) {
          cmd += " --dangerously-skip-permissions"
        }
        const isSandboxable = /\b(agy)(\.exe)?\b/i.test(cmd)
        const hasSandbox = cmd.toLowerCase().includes("--sandbox")
        if (isSandboxable && !hasSandbox) {
          cmd += " --sandbox"
        }
      }
      next.write(cmd + "\r")
    }
  }, 1500)

  return next
}

function ensurePty(cols, rows) {
  if (!pty) pty = spawnPty(cols, rows)
  return pty
}

// Heartbeat for the dashboard's worker dot: "running" when the terminal produced
// output in the last few seconds (claude is working), "idle" when quiet. Written
// by the host itself, so it stays accurate without the worker maintaining it.
function writeStatus() {
  const recent = chunks.join("")
  const state = pty && hasChildProcesses(pty.pid) ? "running" : "idle"
  const error = detectAgentError(recent)
  try {
    writeFileSync(
      statusPath,
      JSON.stringify(
        { state, error, lastBeat: new Date().toISOString(), activeClients: clients.size },
        null,
        2,
      ),
    )
  } catch {
    // pipeline dir not ready yet; the next tick retries
  }
}
setInterval(writeStatus, 2000)
writeStatus()

ensurePty()

startScheduler({
  root,
  write: (data) => ensurePty().write(data),
  getRecent: () => chunks.slice(-120).join(""),
  getIdleMs: () => Date.now() - lastActivity,
  restart: () => {
    try {
      if (pty) pty.kill()
    } catch {
      // ignore
    }
    pty = spawnPty()
  },
})

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT })
wss.on("listening", () =>
  console.log(`[worker-host] ws://127.0.0.1:${PORT} cwd=${root}`),
)
wss.on("error", (err) => {
  console.error(`[worker-host] ${err.message}`)
  process.exit(1)
})
wss.on("connection", (ws) => {
  clients.add(ws)
  ensurePty()
  // Replay recent output so a reconnecting browser rebuilds the current screen.
  if (chunks.length) ws.send(chunks.join(""))
  ws.on("message", (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === "input" && typeof msg.data === "string") {
      ensurePty().write(msg.data)
    } else if (msg.type === "resize" && msg.cols && msg.rows) {
      ensurePty().resize(msg.cols, msg.rows)
    } else if (msg.type === "restart") {
      try {
        if (pty) pty.kill()
      } catch {
        // already gone
      }
      pty = spawnPty(msg.cols, msg.rows)
    }
  })
  ws.on("close", () => clients.delete(ws))
})
