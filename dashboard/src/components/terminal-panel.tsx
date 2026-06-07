import { useRef, useState } from "react"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TerminalView } from "@/components/terminal-view"

export function TerminalPanel() {
  const restartRef = useRef<() => void>(() => {})
  const [connected, setConnected] = useState(false)

  return (
    <div className="flex h-[calc(100svh-5rem)] flex-col gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          terminal
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Worker terminal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A standalone shell process in your Open_Source folder. Run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            claude
          </code>
          , then ask it to run the worker. It keeps running if you refresh or
          close the dashboard, and follows WORKER.md.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-[#0b0b0e] shadow-lg">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
              powershell · ~/Open_Source
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span
                className={cn(
                  "size-2 rounded-full transition-colors",
                  connected
                    ? "animate-pulse bg-emerald-500 shadow-[0_0_6px] shadow-emerald-500/60"
                    : "bg-muted-foreground/40",
                )}
              />
              <span
                className={
                  connected ? "text-emerald-400" : "text-muted-foreground"
                }
              >
                {connected ? "live" : "offline"}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => restartRef.current()}
            >
              <RotateCw className="size-3.5" /> restart
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-3">
          <TerminalView
            onReady={(api) => {
              restartRef.current = api.restart
            }}
            onStatus={setConnected}
          />
        </div>
      </div>
    </div>
  )
}
