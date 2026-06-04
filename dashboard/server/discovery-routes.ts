import path from "node:path"
import { promises as fs } from "node:fs"
import { DEFAULT_PREFERENCES } from "../src/lib/bus/defaults"
import type {
  ApprovedRepo,
  Preferences,
  RepoSort,
  RepoSuggestion,
} from "../src/lib/bus/types"
import { readBody, requireGitHub, sendJson, type RouteContext } from "./pipeline"

function normalizePreferences(input: unknown): Preferences {
  const body = (input ?? {}) as Partial<Preferences>
  const sort: RepoSort = body.sort === "updated" ? "updated" : "stars"
  return {
    languages: Array.isArray(body.languages) ? body.languages.map(String) : [],
    topics: Array.isArray(body.topics) ? body.topics.map(String) : [],
    minStars:
      typeof body.minStars === "number" && body.minStars >= 0
        ? Math.floor(body.minStars)
        : 0,
    sort,
    git: {
      name: body.git?.name ? String(body.git.name) : "",
      email: body.git?.email ? String(body.git.email) : "",
    },
  }
}

// Health, GitHub status, preferences, repo discovery, and the approved-repo list.
export async function handleDiscoveryRoutes(ctx: RouteContext): Promise<boolean> {
  const { route, method, query, req, res, pipeline, github, memoize } = ctx

  if (route === "/health" && method === "GET") {
    sendJson(res, 200, {
      ok: true,
      pipelineRoot: ctx.pipelineRoot,
      github: Boolean(github),
    })
    return true
  }
  if (route === "/rate-limit" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    sendJson(res, 200, await memoize("rate-limit", 20_000, () => gh.getRateLimit()))
    return true
  }

  if (route === "/preferences" && method === "GET") {
    sendJson(
      res,
      200,
      await pipeline.readJson<Preferences>("preferences.json", DEFAULT_PREFERENCES),
    )
    return true
  }
  if (route === "/preferences" && method === "PUT") {
    const next = normalizePreferences(await readBody(req))
    await pipeline.writeJson("preferences.json", next)
    sendJson(res, 200, next)
    return true
  }

  if (route === "/repo-suggestions" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const prefs = await pipeline.readJson<Preferences>(
      "preferences.json",
      DEFAULT_PREFERENCES,
    )
    if (prefs.languages.length === 0) {
      sendJson(res, 200, [])
      return true
    }
    const page = Math.max(1, Number(query.get("page") ?? "1"))
    if (page === 1 && query.get("refresh") !== "1") {
      const cached = await pipeline.readJson<RepoSuggestion[] | null>(
        "repo-suggestions.json",
        null,
      )
      if (cached) {
        sendJson(res, 200, cached)
        return true
      }
    }
    const suggestions = await gh.suggestRepos({
      languages: prefs.languages,
      topics: prefs.topics,
      minStars: prefs.minStars,
      sort: prefs.sort,
      page,
    })
    if (page === 1) await pipeline.writeJson("repo-suggestions.json", suggestions)
    sendJson(res, 200, suggestions)
    return true
  }

  if (route === "/repo" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    if (!owner || !name) {
      sendJson(res, 400, { error: "owner and repo are required" })
      return true
    }
    sendJson(
      res,
      200,
      await memoize(`detail:${owner}/${name}`, 300_000, () =>
        gh.getRepoDetail(owner, name),
      ),
    )
    return true
  }
  if (route === "/labels" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    if (!owner || !name) {
      sendJson(res, 400, { error: "owner and repo are required" })
      return true
    }
    sendJson(
      res,
      200,
      await memoize(`labels:${owner}/${name}`, 1_800_000, () =>
        gh.getLabels(owner, name),
      ),
    )
    return true
  }
  if (route === "/repo-cloned" && method === "GET") {
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    if (!owner || !name) {
      sendJson(res, 400, { error: "owner and repo are required" })
      return true
    }
    const dir = path.join(ctx.reposRoot, `${owner}__${name}`)
    let cloned = false
    try {
      await fs.access(dir)
      cloned = true
    } catch {
      cloned = false
    }
    sendJson(res, 200, { cloned, path: dir.replace(/\\/g, "/") })
    return true
  }

  if (route === "/repos" && method === "GET") {
    sendJson(res, 200, await pipeline.readJson<ApprovedRepo[]>("repos.json", []))
    return true
  }
  if (route === "/repos" && method === "PUT") {
    const body = await readBody(req)
    const repos = Array.isArray(body) ? (body as ApprovedRepo[]) : []
    await pipeline.writeJson("repos.json", repos)
    sendJson(res, 200, repos)
    return true
  }
  if (route === "/repos/add" && method === "POST") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const body = (await readBody(req)) as {
      owner?: string
      name?: string
      url?: string
    }
    let owner = body.owner
    let name = body.name
    if ((!owner || !name) && body.url) {
      const match = body.url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i)
      if (match) {
        owner = match[1]
        name = match[2].replace(/\.git$/, "")
      }
    }
    if (!owner || !name) {
      sendJson(res, 400, {
        error: "owner and name (or a GitHub url) are required",
      })
      return true
    }
    const repo = await gh.getRepo(owner, name)
    const current = await pipeline.readJson<ApprovedRepo[]>("repos.json", [])
    if (!current.some((r) => r.owner === owner && r.name === name)) {
      current.push({
        owner,
        name,
        url: repo.html_url,
        approvedAt: new Date().toISOString(),
      })
      await pipeline.writeJson("repos.json", current)
    }
    sendJson(res, 200, current)
    return true
  }

  return false
}
