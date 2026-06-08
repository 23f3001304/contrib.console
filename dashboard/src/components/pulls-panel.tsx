import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ExternalLink, GitPullRequestArrow, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyNote } from "@/components/empty-note"
import {
  useOpenPullRequest,
  usePullComments,
  usePulls,
  useRepos,
  useReviews,
  useSendCommentToWorker,
} from "@/lib/bus/hooks"
import type { ApprovedRepo, PullRequest } from "@/lib/bus/types"

export function PullsPanel() {
  const repos = useRepos()
  const list = repos.data ?? []
  const [selected, setSelected] = useState("")
  const repo = list.find((r) => `${r.owner}/${r.name}` === selected) ?? list[0]

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          pull requests
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Pull requests
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          You open the PR and write the description. The worker only pushes the
          branch (forking if needed) and opens it as you. Read the discussion and
          hand any comment to the worker to address.
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyNote>Approve a repo first in My repos.</EmptyNote>
      ) : (
        <>
          <div className="max-w-xs">
            <Label className="font-mono text-xs text-muted-foreground">
              repository
            </Label>
            <Select
              value={repo ? `${repo.owner}/${repo.name}` : ""}
              onValueChange={setSelected}
            >
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select a repo" />
              </SelectTrigger>
              <SelectContent>
                {list.map((r) => (
                  <SelectItem
                    key={`${r.owner}/${r.name}`}
                    value={`${r.owner}/${r.name}`}
                  >
                    {r.owner}/{r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {repo && <OpenPrForm repo={repo} />}
          {repo && <OpenPrList repo={repo} />}
        </>
      )}
    </div>
  )
}

function OpenPrForm({ repo }: { repo: ApprovedRepo }) {
  const reviews = useReviews()
  const open = useOpenPullRequest()
  const latest = (reviews.data ?? []).find((r) =>
    r.issueRef.startsWith(`${repo.owner}/${repo.name}#`),
  )
  const [branch, setBranch] = useState("")
  const [base, setBase] = useState("")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  useEffect(() => {
    if (latest?.branch) setBranch((b) => b || latest.branch)
  }, [latest])

  function submit() {
    if (!branch.trim() || !title.trim()) {
      toast.error("Branch and title are required")
      return
    }
    open.mutate(
      { owner: repo.owner, name: repo.name, branch, base, title, body },
      {
        onSuccess: () =>
          toast.success("Queued. The worker will push and open it as you."),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Open a pull request</CardTitle>
        <CardDescription>
          The branch must already have the worker's approved commits. Pushing and
          opening happen as you, through the worker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs text-muted-foreground">
              branch
            </Label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feat/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs text-muted-foreground">
              base (blank = default)
            </Label>
            <Input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="main"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground">title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs text-muted-foreground">
            description
          </Label>
          <MarkdownEditor
            value={body}
            onChange={setBody}
            rows={8}
            placeholder="What this PR does, and why. Markdown supported."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={open.isPending}>
            <GitPullRequestArrow className="size-4" /> Open PR
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OpenPrList({ repo }: { repo: ApprovedRepo }) {
  const prs = usePulls(repo.owner, repo.name)
  const data = prs.data ?? []
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        <GitPullRequestArrow className="size-3.5" /> your open prs ({data.length})
      </h2>
      {prs.isLoading ? (
        <EmptyNote>Loading...</EmptyNote>
      ) : data.length === 0 ? (
        <EmptyNote>No open PRs you authored in this repo yet.</EmptyNote>
      ) : (
        <div className="space-y-4">
          {data.map((pr) => (
            <PrCard key={pr.number} repo={repo} pr={pr} />
          ))}
        </div>
      )}
    </section>
  )
}

function PrCard({ repo, pr }: { repo: ApprovedRepo; pr: PullRequest }) {
  const comments = usePullComments(repo.owner, repo.name, pr.number)
  const send = useSendCommentToWorker()
  const list = comments.data ?? []

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="font-mono text-sm font-medium">#{pr.number}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{pr.title}</span>
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-brand hover:underline"
        >
          <ExternalLink className="size-3" /> github
        </a>
      </div>
      <div className="space-y-3 px-4 py-3">
        {pr.body && (
          <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {pr.body}
          </p>
        )}
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          comments ({list.length})
        </p>
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          <div className="space-y-2">
            {list.map((comment) => (
              <div key={comment.id} className="rounded-md border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground">
                    {comment.author}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-[11px]"
                    disabled={send.isPending}
                    onClick={() =>
                      send.mutate(
                        {
                          owner: repo.owner,
                          name: repo.name,
                          number: pr.number,
                          comment: comment.body,
                          author: comment.author,
                        },
                        {
                          onSuccess: () =>
                            toast.success("Sent to the worker to address"),
                          onError: (err) => toast.error(err.message),
                        },
                      )
                    }
                  >
                    <Send className="size-3" /> send to worker
                  </Button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
