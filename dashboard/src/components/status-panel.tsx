import { cn } from "@/lib/utils"
import {
  useUsageStats,
  useUsageHistory,
  useWorkerStatus
} from "@/lib/bus/hooks"
import {
  Activity,
  Calendar,
  Clock,
  Coins,
  Cpu,
  RefreshCw,
  TrendingUp,
  BarChart3
} from "lucide-react"

export function StatusPanel() {
  const statsQuery = useUsageStats()
  const historyQuery = useUsageHistory()
  const workerQuery = useWorkerStatus()

  const stats = statsQuery.data
  const history = historyQuery.data ?? []
  const worker = workerQuery.data

  const isIdle = !worker?.active

  // Helper to format date relative or clean
  function formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "--:--"
    }
  }

  // Custom SVG Area Chart calculation
  const chartWidth = 600
  const chartHeight = 160
  const padding = 25

  const chartPoints = history.slice(-20) // plot last 20 entries
  const requestValues = chartPoints.map((h) => h.last24hRequests)
  const maxRequests = requestValues.length > 0 ? Math.max(...requestValues) : 0
  const minRequests = requestValues.length > 0 ? Math.min(...requestValues) : 0
  const requestRange = maxRequests - minRequests

  let linePath = ""
  let areaPath = ""
  const svgCoords: { x: number; y: number; val: number; label: string }[] = []

  if (chartPoints.length > 1) {
    const stepX = (chartWidth - padding * 2) / (chartPoints.length - 1)
    
    chartPoints.forEach((pt, idx) => {
      const x = padding + idx * stepX
      const relativeVal = requestRange > 0 ? (pt.last24hRequests - minRequests) / requestRange : 0.5
      // invert Y for SVG coordinates (0 is top)
      const y = chartHeight - padding - relativeVal * (chartHeight - padding * 2)
      
      svgCoords.push({
        x,
        y,
        val: pt.last24hRequests,
        label: formatTime(pt.timestamp),
      })
    })

    linePath = svgCoords.reduce(
      (path, pt, idx) => path + `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`,
      ""
    )
    areaPath = `${linePath} L ${svgCoords[svgCoords.length - 1].x} ${chartHeight - padding} L ${svgCoords[0].x} ${chartHeight - padding} Z`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            diagnostics & billing
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Token Expense & Agent Stats
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor API token utilization, monthly caps, request history, and active LLM session metrics.
          </p>
        </div>
        <button
          onClick={() => {
            statsQuery.refetch()
            historyQuery.refetch()
          }}
          disabled={statsQuery.isRefetching}
          className="rounded-lg border border-white/5 bg-card/40 p-2 hover:bg-muted/40 transition-colors cursor-pointer"
          title="Sync Usage Stats Now"
        >
          <RefreshCw className={cn("size-4 text-muted-foreground", statsQuery.isRefetching && "animate-spin")} />
        </button>
      </div>

      {/* Main Grid: utilization Ring Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Worker Status Card */}
        <div className="rounded-xl border border-white/5 bg-card/40 p-5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-brand" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Worker Engine
              </span>
            </div>
            <span className={cn(
              "relative flex size-2 shrink-0 rounded-full",
              !isIdle ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            )} />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold tracking-tight capitalize">
              {worker?.state || "off"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {!isIdle
                ? `Active execution: ${worker?.currentTask || "processing queue"}`
                : "Awaiting task in queue backlog"}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-muted-foreground">
            <span>Clients connected</span>
            <span className="text-foreground">{worker?.activeClients || 0}</span>
          </div>
        </div>

        {/* Weekly Limit Util */}
        <div className="rounded-xl border border-white/5 bg-card/40 p-5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
            <Coins className="size-4 text-purple-400" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Weekly Subscription Limit
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-2xl font-semibold tracking-tight">
              {stats ? `${stats.weeklyUsedPercent}%` : "--"}
            </h3>
            <span className="text-xs text-muted-foreground">utilized</span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${stats ? Math.min(stats.weeklyUsedPercent, 100) : 0}%` }}
            />
          </div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground flex items-center gap-1">
            <Calendar className="size-3" />
            <span>
              {stats?.weeklyResets ? `Resets ${stats.weeklyResets}` : "Resets weekly"}
            </span>
          </div>
        </div>

        {/* Current Session Util */}
        <div className="rounded-xl border border-white/5 bg-card/40 p-5 backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
            <Clock className="size-4 text-emerald-400" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Current Session Limit
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <h3 className="text-2xl font-semibold tracking-tight">
              {stats ? `${stats.sessionUsedPercent}%` : "--"}
            </h3>
            <span className="text-xs text-muted-foreground">utilized</span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
              style={{ width: `${stats ? Math.min(stats.sessionUsedPercent, 100) : 0}%` }}
            />
          </div>
          <div className="mt-3 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>Last Sync</span>
            <span className="text-foreground">
              {stats ? formatTime(stats.lastUpdated) : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Numerical Metrics Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-card/20 p-5 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Activity className="size-5 text-brand" />
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block">
              Requests Last 24 Hours
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h4 className="text-xl font-bold">{stats?.last24hRequests ?? 0}</h4>
              <span className="text-xs text-muted-foreground">
                across {stats?.last24hSessions ?? 0} active sessions
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-card/20 p-5 flex items-center gap-4">
          <div className="size-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <BarChart3 className="size-5 text-indigo-400" />
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block">
              Requests Last 7 Days
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h4 className="text-xl font-bold">{stats?.last7dRequests ?? 0}</h4>
              <span className="text-xs text-muted-foreground">
                across {stats?.last7dSessions ?? 0} active sessions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Historical Chart Card */}
      <div className="rounded-xl border border-white/5 bg-card/40 p-5">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
          <TrendingUp className="size-4 text-brand" />
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            Request Load Trend (24h Window)
          </h3>
        </div>

        {history.length < 2 ? (
          <div className="h-[160px] flex items-center justify-center text-center">
            <p className="text-xs text-muted-foreground/60 italic">
              Awaiting background metrics collection to plot usage history...
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto select-none">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto max-h-[200px]"
            >
              <defs>
                <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={padding}
                y1={padding}
                x2={chartWidth - padding}
                y2={padding}
                stroke="white"
                strokeOpacity="0.04"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={chartHeight / 2}
                x2={chartWidth - padding}
                y2={chartHeight / 2}
                stroke="white"
                strokeOpacity="0.04"
                strokeDasharray="4 4"
              />
              <line
                x1={padding}
                y1={chartHeight - padding}
                x2={chartWidth - padding}
                y2={chartHeight - padding}
                stroke="white"
                strokeOpacity="0.08"
              />

              {/* Filled Area */}
              {areaPath && (
                <path d={areaPath} fill="url(#chartAreaGrad)" />
              )}

              {/* Main Line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {svgCoords.map((pt, idx) => (
                <g key={idx} className="group">
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#18181b"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all hover:scale-150 hover:fill-amber-500"
                  />
                  {/* Tooltip text */}
                  <text
                    x={pt.x}
                    y={pt.y - 12}
                    textAnchor="middle"
                    fill="#f59e0b"
                    fontSize="9"
                    fontFamily="monospace"
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-black pointer-events-none"
                  >
                    {pt.val}
                  </text>
                  {/* X Axis Label */}
                  {idx % Math.ceil(chartPoints.length / 5) === 0 && (
                    <text
                      x={pt.x}
                      y={chartHeight - 6}
                      textAnchor="middle"
                      fill="white"
                      fillOpacity="0.3"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {pt.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
