import { Link } from "react-router-dom"
import { useState } from "react"
import { toast } from "sonner"
import {
  X,
  FileCheck,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  ChevronRight,
  GripVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyNote } from "@/components/empty-note"
import {
  useDequeue,
  useQueue,
  useReorderQueue,
  useMessages,
  useWorkerStatus
} from "@/lib/bus/hooks"
import { cn } from "@/lib/utils"

export function WorkPanel() {
  const queue = useQueue()
  const dequeue = useDequeue()
  const reorder = useReorderQueue()
  const messages = useMessages()
  const workerStatus = useWorkerStatus()
  
  const queued = queue.data ?? []
  const msgList = messages.data ?? []

  // Drag-and-drop state for queue reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Categorize tasks based on actual implementation states
  const activeTask = queued.find(
    (t) => t.status === "in-progress" || t.status === "cloning"
  )
  const backlog = queued.filter((t) => t.status === "selected")
  const reviewsNeeded = queued.filter(
    (t) => t.status === "awaiting-review" || t.status === "changes-requested"
  )
  const completed = queued.filter(
    (t) => t.status === "approved" || t.status === "pushed" || t.status === "pr-open"
  )

  // Get active task logs
  const activeLogs = activeTask
    ? msgList.filter((m) => m.taskId === activeTask.taskId).slice(-3)
    : []

  // Move item in array helper
  function moveItem(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= backlog.length) return
    const reorderedBacklog = [...backlog]
    const [movedItem] = reorderedBacklog.splice(fromIndex, 1)
    reorderedBacklog.splice(toIndex, 0, movedItem)

    // Construct final queue list preserving active, reviews, completed tasks
    const activeTasks = queued.filter((t) => t.status !== "selected")
    const newQueueIds = [
      ...activeTasks.map((t) => t.taskId),
      ...reorderedBacklog.map((t) => t.taskId)
    ]

    reorder.mutate(newQueueIds, {
      onError: (err) => toast.error(`Failed to reorder: ${err.message}`),
    })
  }

  // HTML5 Drag-and-drop handlers for vertical queue reordering
  function handleDragStart(index: number) {
    setDraggedIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(index: number) {
    if (draggedIndex !== null && draggedIndex !== index) {
      moveItem(draggedIndex, index)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          work management
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Worker Pipeline & Priority
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Monitor active worker runs, prioritize the implementation backlog, and review completed features.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: Active Task + Backlog Management (Wider) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Task card */}
          <div className="rounded-xl border border-white/5 bg-card/40 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "relative flex size-2 shrink-0 rounded-full",
                  activeTask ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                )}>
                  {activeTask && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                </span>
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                  Current Agent Focus
                </h3>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {workerStatus.data?.active ? "Active" : "Idle"}
              </span>
            </div>

            {activeTask ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/repo/${activeTask.repo.owner}/${activeTask.repo.name}`}
                      className="font-mono text-xs text-brand hover:underline"
                    >
                      {activeTask.repo.owner}/{activeTask.repo.name}
                    </Link>
                    <a
                      href={activeTask.issueUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-sm font-semibold hover:underline"
                    >
                      #{activeTask.issueNumber} {activeTask.issueTitle}
                    </a>
                  </div>
                  <span className="rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 font-mono text-[10px] uppercase text-brand tracking-wider">
                    {activeTask.status}
                  </span>
                </div>

                {/* Progress Logs */}
                <div className="rounded-lg bg-black/40 p-3.5 border border-white/5">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5 pb-1.5 mb-2">
                    Live Progress Log
                  </p>
                  {activeLogs.length > 0 ? (
                    <div className="space-y-1">
                      {activeLogs.map((log, idx) => (
                        <div key={idx} className="font-mono text-[11px] text-muted-foreground truncate">
                          <span className="text-white/40 mr-1.5">
                            [{new Date(log.at).toLocaleTimeString()}]
                          </span>
                          {log.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-mono text-[11px] text-muted-foreground/60 italic">
                      Agent initializing task environment...
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-8 mb-4 text-center py-4">
                <p className="font-mono text-sm text-muted-foreground">
                  The agent is currently idle.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Queue an issue to trigger automated worker runs.
                </p>
              </div>
            )}
          </div>

          {/* Priority Backlog */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Queue Backlog ({backlog.length})
            </h3>
            
            {backlog.length === 0 ? (
              <EmptyNote>No pending tasks in backlog. Approve issues from the Discover or Pick Issue panels.</EmptyNote>
            ) : (
              <div className="space-y-1.5">
                {backlog.map((item, idx) => {
                  const isDragging = draggedIndex === idx
                  const isOver = dragOverIndex === idx

                  return (
                    <div
                      key={item.taskId}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={() => handleDrop(idx)}
                      className={cn(
                        "flex items-center gap-3 bg-card/60 border border-white/5 rounded-xl p-3.5 transition-all shadow-sm",
                        isDragging ? "opacity-30 border-dashed" : "",
                        isOver ? "bg-muted border-brand/30 translate-x-1" : "hover:bg-muted/40",
                      )}
                    >
                      {/* Drag handle */}
                      <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors p-1">
                        <GripVertical className="size-4 shrink-0" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/repo/${item.repo.owner}/${item.repo.name}`}
                            className="font-mono text-[10px] text-muted-foreground hover:text-brand truncate max-w-[150px]"
                          >
                            {item.repo.owner}/{item.repo.name}
                          </Link>
                          <span className="font-mono text-[9px] text-white/30">•</span>
                          <span className="font-mono text-[9px] text-muted-foreground/70">
                            {new Date(item.selectedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <a
                          href={item.issueUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block truncate text-sm font-medium hover:underline text-foreground/90"
                        >
                          <span className="font-mono text-muted-foreground mr-1">
                            #{item.issueNumber}
                          </span>
                          {item.issueTitle}
                        </a>
                      </div>

                      {/* Manual sorting buttons */}
                      <div className="flex flex-col gap-0.5 md:flex-row md:gap-1.5 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:bg-muted"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, idx - 1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:bg-muted"
                          disabled={idx === backlog.length - 1}
                          onClick={() => moveItem(idx, idx + 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={dequeue.isPending}
                          onClick={() =>
                            dequeue.mutate(item.taskId, {
                              onSuccess: () => toast.success("Dequeued"),
                              onError: (err) => toast.error(err.message),
                            })
                          }
                          title="Dequeue"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Awaiting Reviews + Completed Work) (Narrower) */}
        <div className="space-y-6">
          {/* Reviews Needed */}
          <div className="rounded-xl border border-white/5 bg-card/20 p-5 space-y-4">
            <div className="flex items-center gap-1.5 border-b border-white/5 pb-2.5">
              <FileCheck className="size-4 text-purple-400 shrink-0" />
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                Action Required ({reviewsNeeded.length})
              </h3>
            </div>

            {reviewsNeeded.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic py-2">
                No features awaiting review.
              </p>
            ) : (
              <div className="space-y-3">
                {reviewsNeeded.map((item) => (
                  <div
                    key={item.taskId}
                    className="flex flex-col gap-2 rounded-lg border border-white/5 bg-card/60 p-3 shadow-sm hover:border-brand/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/repo/${item.repo.owner}/${item.repo.name}`}
                        className="font-mono text-[10px] text-muted-foreground truncate hover:text-brand"
                      >
                        {item.repo.owner}/{item.repo.name}
                      </Link>
                      <span className={cn(
                        "rounded px-1.5 py-0.2 font-mono text-[8px] uppercase tracking-wider border",
                        item.status === "awaiting-review"
                          ? "bg-purple-950/20 text-purple-400 border-purple-950/40"
                          : "bg-amber-950/20 text-amber-400 border-amber-950/40"
                      )}>
                        {item.status}
                      </span>
                    </div>
                    <a
                      href={item.issueUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold leading-relaxed hover:underline line-clamp-2"
                    >
                      #{item.issueNumber} {item.issueTitle}
                    </a>
                    <Link to="/reviews" className="mt-1">
                      <Button size="xs" variant="outline" className="w-full text-[10px] gap-1">
                        Review Diffs <ChevronRight className="size-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Work */}
          <div className="rounded-xl border border-white/5 bg-card/20 p-5 space-y-4">
            <div className="flex items-center gap-1.5 border-b border-white/5 pb-2.5">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                Shipped / Done ({completed.length})
              </h3>
            </div>

            {completed.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic py-2">
                No features completed yet.
              </p>
            ) : (
              <div className="space-y-3">
                {completed.map((item) => (
                  <div
                    key={item.taskId}
                    className="flex flex-col gap-2 rounded-lg border border-white/5 bg-card/60 p-3 shadow-sm hover:border-emerald-500/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/repo/${item.repo.owner}/${item.repo.name}`}
                        className="font-mono text-[10px] text-muted-foreground truncate hover:text-brand"
                      >
                        {item.repo.owner}/{item.repo.name}
                      </Link>
                      <span className="rounded px-1.5 py-0.2 font-mono text-[8px] uppercase tracking-wider border bg-emerald-950/20 text-emerald-400 border-emerald-950/40">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 font-medium">
                      #{item.issueNumber} {item.issueTitle}
                    </p>
                    <Link to="/pulls" className="mt-1">
                      <Button size="xs" variant="ghost" className="w-full text-[10px] gap-1 hover:bg-emerald-500/10 hover:text-emerald-400">
                        View Pull Request <ExternalLink className="size-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
