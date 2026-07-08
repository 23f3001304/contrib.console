import { cn } from "@/lib/utils"
import {
  useUsageStats,
  useUsageHistory,
  useWorkerStatus
} from "@/lib/bus/hooks"

export function StatusPanel() {
  const statsQuery = useUsageStats()
  const historyQuery = useUsageHistory()
  const workerQuery = useWorkerStatus()

  const stats = statsQuery.data
  const history = historyQuery.data ?? []
  const worker = workerQuery.data


  // Progress bar generator
  function renderAsciiBar(percent: number) {
    const totalBars = 20
    const filled = Math.round((Math.min(percent, 100) / 100) * totalBars)
    const empty = totalBars - filled
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percent}%`
  }

  function formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    } catch {
      return "--:--:--"
    }
  }

  // Format date only for history logs
  function formatLogTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    } catch {
      return "--:--"
    }
  }

  return (
    <div className="space-y-8 font-mono text-xs text-muted-foreground select-none">
      {/* Header */}
      <div>
        <p className="text-white font-semibold">diagnostics.log</p>
        <p className="text-[10px] opacity-60">System status, utilization, and API token billing caps</p>
      </div>

      {/* Diagnostics List */}
      <div className="space-y-2 border-l border-white/5 pl-4 py-1">
        <div className="flex items-center gap-3">
          <span className="w-24 text-white">worker_state:</span>
          <span className={cn(
            "flex items-center gap-1.5",
            worker?.active ? "text-emerald-400" : "text-amber-400"
          )}>
            <span className={cn(
              "size-1.5 rounded-full shrink-0",
              worker?.active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            )} />
            {worker?.state || "off"}
          </span>
          {worker?.currentTask && (
            <span className="opacity-50">(${worker.currentTask})</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="w-24 text-white">session_util:</span>
          <span className="text-foreground">
            {stats ? renderAsciiBar(stats.sessionUsedPercent) : "[--------------------] --%"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-24 text-white">weekly_util:</span>
          <span className="text-foreground">
            {stats ? renderAsciiBar(stats.weeklyUsedPercent) : "[--------------------] --%"}
          </span>
          {stats?.weeklyResets && (
            <span className="opacity-50 text-[10px]">
              (resets: {stats.weeklyResets})
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="w-24 text-white">reqs_last_24h:</span>
          <span className="text-foreground">{stats?.last24hRequests ?? 0}</span>
          <span className="opacity-50">({stats?.last24hSessions ?? 0} sessions)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-24 text-white">reqs_last_7d:</span>
          <span className="text-foreground">{stats?.last7dRequests ?? 0}</span>
          <span className="opacity-50">({stats?.last7dSessions ?? 0} sessions)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-24 text-white">last_sync:</span>
          <span className="text-foreground">{stats ? formatTime(stats.lastUpdated) : "never"}</span>
        </div>
      </div>

      {/* History Log */}
      <div className="space-y-3">
        <p className="text-white font-semibold">usage_history.jsonl</p>
        
        {history.length === 0 ? (
          <p className="opacity-50 italic text-[10px]">Awaiting historical usage updates...</p>
        ) : (
          <div className="space-y-1 bg-black/20 rounded-lg p-3 border border-white/5 max-h-[220px] overflow-y-auto">
            {history.slice().reverse().map((entry, idx) => (
              <div key={idx} className="flex gap-4 text-[11px] opacity-75 hover:opacity-100 transition-opacity">
                <span className="opacity-40">[{formatLogTime(entry.timestamp)}]</span>
                <span>session_util: {entry.sessionUsedPercent}%</span>
                <span className="opacity-40">|</span>
                <span>weekly_util: {entry.weeklyUsedPercent}%</span>
                <span className="opacity-40">|</span>
                <span>24h_reqs: {entry.last24hRequests}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
