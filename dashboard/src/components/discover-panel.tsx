import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Plus, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyNote } from "@/components/empty-note"
import { ChipField } from "@/components/chip-field"
import { LanguageField } from "@/components/language-field"
import { SuggestionCard } from "@/components/suggestion-card"
import { getRepoSuggestions } from "@/lib/bus/client"
import {
  useAddRepo,
  usePreferences,
  useRepos,
  useUpdatePreferences,
} from "@/lib/bus/hooks"
import type { RepoSort, RepoSuggestion } from "@/lib/bus/types"

export function DiscoverPanel() {
  const navigate = useNavigate()
  const prefs = usePreferences()
  const updatePrefs = useUpdatePreferences()
  const repos = useRepos()
  const add = useAddRepo()

  const [languages, setLanguages] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [minStars, setMinStars] = useState(50)
  const [sort, setSort] = useState<RepoSort>("stars")
  const [topicDraft, setTopicDraft] = useState("")
  const [seeded, setSeeded] = useState(false)

  const [items, setItems] = useState<RepoSuggestion[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState("")

  const approvedKeys = useMemo(
    () => new Set((repos.data ?? []).map((repo) => `${repo.owner}/${repo.name}`)),
    [repos.data],
  )

  useEffect(() => {
    if (prefs.data && !seeded) {
      setLanguages(prefs.data.languages)
      setTopics(prefs.data.topics)
      setMinStars(prefs.data.minStars)
      setSort(prefs.data.sort)
      setSeeded(true)
    }
  }, [prefs.data, seeded])

  useEffect(() => {
    if (!seeded) return
    void loadFirst(false)
  }, [seeded])

  async function loadFirst(refresh: boolean) {
    setLoading(true)
    setError(null)
    try {
      const data = await getRepoSuggestions(1, refresh)
      setItems(data)
      setPage(1)
    } catch (err) {
      setError((err as Error).message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    if (!prefs.data) return
    setLoading(true)
    setError(null)
    try {
      await updatePrefs.mutateAsync({
        languages,
        topics,
        minStars,
        sort,
        git: prefs.data.git,
      })
      const data = await getRepoSuggestions(1, true)
      setItems(data)
      setPage(1)
      toast.success(`Refreshed: ${data.length} repos`)
    } catch (err) {
      setError((err as Error).message)
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const next = page + 1
      const data = await getRepoSuggestions(next, true)
      const existing = new Set(items.map((item) => `${item.owner}/${item.name}`))
      const fresh = data.filter(
        (item) => !existing.has(`${item.owner}/${item.name}`),
      )
      setItems([...items, ...fresh])
      setPage(next)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  function approve(suggestion: RepoSuggestion) {
    add.mutate(
      { owner: suggestion.owner, name: suggestion.name },
      {
        onSuccess: () =>
          toast.success(`Approved ${suggestion.owner}/${suggestion.name}`),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function addManual() {
    const value = manual.trim()
    if (!value) return
    let owner: string | undefined
    let name: string | undefined
    if (value.includes("github.com")) {
      const match = value.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i)
      if (match) {
        owner = match[1]
        name = match[2].replace(/\.git$/, "")
      }
    } else if (value.includes("/")) {
      ;[owner, name] = value.split("/")
    }
    if (!owner || !name) {
      toast.error("Enter owner/name or a GitHub url")
      return
    }
    const targetOwner = owner
    const targetName = name
    add.mutate(
      { owner: targetOwner, name: targetName },
      {
        onSuccess: () => {
          setManual("")
          navigate(`/repo/${targetOwner}/${targetName}`)
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const noLanguages = languages.length === 0

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          discover
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Find repos to contribute to
        </h1>
      </div>

      <div className="sticky top-0 z-10 space-y-4 rounded-lg border bg-card/95 p-4 backdrop-blur">
        <LanguageField value={languages} onChange={setLanguages} />
        <ChipField
          label="topics (optional)"
          items={topics}
          draft={topicDraft}
          onDraft={setTopicDraft}
          onAdd={() => {
            const value = topicDraft.trim().toLowerCase()
            if (value && !topics.includes(value)) setTopics([...topics, value])
            setTopicDraft("")
          }}
          onRemove={(value) => setTopics(topics.filter((t) => t !== value))}
          placeholder="cli, react"
        />
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs text-muted-foreground">
              min stars
            </Label>
            <Input
              type="number"
              min={0}
              value={minStars}
              onChange={(e) => setMinStars(Number(e.target.value) || 0)}
              className="tnum h-9 w-28 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs text-muted-foreground">sort</Label>
            <Select value={sort} onValueChange={(value) => setSort(value as RepoSort)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stars">most stars</SelectItem>
                <SelectItem value="updated">recently active</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={refresh}
            disabled={loading || updatePrefs.isPending || noLanguages}
            className="ml-auto"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2 border-t pt-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={manual}
            placeholder="add a repo directly: owner/name or a GitHub url"
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addManual()
              }
            }}
            className="h-9 font-mono text-sm"
          />
          <Button variant="secondary" onClick={addManual} disabled={add.isPending}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      {noLanguages && (
        <EmptyNote>Add at least one language above, then Refresh.</EmptyNote>
      )}
      {!noLanguages && loading && <EmptyNote>Loading suggestions...</EmptyNote>}
      {error && <EmptyNote>{error}</EmptyNote>}
      {!noLanguages && !loading && !error && items.length === 0 && (
        <EmptyNote>No suggestions. Try different filters and Refresh.</EmptyNote>
      )}

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((suggestion) => (
            <SuggestionCard
              key={`${suggestion.owner}/${suggestion.name}`}
              suggestion={suggestion}
              approved={approvedKeys.has(`${suggestion.owner}/${suggestion.name}`)}
              pending={add.isPending}
              onApprove={() => approve(suggestion)}
              onOpen={() =>
                navigate(`/repo/${suggestion.owner}/${suggestion.name}`)
              }
            />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  )
}
