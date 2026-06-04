import type {
  IssueFilters,
  PullComment,
  PullRequest,
  RankedIssue,
  RateLimit,
  RepoDetail,
  RepoLabel,
  RepoSuggestion,
} from "../src/lib/bus/types"
import {
  repoReason,
  toRankedIssue,
  type IssueCommentItem,
  type RepoItem,
  type SearchIssuesItem,
  type SearchPullItem,
  type SearchReposItem,
  type UserResponse,
} from "./github-helpers"

const API = "https://api.github.com"

export interface SuggestOptions {
  languages: string[]
  topics: string[]
  minStars: number
  sort: "stars" | "updated"
  page: number
}

export class GitHubError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export class GitHubClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.token}`,
      accept: "application/vnd.github+json",
      "user-agent": "contrib-console",
      "x-github-api-version": "2022-11-28",
    }
  }

  private async get<T>(
    apiPath: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(apiPath, API)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }
    const res = await fetch(url, { headers: this.headers() })
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 403 || res.status === 429) {
        const secondary = /secondary rate limit/i.test(text)
        const exhausted = res.headers.get("x-ratelimit-remaining") === "0"
        if (secondary || exhausted) {
          const retry = res.headers.get("retry-after")
          throw new GitHubError(
            `GitHub rate limit reached. ${retry ? `Try again in ${retry}s.` : "Wait a minute and retry."}`,
            429,
          )
        }
      }
      throw new GitHubError(`GitHub API ${res.status}: ${text}`, res.status)
    }
    return (await res.json()) as T
  }

  async getMe(): Promise<string> {
    const me = await this.get<UserResponse>("/user", {})
    return me.login
  }

  // The user's own open PRs in a repo (works whether the PR is from a fork).
  async listUserPulls(
    owner: string,
    name: string,
    login: string,
  ): Promise<PullRequest[]> {
    const q = `repo:${owner}/${name} type:pr state:open author:${login}`
    const data = await this.get<{ items: SearchPullItem[] }>("/search/issues", {
      q,
      sort: "updated",
      order: "desc",
      per_page: 30,
    })
    return data.items.map((item) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
      state: item.state,
      author: item.user?.login ?? "",
      body: item.body ?? "",
      comments: item.comments,
      createdAt: item.created_at,
    }))
  }

  async listPullComments(
    owner: string,
    name: string,
    number: number,
  ): Promise<PullComment[]> {
    const data = await this.get<IssueCommentItem[]>(
      `/repos/${owner}/${name}/issues/${number}/comments`,
      { per_page: 50 },
    )
    return data.map((comment) => ({
      id: comment.id,
      author: comment.user?.login ?? "",
      body: comment.body,
      url: comment.html_url,
      createdAt: comment.created_at,
    }))
  }

  // Suggest repos for the given languages, topics, and minimum stars. Merged
  // and deduped across languages, all with good first issues available.
  async suggestRepos(opts: SuggestOptions): Promise<RepoSuggestion[]> {
    const seen = new Map<string, RepoSuggestion>()
    const topicQuery = opts.topics.map((topic) => `topic:${topic}`).join(" ")
    for (const language of opts.languages) {
      const q = [
        `language:${language}`,
        topicQuery,
        `stars:>${opts.minStars}`,
        "good-first-issues:>1",
        "archived:false",
      ]
        .filter(Boolean)
        .join(" ")
      const data = await this.get<{ items: SearchReposItem[] }>(
        "/search/repositories",
        { q, sort: opts.sort, order: "desc", per_page: 15, page: opts.page },
      )
      for (const item of data.items) {
        if (seen.has(item.full_name)) continue
        seen.set(item.full_name, {
          owner: item.owner.login,
          name: item.name,
          url: item.html_url,
          description: item.description ?? "",
          language: item.language ?? language,
          stars: item.stargazers_count,
          openIssues: item.open_issues_count,
          reason: repoReason(item),
        })
      }
    }
    return [...seen.values()].sort((a, b) => b.stars - a.stars)
  }

  // Rank open issues for a repo using caller-supplied filters.
  async rankIssues(
    owner: string,
    name: string,
    filters: IssueFilters,
  ): Promise<RankedIssue[]> {
    const parts = [`repo:${owner}/${name}`, "is:issue", "is:open"]
    if (filters.noOpenPr) parts.push("-linked:pr")
    if (filters.unassigned) parts.push("no:assignee")
    if (filters.labels.length > 0) {
      const labelQuery = filters.labels.map((label) => `"${label}"`).join(",")
      parts.push(`label:${labelQuery}`)
    }
    const data = await this.get<{ items: SearchIssuesItem[] }>(
      "/search/issues",
      { q: parts.join(" "), sort: filters.sort, order: "desc", per_page: 30 },
    )
    return data.items
      .filter((item) => !item.pull_request)
      .map(toRankedIssue)
      .sort((a, b) => b.score - a.score)
  }

  // Lightweight repo lookup, used to validate a manual add.
  async getRepo(owner: string, name: string): Promise<RepoItem> {
    return this.get<RepoItem>(`/repos/${owner}/${name}`, {})
  }

  async getRateLimit(): Promise<RateLimit> {
    const data = await this.get<{
      resources: {
        core: { limit: number; remaining: number }
        search: { limit: number; remaining: number }
      }
    }>("/rate_limit", {})
    return { core: data.resources.core, search: data.resources.search }
  }

  // The repo's actual labels, so the issue filter offers real options.
  async getLabels(owner: string, name: string): Promise<RepoLabel[]> {
    const data = await this.get<
      Array<{ name: string; color: string; description: string | null }>
    >(`/repos/${owner}/${name}/labels`, { per_page: 100 })
    return data.map((label) => ({
      name: label.name,
      color: label.color,
      description: label.description ?? "",
    }))
  }

  // Full detail for the repo inner page: stats, README excerpt, issue preview.
  async getRepoDetail(owner: string, name: string): Promise<RepoDetail> {
    const repo = await this.get<RepoItem>(`/repos/${owner}/${name}`, {})
    const readme = await this.getReadme(owner, name)
    return {
      owner,
      name,
      url: repo.html_url,
      description: repo.description ?? "",
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      openIssues: repo.open_issues_count,
      topics: repo.topics ?? [],
      license: repo.license?.spdx_id ?? null,
      homepage: repo.homepage || null,
      defaultBranch: repo.default_branch,
      pushedAt: repo.pushed_at,
      readme,
      goodFirstIssues: [],
    }
  }

  private async getReadme(owner: string, name: string): Promise<string> {
    const res = await fetch(`${API}/repos/${owner}/${name}/readme`, {
      headers: { ...this.headers(), accept: "application/vnd.github.raw" },
    })
    if (!res.ok) return ""
    return (await res.text()).slice(0, 6000)
  }
}

