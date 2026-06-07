import { createRequire } from "node:module"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { startScheduler } from "./worker-schedule.mjs"

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
  const state = Date.now() - lastActivity < 4000 ? "running" : "idle"
  try {
    writeFileSync(
      statusPath,
      JSON.stringify(
        { state, lastBeat: new Date().toISOString(), activeClients: clients.size },
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

// Scheduled and on-demand auto-runs: types the launch + start prompt into the PTY.
startScheduler({
  root,
  write: (data) => ensurePty().write(data),
  getRecent: () => chunks.slice(-120).join(""),
  getIdleMs: () => Date.now() - lastActivity,
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
