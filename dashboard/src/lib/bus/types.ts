// Shared types for the pipeline file bus.
// Both the React app and the scheduled worker rely on these shapes.

export type TaskStatus =
  | "selected"
  | "cloning"
  | "in-progress"
  | "awaiting-review"
  | "changes-requested"
  | "approved"
  | "pushed"
  | "pr-open"

export interface GitIdentity {
  name: string
  email: string
}

export type RepoSort = "stars" | "updated"

export interface Preferences {
  languages: string[] // target tech / coding languages
  topics: string[] // optional topic filters
  minStars: number // minimum stars for suggestions
  sort: RepoSort // suggestion sort order
  git: GitIdentity // identity that commits and PRs are authored as
}

export interface WorkerSchedule {
  enabled: boolean // master switch for auto-runs
  times: string[] // daily "HH:MM" start times
  intervalMinutes: number // also run every N minutes (0 = off)
  prompt: string // what the worker is told when it starts
  bypassPermissions: boolean // launch claude with permission prompts skipped
  agentCommand?: string // command to launch the agent (e.g. "claude", "agy", etc.)
  parallelism?: boolean // enable concurrent/sequential multitasking for queued issues
}

export interface RepoRef {
  owner: string
  name: string
  url: string
}

export interface RepoSuggestion extends RepoRef {
  description: string
  language: string
  stars: number
  openIssues: number
  goodFirstIssues?: number
  reason: string // why it was suggested
}

export interface RepoDetail extends RepoRef {
  description: string
  language: string | null
  stars: number
  forks: number
  openIssues: number
  topics: string[]
  license: string | null
  homepage: string | null
  defaultBranch: string
  pushedAt: string
  readme: string // truncated README text
  goodFirstIssues: RankedIssue[] // preview of available issues
}

export interface ApprovedRepo extends RepoRef {
  approvedAt: string // ISO timestamp
}

export interface RankedIssue {
  number: number
  title: string
  url: string
  labels: string[]
  comments: number
  createdAt: string
  updatedAt: string
  score: number
  reason: string // why it is a good pick
}

export interface RepoIssues {
  repo: RepoRef
  fetchedAt: string
  issues: RankedIssue[]
}

export type IssueSort = "updated" | "created" | "comments"

export interface IssueFilters {
  labels: string[]
  unassigned: boolean
  noOpenPr: boolean
  sort: IssueSort
}

export interface RepoLabel {
  name: string
  color: string
  description: string
}

export interface RateLimit {
  core: { limit: number; remaining: number }
  search: { limit: number; remaining: number }
}

export interface QueueItem {
  taskId: string
  repo: RepoRef
  issueNumber: number
  issueTitle: string
  issueUrl: string
  selectedAt: string
  status: TaskStatus
}

export interface ReviewFileChange {
  path: string
  additions: number
  deletions: number
  summary?: string // what changed in this file and what the key code does
}

export interface CommitReview {
  taskId: string
  index: number // nth commit for this task
  branch: string
  sha: string // local commit sha
  issueRef: string // e.g. owner/repo#123
  explanation: string // plain-English summary of the change
  files: ReviewFileChange[]
  linesChanged: number
  diff: string // unified diff
  isFinal: boolean // last commit needed for the issue
  createdAt: string
  status: "pending" | "approved" | "changes-requested"
  feedback?: string // the note you left when requesting changes
}

export type ReviewDecision = "approve" | "changes"

export interface ReviewResponse {
  taskId: string
  reviewIndex: number
  decision: ReviewDecision
  comments: string
  respondedAt: string
}

export interface PullRequest {
  number: number
  title: string
  url: string
  state: string
  author: string
  body: string
  comments: number
  createdAt: string
}

export interface PullComment {
  id: number
  author: string
  body: string
  url: string
  createdAt: string
}

export interface MessageEntry {
  taskId: string
  at: string
  text: string
}

export interface RepoMapFile {
  path: string
  role: string // what this file does
  language: string // for snippet rendering
  snippet: string // key code excerpt
}

export interface RepoMap {
  repo: RepoRef
  summary: string // what the project does
  stack: string[]
  architecture: string // how it is structured and works
  diagram: string // mermaid source for the map
  importantFiles: RepoMapFile[]
  flow: string // how data and control move
  run: string // how to run it
  test: string // how to test it
  contributionTips: string // where a contributor usually starts
  generatedAt: string
}

export type MapStatus = "requested" | "generating" | "done" | "error"

export interface MapRequest {
  repo: RepoRef
  requestedAt: string
  status: MapStatus
}

export interface RepoProfile {
  repo: RepoRef
  baseBranch: string
  branchNaming: string
  commitConvention: string
  signoff: boolean
  cla: boolean
  prTitleConvention: string
  prTemplate: string
  lintCommands: string[]
  testCommands: string[]
  codeStyle: string
  generatedAt: string
}

export interface BoardState {
  tasks: QueueItem[]
  updatedAt: string
}
