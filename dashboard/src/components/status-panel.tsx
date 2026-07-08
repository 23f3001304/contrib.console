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
  const [hasInitialized, setHasInitialized] = useState(false)

  // Initialize active tab from schedule default agent command once on load
  useEffect(() => {
    if (scheduleQuery.data?.agentCommand && !hasInitialized) {
      setActiveTab(scheduleQuery.data.agentCommand.toLowerCase().includes("claude") ? "claude" : "agy")
      setHasInitialized(true)
    }
  }, [scheduleQuery.data?.agentCommand, hasInitialized])

  const tabStats = (stats as any)?.[activeTab]

  // Progress bar generator
  function renderAsciiBar(percent: number) {
    const totalBars = 16
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
    <div className="space-y-6 font-mono text-xs text-muted-foreground select-none max-w-2xl">
      {/* Header and Switch Tabs */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div>
          <span className="text-white font-semibold">diagnostics.log</span>
          <span className="opacity-40 text-[10px] ml-2">sys_monitor v2.0</span>
        </div>
        
        {/* Sleek Minimal Tab Switcher */}
        <div className="flex gap-1.5">
          {(["claude", "agy"] as const).map((tab) => {
            const isActive = activeTab === tab
            const isDefault = defaultAgent === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-2 py-0.5 border text-[10px] uppercase transition-all tracking-wider cursor-pointer",
                  isActive
                    ? "border-amber-500/40 text-amber-400 bg-amber-500/5 font-semibold"
                    : "border-white/5 text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                {tab} {isDefault && "*"}
              </button>
            )
          })}
        </div>
      </div>

      {/* Diagnostics List */}
      <div className="space-y-5">
        <div>
          <p className="text-white border-b border-white/5 pb-1 mb-2">SYSTEM STATUS</p>
          <div className="space-y-1.5 pl-2">
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">worker_state</span>
              <span className="opacity-40">:</span>
              <span className={cn(
                "flex items-center gap-1.5 font-semibold",
                worker?.active ? "text-emerald-400" : "text-amber-400"
              )}>
                <span className={cn(
                  "size-1.5 rounded-full shrink-0",
                  worker?.active ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )} />
                {worker?.state || "off"}
              </span>
              {worker?.currentTask && (
                <span className="opacity-50 text-[10px]">({worker.currentTask})</span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">last_sync</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">{tabStats ? formatTime(tabStats.lastUpdated) : "never"}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-white border-b border-white/5 pb-1 mb-2">ACTIVE WORKER EXPENSES</p>
          <div className="space-y-1.5 pl-2">
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">input_tokens</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">
                {sessionUsage ? `${formatNumber(sessionUsage.inputTokens)}` : "0"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">output_tokens</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">
                {sessionUsage ? `${formatNumber(sessionUsage.outputTokens)}` : "0"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">session_cost</span>
              <span className="opacity-40">:</span>
              <span className="text-emerald-400 font-semibold">
                {sessionUsage ? `$${sessionUsage.cost.toFixed(2)}` : "$0.00"}
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-white border-b border-white/5 pb-1 mb-2">CLI LIMIT UTILIZATION: {activeTab.toUpperCase()}</p>
          <div className="space-y-1.5 pl-2">
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">session_util</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">
                {tabStats ? renderAsciiBar(tabStats.sessionUsedPercent) : "[----------------] --%"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">weekly_util</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">
                {tabStats ? renderAsciiBar(tabStats.weeklyUsedPercent) : "[----------------] --%"}
              </span>
              {tabStats?.weeklyResets && (
                <span className="opacity-40 text-[10px]">
                  (resets: {tabStats.weeklyResets})
                </span>
              )}
            </div>

            {hasModels && tabStats?.models && (
              <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5 max-w-sm">
                <span className="text-[10px] text-white/40 block tracking-wider uppercase">model breakdown:</span>
                {Object.entries(tabStats.models).map(([model, percent]) => (
                  <div key={model} className="flex items-center gap-3 pl-2">
                    <span className="w-20 text-white/70 truncate">{model.toLowerCase()}</span>
                    <span className="opacity-40">:</span>
                    <span className="text-foreground">
                      {renderAsciiBar(percent as number)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-white border-b border-white/5 pb-1 mb-2">CLI REQUEST METRICS</p>
          <div className="space-y-1.5 pl-2">
            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">reqs_last_24h</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">
                {tabStats?.last24hRequests ?? 0} <span className="opacity-40 text-[10px]">({tabStats?.last24hSessions ?? 0} sessions)</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-24 opacity-60">reqs_last_7d</span>
              <span className="opacity-40">:</span>
              <span className="text-foreground">
                {tabStats?.last7dRequests ?? 0} <span className="opacity-40 text-[10px]">({tabStats?.last7dSessions ?? 0} sessions)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* History Log */}
      <div className="space-y-2.5">
        <p className="text-white border-b border-white/5 pb-1">usage_history.jsonl</p>
        
        {history.length === 0 ? (
          <p className="opacity-50 italic text-[10px] pl-2">Awaiting historical usage updates...</p>
        ) : (
          <div className="space-y-1 bg-black/20 rounded-lg p-3 border border-white/5 max-h-[160px] overflow-y-auto">
            {history.slice().reverse().map((entry, idx) => {
              const entryStats = (entry as any)[activeTab]
              if (!entryStats) return null
              return (
                <div key={idx} className="flex gap-4 text-[11px] opacity-75 hover:opacity-100 transition-opacity font-mono">
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
