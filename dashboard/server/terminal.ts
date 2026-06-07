import { spawn } from "node:child_process"
import { openSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import type { Plugin } from "vite"

const PORT = 7757

function portOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port })
    const finish = (open: boolean) => {
      socket.destroy()
      resolve(open)
    }
    socket.once("connect", () => finish(true))
    socket.once("error", () => finish(false))
    socket.setTimeout(600, () => finish(false))
  })
}

// The terminal's PTY (where claude runs) lives in a standalone worker-host
// process, not in this dev server, so restarting or stopping the dashboard
// never stops the worker. Here we only make sure that process is running; the
// browser connects to it directly on its own port. Start it by hand any time
// with `npm run worker`.
export function terminal(): Plugin {
  return {
    name: "embedded-terminal",
    async configureServer(server) {
      try {
        if (await portOpen(PORT)) return
        const root = path.resolve(server.config.root, "..")
        const script = path.join(server.config.root, "server", "worker-host.mjs")
        const log = openSync(path.join(root, "pipeline", "worker-host.log"), "a")
        const child = spawn(process.execPath, [script], {
          cwd: root,
          detached: true,
          stdio: ["ignore", log, log],
          windowsHide: true,
        })
        child.unref()
      } catch {
        // Auto-start failed; run `npm run worker` manually.
      }
    },
  }
}
