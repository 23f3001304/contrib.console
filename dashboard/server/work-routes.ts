import type {
  MapRequest,
  QueueItem,
  RepoIssues,
  RepoMap,
  RepoRef,
  WorkerSchedule,
} from "../src/lib/bus/types"
import { DEFAULT_SCHEDULE } from "../src/lib/bus/defaults"
import { readBody, requireGitHub, sendJson, type RouteContext } from "./pipeline"

function normalizeSchedule(input: unknown): WorkerSchedule {
  const body = (input ?? {}) as Partial<WorkerSchedule>
  const times = Array.isArray(body.times)
    ? body.times.map(String).filter((t) => /^\d{2}:\d{2}$/.test(t))
    : []
  return {
    enabled: Boolean(body.enabled),
    times,
    intervalMinutes:
      typeof body.intervalMinutes === "number" && body.intervalMinutes > 0
        ? Math.floor(body.intervalMinutes)
        : 0,
    prompt:
      typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt
        : DEFAULT_SCHEDULE.prompt,
    bypassPermissions: body.bypassPermissions !== false,
  }
}

// Issue search, the queue, repo-map requests, and the worker schedule.
export async function handleWorkRoutes(ctx: RouteContext): Promise<boolean> {
  const { route, method, query, req, res, pipeline, github, memoize } = ctx

  if (route === "/schedule" && method === "GET") {
    sendJson(res, 200, await pipeline.readJson("schedule.json", DEFAULT_SCHEDULE))
    return true
  }
  if (route === "/schedule" && method === "PUT") {
    const next = normalizeSchedule(await readBody(req))
    await pipeline.writeJson("schedule.json", next)
    sendJson(res, 200, next)
    return true
  }
  if (route === "/schedule/run-now" && method === "POST") {
    await pipeline.writeJson("schedule-trigger.json", {
      requestedAt: new Date().toISOString(),
    })
    sendJson(res, 200, { ok: true })
    return true
  }

  if (route === "/issues" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    if (!owner || !name) {
      sendJson(res, 400, { error: "owner and repo are required" })
      return true
    }
    const labels = (query.get("labels") ?? "")
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean)
    const sortParam = query.get("sort")
    const sort =
      sortParam === "created" || sortParam === "comments" ? sortParam : "updated"
    const unassigned = query.get("unassigned") === "1"
    const noOpenPr = query.get("noOpenPr") === "1"
    const issues = await memoize(
      `issues:${owner}/${name}:${labels.join(",")}:${unassigned}:${noOpenPr}:${sort}`,
      90_000,
      () => gh.rankIssues(owner, name, { labels, unassigned, noOpenPr, sort }),
    )
    const payload: RepoIssues = {
      repo: { owner, name, url: `https://github.com/${owner}/${name}` },
      fetchedAt: new Date().toISOString(),
      issues,
    }
    await pipeline.writeJson(`issues/${owner}__${name}.json`, payload)
    sendJson(res, 200, payload)
    return true
  }

  if (route === "/queue" && method === "GET") {
    const items = await pipeline.listJson<QueueItem>("queue")
    items.sort((a, b) => (a.selectedAt < b.selectedAt ? 1 : -1))
    sendJson(res, 200, items)
    return true
  }
  if (route === "/queue" && method === "POST") {
    const body = (await readBody(req)) as {
      repo?: RepoRef
      issueNumber?: number
      issueTitle?: string
      issueUrl?: string
    }
    if (!body.repo?.owner || !body.repo?.name || !body.issueNumber) {
      sendJson(res, 400, { error: "repo and issueNumber are required" })
      return true
    }
    const taskId = `${body.repo.owner}__${body.repo.name}__${body.issueNumber}`
    const item: QueueItem = {
      taskId,
      repo: body.repo,
      issueNumber: body.issueNumber,
      issueTitle: body.issueTitle ?? "",
      issueUrl: body.issueUrl ?? "",
      selectedAt: new Date().toISOString(),
      status: "selected",
    }
    await pipeline.writeJson(`queue/${taskId}.json`, item)
    sendJson(res, 200, item)
    return true
  }
  if (route === "/queue/remove" && method === "POST") {
    const body = (await readBody(req)) as { taskId?: string }
    if (!body.taskId) {
      sendJson(res, 400, { error: "taskId is required" })
      return true
    }
    await pipeline.remove(`queue/${body.taskId}.json`)
    sendJson(res, 200, { ok: true })
    return true
  }

  if (route === "/repo-map" && method === "GET") {
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    if (!owner || !name) {
      sendJson(res, 400, { error: "owner and repo are required" })
      return true
    }
    const map = await pipeline.readJson<RepoMap | null>(
      `repo-map/${owner}__${name}.json`,
      null,
    )
    const request = await pipeline.readJson<MapRequest | null>(
      `map-requests/${owner}__${name}.json`,
      null,
    )
    sendJson(res, 200, { map, request })
    return true
  }
  if (route === "/repo-map/request" && method === "POST") {
    const body = (await readBody(req)) as {
      owner?: string
      name?: string
      url?: string
    }
    if (!body.owner || !body.name) {
      sendJson(res, 400, { error: "owner and name are required" })
      return true
    }
    const mapRequest: MapRequest = {
      repo: {
        owner: body.owner,
        name: body.name,
        url: body.url ?? `https://github.com/${body.owner}/${body.name}`,
      },
      requestedAt: new Date().toISOString(),
      status: "requested",
    }
    await pipeline.writeJson(
      `map-requests/${body.owner}__${body.name}.json`,
      mapRequest,
    )
    sendJson(res, 200, mapRequest)
    return true
  }
  if (route === "/repo-map/requests" && method === "GET") {
    sendJson(res, 200, await pipeline.listJson<MapRequest>("map-requests"))
    return true
  }

  return false
}
