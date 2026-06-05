import { useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyNote } from "@/components/empty-note"
import { IssuesPicker } from "@/components/issues-picker"
import { useRepos } from "@/lib/bus/hooks"

export function IssuesRoute() {
  const repos = useRepos()
  const [selected, setSelected] = useState("")
  const approved = repos.data ?? []
  const [owner, name] = selected ? selected.split("/") : [undefined, undefined]

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          pick issue
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Pick an issue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose an approved repo, filter its issues, and queue the ones to work
          on.
        </p>
      </div>

      {approved.length === 0 ? (
        <EmptyNote>Approve a repo on Discover first.</EmptyNote>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Label className="font-mono text-xs text-muted-foreground">repo</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-72 font-mono text-sm">
                <SelectValue placeholder="Select an approved repo" />
              </SelectTrigger>
              <SelectContent>
                {approved.map((repo) => (
                  <SelectItem
                    key={`${repo.owner}/${repo.name}`}
                    value={`${repo.owner}/${repo.name}`}
                    className="font-mono"
                  >
                    {repo.owner}/{repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {owner && name && <IssuesPicker owner={owner} name={name} />}
        </>
      )}
    </div>
  )
}
