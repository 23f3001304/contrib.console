import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import {
  Compass,
  FolderGit2,
  GitPullRequest,
  GitPullRequestArrow,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Settings as SettingsIcon,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandMark } from "@/components/brand-mark"
import { useRateLimit, useWorkerStatus } from "@/lib/bus/hooks"

const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/repos", label: "My repos", icon: FolderGit2 },
  { to: "/issues", label: "Pick issue", icon: ListChecks },
  { to: "/work", label: "Work", icon: ListTodo },
  { to: "/terminal", label: "Terminal", icon: SquareTerminal },
  { to: "/reviews", label: "Reviews", icon: GitPullRequest },
  { to: "/pulls", label: "Pull requests", icon: GitPullRequestArrow },
  { to: "/status", label: "Status", icon: LayoutDashboard },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
]

export function AppShell() {
  const location = useLocation()
  const rate = useRateLimit()
  const worker = useWorkerStatus()
  const connected = Boolean(rate.data) && !rate.isError

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="sticky top-0 flex h-svh w-56 shrink-0 flex-col overflow-y-auto border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <BrandMark className="size-5 shrink-0 text-brand" />
          <span className="font-mono text-sm font-medium tracking-tight">
            contrib.console
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />
                    )}
                    <Icon className="size-4" />
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto space-y-1.5 border-t px-5 py-4">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                worker.data?.active
                  ? "bg-emerald-500"
                  : worker.data?.state === "idle"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/40",
              )}
            />
            worker {worker.data?.active ? "running" : (worker.data?.state ?? "off")}
          </div>
          {worker.data?.currentTask && (
            <div
              className="truncate font-mono text-[10px] text-muted-foreground/70"
              title={worker.data.currentTask}
            >
              {worker.data.currentTask}
            </div>
          )}
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-emerald-500" : "bg-destructive",
              )}
            />
            {connected ? "GitHub PAT" : "no token"}
          </div>
          {rate.data && (
            <div className="tnum font-mono text-[10px] text-muted-foreground/70">
              core {rate.data.core.remaining}/{rate.data.core.limit} · search{" "}
              {rate.data.search.remaining}/{rate.data.search.limit}
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {worker.data?.error && (
          <div className="mx-auto max-w-4xl px-8 pt-6">
            <Link
              to="/terminal"
              className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive-foreground transition-colors hover:bg-destructive/10 animate-pulse"
            >
              <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-red-500"></span>
              </span>
              <span className="font-mono font-medium flex-1">
                {worker.data.error}
              </span>
              <span className="underline hover:no-underline font-mono">
                Open Terminal &rarr;
              </span>
            </Link>
          </div>
        )}
        <div
          key={location.pathname}
          className={cn(
            "duration-300 animate-in fade-in-0 slide-in-from-bottom-1",
            location.pathname === "/terminal" || location.pathname === "/work"
              ? "px-8 py-10 w-full"
              : "mx-auto max-w-4xl px-8 pb-12 pt-14",
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
