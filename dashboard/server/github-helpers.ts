import type { RankedIssue } from "../src/lib/bus/types"

// GitHub REST/Search response shapes the client narrows against, plus the pure
// scoring and formatting helpers. Kept out of github.ts so the client file
// stays focused on requests.

export interface SearchReposItem {
  full_name: string
  owner: { login: string }
  name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  open_issues_count: number
  pushed_at: string
}

export interface RepoItem {
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  topics?: string[]
  license: { spdx_id: string | null } | null
  homepage: string | null
  default_branch: string
  pushed_at: string
}

export interface SearchIssuesItem {
  number: number
  title: string
  html_url: string
  labels: Array<{ name: string } | string>
  comments: number
  created_at: string
  updated_at: string
  pull_request?: unknown
  reactions?: { total_count: number }
}

export interface UserResponse {
  login: string
}

export interface SearchPullItem {
  number: number
  title: string
  html_url: string
  body: string | null
  user: { login: string } | null
  comments: number
  created_at: string
  state: string
}

export interface IssueCommentItem {
  id: number
  user: { login: string } | null
  body: string
  html_url: string
  created_at: string
}

export function repoReason(item: SearchReposItem): string {
  const days = Math.round(
    (Date.now() - new Date(item.pushed_at).getTime()) / 86_400_000,
  )
  const freshness = days <= 14 ? "active this week" : `last push ${days}d ago`
  const lang = item.language ?? "code"
  return `${lang}, ${formatCount(item.stargazers_count)} stars, ${freshness}, has good first issues`
}

export function toRankedIssue(item: SearchIssuesItem): RankedIssue {
  const labels = item.labels.map((label) =>
    typeof label === "string" ? label : label.name,
  )
  const ageDays = Math.round(
    (Date.now() - new Date(item.updated_at).getTime()) / 86_400_000,
  )
  const recency = Math.max(0, 60 - ageDays)
  const discussion = item.comments <= 5 ? 20 : Math.max(0, 20 - item.comments)
  const reactions = Math.min(item.reactions?.total_count ?? 0, 10)
  const score = recency + discussion + reactions
  return {
    number: item.number,
    title: item.title,
    url: item.html_url,
    labels,
    comments: item.comments,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    score,
    reason: `${item.comments} comments, updated ${ageDays}d ago, no open PR`,
  }
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
