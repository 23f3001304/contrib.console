import { useState } from "react"
import { toast } from "sonner"
import { Check, ChevronRight, ExternalLink, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRepoCloned, useRespondReview } from "@/lib/bus/hooks"
import type { CommitReview, ReviewFileChange } from "@/lib/bus/types"

function parseRepo(issueRef: string): [string, string] {
  const [slug] = issueRef.split("#")
  const [owner, repo] = (slug ?? "").split("/")
  return [owner ?? "", repo ?? ""]
}

// The diff is the source of truth for which files changed and by how much; the
// worker's files array only contributes the per-file summary, matched by path.
function filesFromDiff(diff: string): ReviewFileChange[] {
  const out: ReviewFileChange[] = []
  let current: ReviewFileChange | null = null
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/ b\/(.+)$/)
      current = { path: match ? match[1] : "", additions: 0, deletions: 0 }
      out.push(current)
    } else if (line.startsWith("+++ b/") && current) {
      current.path = line.slice(6)
    } else if (current) {
      if (line.startsWith("+") && !line.startsWith("+++")) current.additions++
      else if (line.startsWith("-") && !line.startsWith("---")) current.deletions++
    }
  }
  return out.filter((f) => f.path && f.path !== "/dev/null")
}

export function ReviewCard({ review }: { review: CommitReview }) {
  const respond = useRespondReview()
  const [comments, setComments] = useState("")
  const [open, setOpen] = useState(review.status === "pending")
  const pending = review.status === "pending"
  const [owner, repo] = parseRepo(review.issueRef)
  const cloned = useRepoCloned(owner, repo)
  const repoPath = cloned.data?.cloned ? cloned.data.path : null

  const summaryByPath = new Map(
    (review.files ?? []).map((f) => [f.path, f.summary]),
  )
  const parsed = filesFromDiff(review.diff)
  const files = (parsed.length ? parsed : (review.files ?? [])).map((f) => ({
    ...f,
    summary: f.summary ?? summaryByPath.get(f.path),
  }))

  function submit(decision: "approve" | "changes") {
    if (decision === "changes" && !comments.trim()) {
      toast.error("Add a note so the worker knows what to change")
      return
    }
    respond.mutate(
      { taskId: review.taskId, reviewIndex: review.index, decision, comments },
      {
        onSuccess: () =>
          toast.success(
            decision === "approve" ? "Approved" : "Changes requested",
          ),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="-ml-1 flex items-center gap-1.5"
        >
          <ChevronRight
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="font-mono text-sm font-medium">
            {review.issueRef}
          </span>
        </button>
        {review.isFinal && (
          <Badge variant="outline" className="font-mono text-[10px]">
            final
          </Badge>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">
          {review.branch} · {review.sha ? review.sha.slice(0, 7) : ""} ·{" "}
          {files.length} files · {review.linesChanged} lines
        </span>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px]",
            review.status === "approved"
              ? "text-emerald-400"
              : review.status === "changes-requested"
                ? "text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {review.status}
        </span>
      </div>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="line-clamp-1 block w-full px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted/30"
        >
          {review.explanation}
        </button>
      )}

      {open && (
        <div className="space-y-3 px-4 py-3">
          <p className="text-sm text-muted-foreground">{review.explanation}</p>

          {files.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  files changed ({files.length})
                </p>
                {repoPath && (
                  <a
                    href={`vscode://file/${repoPath}`}
                    className="flex items-center gap-1 font-mono text-[11px] text-brand hover:underline"
                  >
                    <ExternalLink className="size-3" /> open repo in vs code
                  </a>
                )}
              </div>
              <div className="divide-y rounded-md border">
                {files.map((file) => (
                  <div key={file.path} className="space-y-1 p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-all font-mono text-xs">
                        {file.path}
                      </span>
                      <span className="font-mono text-[11px]">
                        <span className="text-emerald-400">
                          +{file.additions}
                        </span>{" "}
                        <span className="text-red-400">-{file.deletions}</span>
                      </span>
                      {repoPath && (
                        <a
                          href={`vscode://file/${repoPath}/${file.path}`}
                          className="ml-auto flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3" /> open
                        </a>
                      )}
                    </div>
                    {file.summary && (
                      <p className="text-xs text-muted-foreground">
                        {file.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Diff diff={review.diff} />

          {review.feedback && review.status === "changes-requested" && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber-400">
                changes you requested
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {review.feedback}
              </p>
            </div>
          )}

          {pending && (
            <div className="space-y-2">
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Optional note (required to request changes)"
                className="min-h-16 font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => submit("changes")}
                >
                  <XCircle className="size-4" /> Request changes
                </Button>
                <Button
                  disabled={respond.isPending}
                  onClick={() => submit("approve")}
                >
                  <Check className="size-4" /> Approve
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Diff({ diff }: { diff: string }) {
  if (!diff) return null
  return (
    <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed">
      {diff.split("\n").map((line, index) => {
        let cls = "text-muted-foreground"
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-emerald-400"
        else if (line.startsWith("-") && !line.startsWith("---"))
          cls = "text-red-400"
        else if (line.startsWith("@@")) cls = "text-brand"
        else if (
          line.startsWith("diff ") ||
          line.startsWith("index ") ||
          line.startsWith("+++") ||
          line.startsWith("---")
        )
          cls = "text-muted-foreground/60"
        return (
          <div key={index} className={cls}>
            {line || " "}
          </div>
        )
      })}
    </pre>
  )
}
