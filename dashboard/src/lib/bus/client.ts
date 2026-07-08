import type {
  ApprovedRepo,
  CommitReview,
  IssueFilters,
  MessageEntry,
  MapRequest,
  Preferences,
  QueueItem,
  RepoDetail,
  RateLimit,
  RepoIssues,
  RepoLabel,
  RepoMap,
  RepoRef,
  RepoSuggestion,
  ReviewResponse,
  WorkerSchedule,
  PullComment,
  PullRequest,
} from "./types"

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    let message = `${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      message = await res.text()
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export function getPreferences(): Promise<Preferences> {
  return request<Preferences>("/api/preferences")
}

export function putPreferences(preferences: Preferences): Promise<Preferences> {
  return request<Preferences>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  })
}

export function getSchedule(): Promise<WorkerSchedule> {
  return request<WorkerSchedule>("/api/schedule")
}

export function putSchedule(schedule: WorkerSchedule): Promise<WorkerSchedule> {
  return request<WorkerSchedule>("/api/schedule", {
    method: "PUT",
    body: JSON.stringify(schedule),
  })
}

export function runScheduleNow(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/schedule/run-now", { method: "POST" })
}

export function getPulls(owner: string, repo: string): Promise<PullRequest[]> {
  const params = new URLSearchParams({ owner, repo })
  return request<PullRequest[]>(`/api/prs?${params.toString()}`)
}

export function getPullComments(
  owner: string,
  repo: string,
  number: number,
): Promise<PullComment[]> {
  const params = new URLSearchParams({ owner, repo, number: String(number) })
  return request<PullComment[]>(`/api/pr-comments?${params.toString()}`)
}

export interface OpenPrInput {
  owner: string
  name: string
  branch: string
  base: string
  title: string
  body: string
}

export function openPullRequest(input: OpenPrInput): Promise<{ status: string }> {
  return request<{ status: string }>("/api/pr/open", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export interface PrToWorkerInput {
  owner: string
  name: string
  number: number
  comment: string
  author: string
}

export function sendCommentToWorker(
  input: PrToWorkerInput,
): Promise<{ status: string }> {
  return request<{ status: string }>("/api/pr/to-worker", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function getRepoSuggestions(
  page = 1,
  refresh = false,
): Promise<RepoSuggestion[]> {
  const params = new URLSearchParams({ page: String(page) })
  if (refresh) params.set("refresh", "1")
  return request<RepoSuggestion[]>(`/api/repo-suggestions?${params.toString()}`)
}

export function searchRepos(q: string): Promise<RepoSuggestion[]> {
  const params = new URLSearchParams({ q })
  return request<RepoSuggestion[]>(`/api/repos/search?${params.toString()}`)
}

export function getRepoDetail(owner: string, repo: string): Promise<RepoDetail> {
  const params = new URLSearchParams({ owner, repo })
  return request<RepoDetail>(`/api/repo?${params.toString()}`)
}

export interface ClonedInfo {
  cloned: boolean
  path: string
}

export function getRepoCloned(owner: string, repo: string): Promise<ClonedInfo> {
  const params = new URLSearchParams({ owner, repo })
  return request<ClonedInfo>(`/api/repo-cloned?${params.toString()}`)
}

export function getRepos(): Promise<ApprovedRepo[]> {
  return request<ApprovedRepo[]>("/api/repos")
}

export function putRepos(repos: ApprovedRepo[]): Promise<ApprovedRepo[]> {
  return request<ApprovedRepo[]>("/api/repos", {
    method: "PUT",
    body: JSON.stringify(repos),
  })
}

export interface AddRepoInput {
  owner?: string
  name?: string
  url?: string
}

export function addRepo(input: AddRepoInput): Promise<ApprovedRepo[]> {
  return request<ApprovedRepo[]>("/api/repos/add", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function getIssues(
  owner: string,
  repo: string,
  filters: IssueFilters,
): Promise<RepoIssues> {
  const params = new URLSearchParams({ owner, repo, sort: filters.sort })
  if (filters.labels.length > 0) params.set("labels", filters.labels.join(","))
  if (filters.unassigned) params.set("unassigned", "1")
  if (filters.noOpenPr) params.set("noOpenPr", "1")
  return request<RepoIssues>(`/api/issues?${params.toString()}`)
}

export function getLabels(owner: string, repo: string): Promise<RepoLabel[]> {
  const params = new URLSearchParams({ owner, repo })
  return request<RepoLabel[]>(`/api/labels?${params.toString()}`)
}

export function getRateLimit(): Promise<RateLimit> {
  return request<RateLimit>("/api/rate-limit")
}

export interface WorkerStatus {
  state: string
  active: boolean
  lastBeat: string | null
  currentTask: string | null
  activeClients: number
  error: string | null
}

export function getWorkerStatus(): Promise<WorkerStatus> {
  return request<WorkerStatus>("/api/worker-status")
}

export function getReviews(): Promise<CommitReview[]> {
  return request<CommitReview[]>("/api/reviews")
}

export interface RespondInput {
  taskId: string
  reviewIndex: number
  decision: "approve" | "changes"
  comments: string
}

export function respondReview(input: RespondInput): Promise<ReviewResponse> {
  return request<ReviewResponse>("/api/reviews/respond", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function getMessages(): Promise<MessageEntry[]> {
  return request<MessageEntry[]>("/api/messages")
}

export interface EnqueueInput {
  repo: RepoRef
  issueNumber: number
  issueTitle: string
  issueUrl: string
}

export function getQueue(): Promise<QueueItem[]> {
  return request<QueueItem[]>("/api/queue")
}

export function postQueue(input: EnqueueInput): Promise<QueueItem> {
  return request<QueueItem>("/api/queue", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function removeQueue(taskId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/queue/remove", {
    method: "POST",
    body: JSON.stringify({ taskId }),
  })
}

export function updateQueueStatus(taskId: string, status: string): Promise<QueueItem> {
  return request<QueueItem>("/api/queue/update-status", {
    method: "POST",
    body: JSON.stringify({ taskId, status }),
  })
}

export function reorderQueue(taskIds: string[]): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/queue/reorder", {
    method: "POST",
    body: JSON.stringify({ taskIds }),
  })
}

export interface RepoMapState {
  map: RepoMap | null
  request: MapRequest | null
}

export function getRepoMap(owner: string, repo: string): Promise<RepoMapState> {
  const params = new URLSearchParams({ owner, repo })
  return request<RepoMapState>(`/api/repo-map?${params.toString()}`)
}

export function requestRepoMap(input: {
  owner: string
  name: string
  url?: string
}): Promise<MapRequest> {
  return request<MapRequest>("/api/repo-map/request", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export interface UsageStats {
  sessionUsedPercent: number
  weeklyUsedPercent: number
  weeklyResets: string
  last24hRequests: number
  last24hSessions: number
  last7dRequests: number
  last7dSessions: number
  models?: Record<string, number>
  lastUpdated: string
}

export interface UsageHistoryEntry {
  timestamp: string
  last24hRequests: number
  last7dRequests: number
  sessionUsedPercent: number
  weeklyUsedPercent: number
}

export interface WorkerSessionUsage {
  inputTokens: number
  outputTokens: number
  cost: number
  lastUpdated: string
}

export function getUsageStats(): Promise<UsageStats | null> {
  return request<UsageStats | null>("/api/usage-stats")
}

export function getUsageHistory(): Promise<UsageHistoryEntry[]> {
  return request<UsageHistoryEntry[]>("/api/usage-history")
}

export function getWorkerSessionUsage(): Promise<WorkerSessionUsage> {
  return request<WorkerSessionUsage>("/api/worker-session-usage")
}
