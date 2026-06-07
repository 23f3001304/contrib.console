import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebglAddon } from "@xterm/addon-webgl"
import "@xterm/xterm/css/xterm.css"

const HOST_PORT = 7757

export function TerminalView({
  onReady,
  onStatus,
}: {
  onReady?: (api: { restart: () => void }) => void
  onStatus?: (connected: boolean) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  const onStatusRef = useRef(onStatus)
  onReadyRef.current = onReady
  onStatusRef.current = onStatus

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
      fontSize: 12,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 5000,
      // ConPTY (what node-pty uses on Windows) hard-wraps and redraws regions
      // itself; tell xterm so it does not double-wrap and leave stale lines.
      windowsPty: { backend: "conpty" },
      theme: {
        background: "#0b0b0e",
        foreground: "#e4e4e7",
        cursor: "#e8a33d",
        selectionBackground: "#3f3f46",
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    try {
      const webgl = new WebglAddon()
      webgl.onContextLoss(() => webgl.dispose())
      term.loadAddon(webgl)
    } catch {
      // WebGL unavailable in this browser; the DOM renderer still works.
    }
    term.focus()

    let ws: WebSocket | null = null
    let disposed = false
    let attempts = 0
    let reconnectTimer: number | undefined
    let resizeTimer: number | undefined
    let lastCols = 0
    let lastRows = 0

    const send = (msg: object) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
    }
    const refit = () => {
      try {
        fit.fit()
      } catch {
        return
      }
      if (term.cols === lastCols && term.rows === lastRows) return
      lastCols = term.cols
      lastRows = term.rows
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(
        () => send({ type: "resize", cols: term.cols, rows: term.rows }),
        120,
      )
    }

    // The PTY lives in the standalone worker host. Connect straight to it and
    // keep retrying, so a dev-server restart (or starting the worker late) just
    // reconnects and replays instead of losing the session.
    const connect = () => {
      if (disposed) return
      // Loopback IPv4 explicitly: "localhost" can resolve to ::1 first on
      // Windows, which would miss the host bound on 127.0.0.1.
      ws = new WebSocket(`ws://127.0.0.1:${HOST_PORT}`)
      ws.onopen = () => {
        attempts = 0
        lastCols = 0
        lastRows = 0
        onStatusRef.current?.(true)
        refit()
        term.focus()
      }
      ws.onmessage = (event) => {
        if (typeof event.data === "string") term.write(event.data)
      }
      ws.onclose = () => {
        onStatusRef.current?.(false)
        if (disposed) return
        attempts += 1
        if (attempts === 3) {
          term.write(
            `\r\n\x1b[33m[worker host not reachable on :${HOST_PORT}. retrying... start it with: npm run worker]\x1b[0m\r\n`,
          )
        }
        reconnectTimer = window.setTimeout(connect, 1500)
      }
      ws.onerror = () => {
        try {
          ws?.close()
        } catch {
          // ignore
        }
      }
    }

    term.onData((data) => send({ type: "input", data }))
    onReadyRef.current?.({
      restart: () => send({ type: "restart", cols: term.cols, rows: term.rows }),
    })
    connect()

    fit.fit()
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => refit())
    }
    const timers = [window.setTimeout(refit, 120), window.setTimeout(refit, 500)]
    const observer = new ResizeObserver(() => refit())
    observer.observe(container)

    // Returning from another tab or app: re-fit, force a full repaint (clears the
    // stale WebGL buffer that backgrounding can leave), and refocus so keys reach
    // the PTY again instead of scrolling the page.
    const onRegainView = () => {
      if (document.hidden) return
      requestAnimationFrame(() => {
        refit()
        term.refresh(0, term.rows - 1)
        term.focus()
      })
    }
    const focusTerm = () => term.focus()
    document.addEventListener("visibilitychange", onRegainView)
    window.addEventListener("focus", onRegainView)
    container.addEventListener("mousedown", focusTerm)

    return () => {
      disposed = true
      timers.forEach((id) => window.clearTimeout(id))
      window.clearTimeout(resizeTimer)
      window.clearTimeout(reconnectTimer)
      observer.disconnect()
      document.removeEventListener("visibilitychange", onRegainView)
      window.removeEventListener("focus", onRegainView)
      container.removeEventListener("mousedown", focusTerm)
      if (ws) {
        ws.onclose = null
        ws.close()
      }
      term.dispose()
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
