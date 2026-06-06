import { GitCommitHorizontal, MessageSquare } from "lucide-react"
import { EmptyNote } from "@/components/empty-note"
import { ReviewCard } from "@/components/review-card"
import { useMessages, useReviews } from "@/lib/bus/hooks"

export function ReviewsPanel() {
  const reviews = useReviews()
  const messages = useMessages()
  const list = reviews.data ?? []
  const pending = list.filter((review) => review.status === "pending")
  const msgs = messages.data ?? []

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          reviews
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Commit reviews
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Each commit the worker makes lands here with its diff, the files it
          touched, and a per-file explanation. Approve it or request changes.
          Nothing is pushed until you approve the final commit.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <GitCommitHorizontal className="size-3.5" /> commits ({pending.length}{" "}
          pending)
        </h2>
        {list.length === 0 ? (
          <EmptyNote>
            No commits yet. Run the worker in the Terminal; its commits appear
            here for you to approve.
          </EmptyNote>
        ) : (
          <div className="space-y-4">
            {list.map((review) => (
              <ReviewCard
                key={`${review.taskId}-${review.index}`}
                review={review}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <MessageSquare className="size-3.5" /> agent messages
        </h2>
        {msgs.length === 0 ? (
          <EmptyNote>No messages yet.</EmptyNote>
        ) : (
          <div className="space-y-px overflow-hidden rounded-lg border">
            {msgs
              .slice()
              .reverse()
              .map((message, index) => (
                <div
                  key={index}
                  className="flex gap-3 bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {message.at ? message.at.slice(11, 16) : ""}
                  </span>
                  <span className="min-w-0 flex-1">{message.text}</span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  )
}
