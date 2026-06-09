import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { MessageSquare, Play, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyNote } from "@/components/empty-note"
import { useEnqueue, useIssues, useLabels, useQueue } from "@/lib/bus/hooks"
import type { IssueFilters, IssueSort, RankedIssue, RepoRef } from "@/lib/bus/types"

const DEFAULT_FILTERS: IssueFilters = {
  labels: [],
  unassigned: true,
  noOpenPr: false,
  sort: "updated",
}

export function IssuesPicker({ owner, name }: { owner: string; name: string }) {
  const queue = useQueue()
  const enqueue = useEnqueue()
  const labelsQuery = useLabels(owner, name)

  const [draft, setDraft] = useState<IssueFilters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<IssueFilters>(DEFAULT_FILTERS)
  const issues = useIssues(owner, name, applied)

  const repoLabels = labelsQuery.data ?? []
  const issueList = issues.data?.issues ?? []
  const queuedNumbers = new Set(
    (queue.data ?? [])
      .filter((item) => item.repo.owner === owner && item.repo.name === name)
      .map((item) => item.issueNumber),
  )

  function toggleLabel(label: string) {
    setDraft((filters) => ({
      ...filters,
      labels: filters.labels.includes(label)
        ? filters.labels.filter((current) => current !== label)
        : [...filters.labels, label],
    }))
  }

  function pick(issue: RankedIssue) {
    const repo: RepoRef = {
      owner,
      name,
      url: `https://github.com/${owner}/${name}`,
    }
    enqueue.mutate(
      {
        repo,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueUrl: issue.url,
      },
      {
        onSuccess: () => toast.success(`Queued #${issue.number} for the worker`),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground">
            labels{" "}
            {labelsQuery.isLoading
              ? "(loading...)"
              : `(${repoLabels.length} in repo, none means all)`}
          </Label>
          {repoLabels.length > 0 && (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {repoLabels.map((label) => {
                const active = draft.labels.includes(label.name)
                return (
                  <button
                    key={label.name}
                    type="button"
                    onClick={() => toggleLabel(label.name)}
                    title={label.description}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                      active
                        ? "border-transparent bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    {label.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            active={draft.unassigned}
            onClick={() =>
              setDraft((filters) => ({ ...filters, unassigned: !filters.unassigned }))
            }
          >
            unassigned only
          </Toggle>
          <Toggle
            active={draft.noOpenPr}
            title="Uses the GitHub search API, limited to 30 requests per minute"
            onClick={() =>
              setDraft((filters) => ({ ...filters, noOpenPr: !filters.noOpenPr }))
            }
          >
            no open PR
          </Toggle>
          <Select
            value={draft.sort}
            onValueChange={(value) =>
              setDraft((filters) => ({ ...filters, sort: value as IssueSort }))
            }
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">recently updated</SelectItem>
              <SelectItem value="created">newest</SelectItem>
              <SelectItem value="comments">most discussed</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="ml-auto"
            onClick={() => setApplied(draft)}
            disabled={issues.isFetching}
          >
            <Search className="size-4" />
            {issues.isFetching ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {issues.isLoading && <EmptyNote>Loading issues...</EmptyNote>}
      {issues.isError && <EmptyNote>{(issues.error as Error).message}</EmptyNote>}
      {!issues.isLoading && !issues.isError && issueList.length === 0 && (
        <EmptyNote>No issues match these filters. Loosen them and Search.</EmptyNote>
      )}

      {issueList.length > 0 && (
        <div className="space-y-px overflow-hidden rounded-lg border">
          {issueList.map((issue) => {
            const queued = queuedNumbers.has(issue.number)
            return (
              <div
                key={issue.number}
                className="flex items-start gap-4 bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <span className="tnum mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
                  #{issue.number}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium leading-snug hover:underline"
                  >
                    {issue.title}
                  </a>
                  <div className="tnum mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                    {issue.labels.slice(0, 4).map((label) => (
                      <span key={label} className="rounded border px-1.5 py-0.5">
                        {label}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {issue.comments}
                    </span>
                    <span>{issue.reason}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={queued ? "secondary" : "default"}
                  disabled={queued || enqueue.isPending}
                  onClick={() => pick(issue)}
                >
                  <Play className="size-4" />
                  {queued ? "Queued" : "Work on this"}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Toggle({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
        active
          ? "border-transparent bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
