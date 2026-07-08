import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  useUsageStats,
  useUsageHistory,
  useWorkerStatus,
  useWorkerSessionUsage,
  useSchedule
} from "@/lib/bus/hooks"

export function StatusPanel() {
  const statsQuery = useUsageStats()
  const historyQuery = useUsageHistory()
  const workerQuery = useWorkerStatus()
  const sessionUsageQuery = useWorkerSessionUsage()
  const scheduleQuery = useSchedule()

  const stats = statsQuery.data
  const history = historyQuery.data ?? []
  const worker = workerQuery.data
  const sessionUsage = sessionUsageQuery.data

  const defaultAgent = scheduleQuery.data?.agentCommand?.toLowerCase().includes("claude") ? "claude" : "agy"
  const [activeTab, setActiveTab] = useState<"claude" | "agy">("claude")

  useEffect(() => {
    if (scheduleQuery.data?.agentCommand) {
      setActiveTab(scheduleQuery.data.agentCommand.toLowerCase().includes("claude") ? "claude" : "agy")
    }
  }, [scheduleQuery.data?.agentCommand])

  const tabStats = (stats as any)?.[activeTab]

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

  function formatNumber(num: number) {
    return new Intl.NumberFormat().format(num)
  }

  const hasModels = tabStats?.models && Object.keys(tabStats.models).length > 0

  return (
    <div className="space-y-8 font-mono text-xs text-muted-foreground select-none">
      {/* Header and Switch Tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-4">
        <div>
          <p className="text-white font-semibold">diagnostics.log</p>
          <p className="text-[10px] opacity-60">System status, utilization, and API token billing caps</p>
        </div>
        
        {/* Sleek Minimal Tab Switcher */}
        <div className="flex gap-1.5 bg-black/40 border border-white/5 p-1 rounded-lg shrink-0">
          {(["claude", "agy"] as const).map((tab) => {
            const isActive = activeTab === tab
            const isDefault = defaultAgent === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-1 rounded text-[10px] transition-all font-mono uppercase tracking-wider cursor-pointer",
                  isActive
                    ? "bg-white/10 text-white font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {tab} {isDefault && <span className="text-[8px] opacity-40 lowercase">(default)</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Diagnostics List */}
      <div className="space-y-2 border-l border-white/5 pl-4 py-1">
        <div className="flex items-center gap-3">
          <span className="w-32 text-white">worker_state:</span>
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

        {/* Worker Session Stats */}
        <div className="flex items-center gap-3">
          <span className="w-32 text-white">session_input:</span>
          <span className="text-foreground">
            {sessionUsage ? `${formatNumber(sessionUsage.inputTokens)} tokens` : "0 tokens"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-32 text-white">session_output:</span>
          <span className="text-foreground">
            {sessionUsage ? `${formatNumber(sessionUsage.outputTokens)} tokens` : "0 tokens"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-32 text-white">session_cost:</span>
          <span className="text-emerald-400">
            {sessionUsage ? `$${sessionUsage.cost.toFixed(2)}` : "$0.00"}
          </span>
        </div>

        <div className="h-px bg-white/5 my-2 w-72" />

        {/* Selected CLI Util */}
        <div className="flex items-center gap-3">
          <span className="w-32 text-white">session_util:</span>
          <span className="text-foreground">
            {tabStats ? renderAsciiBar(tabStats.sessionUsedPercent) : "[--------------------] --%"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-32 text-white">weekly_util:</span>
          <span className="text-foreground">
            {tabStats ? renderAsciiBar(tabStats.weeklyUsedPercent) : "[--------------------] --%"}
          </span>
          {tabStats?.weeklyResets && (
            <span className="opacity-50 text-[10px]">
              (resets: {tabStats.weeklyResets})
            </span>
          )}
        </div>

        {/* Model breakdown list if present */}
        {hasModels && tabStats?.models && (
          <div className="space-y-2 mt-2 pt-2 border-t border-white/5 w-96">
            <span className="text-[10px] text-white/40 block uppercase tracking-wider">Model breakdown:</span>
            {Object.entries(tabStats.models).map(([model, percent]) => (
              <div key={model} className="flex items-center gap-3 pl-2">
                <span className="w-28 text-white/70 truncate">{model.toLowerCase()}:</span>
                <span className="text-foreground">
                  {renderAsciiBar(percent as number)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="h-px bg-white/5 my-2 w-72" />

        <div className="flex items-center gap-3">
          <span className="w-32 text-white">reqs_last_24h:</span>
          <span className="text-foreground">{tabStats?.last24hRequests ?? 0}</span>
          <span className="opacity-50">({tabStats?.last24hSessions ?? 0} sessions)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-32 text-white">reqs_last_7d:</span>
          <span className="text-foreground">{tabStats?.last7dRequests ?? 0}</span>
          <span className="opacity-50">({tabStats?.last7dSessions ?? 0} sessions)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-32 text-white">last_sync:</span>
          <span className="text-foreground">{tabStats ? formatTime(tabStats.lastUpdated) : "never"}</span>
        </div>
      </div>

      {/* History Log */}
      <div className="space-y-3">
        <p className="text-white font-semibold">usage_history.jsonl</p>
        
        {history.length === 0 ? (
          <p className="opacity-50 italic text-[10px]">Awaiting historical usage updates...</p>
        ) : (
          <div className="space-y-1 bg-black/20 rounded-lg p-3 border border-white/5 max-h-[220px] overflow-y-auto">
            {history.slice().reverse().map((entry, idx) => {
              const entryStats = (entry as any)[activeTab]
              if (!entryStats) return null
              return (
                <div key={idx} className="flex gap-4 text-[11px] opacity-75 hover:opacity-100 transition-opacity">
                  <span className="opacity-40">[{formatLogTime(entry.timestamp)}]</span>
                  <span>session_util: {entryStats.sessionUsedPercent}%</span>
                  <span className="opacity-40">|</span>
                  <span>weekly_util: {entryStats.weeklyUsedPercent}%</span>
                  <span className="opacity-40">|</span>
                  <span>24h_reqs: {entryStats.last24hRequests}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
