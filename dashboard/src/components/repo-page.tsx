import type { ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft,
  Check,
  ExternalLink,
  GitFork,
  Loader2,
  Map as MapIcon,
  Plus,
  Sparkles,
  Star,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyNote } from "@/components/empty-note"
import { Markdown } from "@/components/markdown"
import { MapOverview } from "@/components/map-overview"
import { FilesView } from "@/components/files-view"
import {
  useAddRepo,
  useRepoDetail,
  useRepoMap,
  useRepos,
  useRequestRepoMap,
  useWorkerStatus,
} from "@/lib/bus/hooks"

export function RepoPage() {
  const navigate = useNavigate()
  const params = useParams()
  const owner = params.owner ?? ""
  const name = params.name ?? ""

  const detail = useRepoDetail(owner, name)
  const mapQuery = useRepoMap(owner, name)
  const requestMap = useRequestRepoMap()
  const repos = useRepos()
  const add = useAddRepo()
  const worker = useWorkerStatus()

  const data = detail.data
  const map = mapQuery.data?.map
  const mapPending = Boolean(mapQuery.data?.request) && !map
  const approved = (repos.data ?? []).some(
    (repo) => repo.owner === owner && repo.name === name,
  )

  function approve() {
    add.mutate(
      { owner, name },
      {
        onSuccess: () => toast.success(`Approved ${owner}/${name}`),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const generate = (
    <GenerateMap
      pending={mapPending}
      loading={mapQuery.isLoading}
      requesting={requestMap.isPending}
      workerActive={Boolean(worker.data?.active)}
      onGenerate={() =>
        requestMap.mutate({ owner, name, url: data?.url ?? "" })
      }
    />
  )

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> back
      </button>

      {detail.isLoading && (
        <p className="font-mono text-xs text-muted-foreground">loading repo...</p>
      )}
      {detail.isError && <EmptyNote>{(detail.error as Error).message}</EmptyNote>}

      {data && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 font-mono text-xl font-medium tracking-tight">
                <span className="truncate">
                  {owner}/{name}
                </span>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-4" />
                </a>
              </h1>
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {data.description || "No description."}
              </p>
            </div>
            <Button
              onClick={approve}
              disabled={approved || add.isPending}
              variant={approved ? "secondary" : "default"}
            >
              {approved ? (
                <>
                  <Check className="size-4" /> Approved
                </>
              ) : (
                <>
                  <Plus className="size-4" /> Approve
                </>
              )}
            </Button>
          </div>

          <div className="tnum flex flex-wrap items-center gap-x-5 gap-y-2 border-y py-3 font-mono text-xs text-muted-foreground">
            <Stat icon={<Star className="size-3.5" />}>{formatCount(data.stars)}</Stat>
            <Stat icon={<GitFork className="size-3.5" />}>{formatCount(data.forks)}</Stat>
            <span>
              <span className="text-foreground">{data.openIssues}</span> open
            </span>
            {data.language && <span className="text-foreground">{data.language}</span>}
            {data.license && <span>{data.license}</span>}
            <span>updated {sinceDays(data.pushedAt)}d ago</span>
          </div>

          {data.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.topics.slice(0, 12).map((topic) => (
                <Badge key={topic} variant="outline" className="font-mono text-[11px]">
                  {topic}
                </Badge>
              ))}
            </div>
          )}

          <Tabs defaultValue="map">
            <TabsList>
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="files">
                Files{map ? ` (${map.importantFiles.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="readme">README</TabsTrigger>
            </TabsList>
            <TabsContent value="map" className="mt-4">
              {map ? <MapOverview map={map} /> : generate}
            </TabsContent>
            <TabsContent value="files" className="mt-4">
              {map ? (
                <FilesView owner={owner} name={name} files={map.importantFiles} />
              ) : (
                generate
              )}
            </TabsContent>
            <TabsContent value="readme" className="mt-4">
              {data.readme ? (
                <div className="max-h-[32rem] overflow-y-auto rounded-lg border bg-card p-5">
                  <Markdown>{data.readme}</Markdown>
                </div>
              ) : (
                <EmptyNote>No README.</EmptyNote>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

function GenerateMap({
  pending,
  loading,
  requesting,
  workerActive,
  onGenerate,
}: {
  pending: boolean
  loading: boolean
  requesting: boolean
  workerActive: boolean
  onGenerate: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <MapIcon className="mx-auto size-5 text-muted-foreground" />
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
        {loading
          ? "Loading..."
          : pending
            ? workerActive
              ? "The worker is generating this now."
              : "Map requested. Start the worker in the Terminal (run claude, then ask it to run the worker) to generate it."
            : "No map yet. Generate an in-depth explanation of how this repo works, file by file."}
      </p>
      <Button
        className="mt-4"
        disabled={pending || requesting || loading}
        onClick={onGenerate}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Generating
          </>
        ) : (
          <>
            <Sparkles className="size-4" /> Generate repo map
          </>
        )}
      </Button>
    </div>
  )
}

function Stat({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-foreground">
      {icon}
      {children}
    </span>
  )
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function sinceDays(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
}
