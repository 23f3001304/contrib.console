import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyNote } from "@/components/empty-note"
import { useApproveRepos, useRepos } from "@/lib/bus/hooks"
import type { ApprovedRepo } from "@/lib/bus/types"

export function ReposPanel() {
  const repos = useRepos()
  const approve = useApproveRepos()
  const list = repos.data ?? []

  function unapprove(repo: ApprovedRepo) {
    approve.mutate(
      list.filter((r) => !(r.owner === repo.owner && r.name === repo.name)),
      {
        onSuccess: () => toast.success(`Removed ${repo.owner}/${repo.name}`),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          my repos
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Repos you approved
        </h1>
      </div>

      {list.length === 0 ? (
        <EmptyNote>No approved repos yet. Approve some on Discover.</EmptyNote>
      ) : (
        <div className="space-y-px overflow-hidden rounded-lg border">
          {list.map((repo) => (
            <div
              key={`${repo.owner}/${repo.name}`}
              className="group flex items-center gap-3 bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <Link
                to={`/repo/${repo.owner}/${repo.name}`}
                className="flex min-w-0 flex-1 items-center gap-2 truncate font-mono text-sm font-medium hover:underline"
              >
                {repo.owner}/{repo.name}
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                approved {repo.approvedAt.slice(0, 10)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                disabled={approve.isPending}
                onClick={() => unapprove(repo)}
                title="Unapprove"
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
