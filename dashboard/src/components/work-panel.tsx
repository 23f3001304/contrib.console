import { Link } from "react-router-dom"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyNote } from "@/components/empty-note"
import { useDequeue, useQueue } from "@/lib/bus/hooks"

export function WorkPanel() {
  const queue = useQueue()
  const dequeue = useDequeue()
  const queued = queue.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          work
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Queued issues
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Issues you approved for the worker. Pick more from the{" "}
          <Link to="/issues" className="text-brand hover:underline">
            Pick issue
          </Link>{" "}
          page.
        </p>
      </div>

      {queued.length === 0 ? (
        <EmptyNote>Nothing queued yet.</EmptyNote>
      ) : (
        <div className="space-y-px overflow-hidden rounded-lg border">
          {queued.map((item) => (
            <div
              key={item.taskId}
              className="flex items-center gap-3 bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <Link
                to={`/repo/${item.repo.owner}/${item.repo.name}`}
                className="shrink-0 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              >
                {item.repo.owner}/{item.repo.name}
              </Link>
              <a
                href={item.issueUrl}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                <span className="font-mono text-muted-foreground">
                  #{item.issueNumber}
                </span>{" "}
                {item.issueTitle}
              </a>
              <span className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {item.status}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={dequeue.isPending}
                onClick={() =>
                  dequeue.mutate(item.taskId, {
                    onSuccess: () => toast.success("Dequeued"),
                    onError: (err) => toast.error(err.message),
                  })
                }
                title="Dequeue"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
