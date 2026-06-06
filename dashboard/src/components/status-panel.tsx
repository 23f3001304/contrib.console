import { cn } from "@/lib/utils"
import { EmptyNote } from "@/components/empty-note"
import { useQueue, useWorkerStatus } from "@/lib/bus/hooks"

export function StatusPanel() {
  const queue = useQueue()
  const worker = useWorkerStatus()
  const tasks = queue.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          status
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Task board</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Where each queued issue sits in the pipeline. This advances as the
          worker runs.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3",
          worker.data?.active && "border-emerald-500/30 bg-emerald-500/5",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full",
            worker.data?.active
              ? "bg-emerald-500"
              : worker.data?.state === "idle"
                ? "bg-amber-500"
                : "bg-muted-foreground/40",
          )}
        />
        <span className="font-mono text-xs">
          worker {worker.data?.active ? "running" : (worker.data?.state ?? "off")}
        </span>
        {worker.data?.currentTask && (
          <span className="text-sm text-muted-foreground">
            · {worker.data.currentTask}
          </span>
        )}
        {!worker.data?.active && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            start it in the Terminal
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyNote>No tasks yet. Queue an issue from a repo page.</EmptyNote>
      ) : (
        <div className="space-y-px overflow-hidden rounded-lg border">
          {tasks.map((task) => (
            <div
              key={task.taskId}
              className="flex items-center gap-3 bg-card p-3 transition-colors hover:bg-muted/40"
            >
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {task.repo.owner}/{task.repo.name}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-mono text-muted-foreground">
                  #{task.issueNumber}
                </span>{" "}
                {task.issueTitle}
              </span>
              <span className="shrink-0 rounded-full border bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
