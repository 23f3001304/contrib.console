import path from "node:path"
import { promises as fs } from "node:fs"
import type { CommitReview, ReviewResponse } from "../src/lib/bus/types"
import { readBody, sendJson, type RouteContext } from "./pipeline"

// The review inbox, agent messages, and the worker heartbeat.
export async function handleReviewRoutes(ctx: RouteContext): Promise<boolean> {
  const { route, method, req, res, pipeline } = ctx

  if (route === "/reviews" && method === "GET") {
    const reviewsRoot = pipeline.resolveInPipeline("reviews")
    const out: CommitReview[] = []
    let taskDirs: string[]
    try {
      taskDirs = await fs.readdir(reviewsRoot)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") taskDirs = []
      else throw err
    }
    for (const taskId of taskDirs) {
      const dir = path.join(reviewsRoot, taskId)
      let names: string[]
      try {
        names = await fs.readdir(dir)
      } catch {
        continue
      }
      for (const fileName of names) {
        if (!fileName.endsWith(".json")) continue
        const raw = await fs.readFile(path.join(dir, fileName), "utf8")
        out.push(JSON.parse(raw) as CommitReview)
      }
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    sendJson(res, 200, out)
    return true
  }
  if (route === "/reviews/respond" && method === "POST") {
    const body = (await readBody(req)) as {
      taskId?: string
      reviewIndex?: number
      decision?: string
      comments?: string
    }
    if (
      !body.taskId ||
      typeof body.reviewIndex !== "number" ||
      (body.decision !== "approve" && body.decision !== "changes")
    ) {
      sendJson(res, 400, {
        error: "taskId, reviewIndex, and decision (approve|changes) are required",
      })
      return true
    }
    const response: ReviewResponse = {
      taskId: body.taskId,
      reviewIndex: body.reviewIndex,
      decision: body.decision,
      comments: body.comments ?? "",
      respondedAt: new Date().toISOString(),
    }
    await pipeline.writeJson(
      `responses/${body.taskId}/${body.reviewIndex}.json`,
      response,
    )
    const reviewPath = `reviews/${body.taskId}/${body.reviewIndex}.json`
    const review = await pipeline.readJson<CommitReview | null>(reviewPath, null)
    if (review) {
      review.status =
        body.decision === "approve" ? "approved" : "changes-requested"
      if (body.comments && body.comments.trim()) review.feedback = body.comments
      await pipeline.writeJson(reviewPath, review)
    }
    // Nudge the worker to apply this decision automatically (resume the loop).
    await pipeline.writeJson("resume-trigger.json", {
      taskId: body.taskId,
      decision: body.decision,
      at: new Date().toISOString(),
    })
    sendJson(res, 200, response)
    return true
  }
  if (route === "/messages" && method === "GET") {
    sendJson(res, 200, await pipeline.readJson<unknown[]>("messages.json", []))
    return true
  }
  if (route === "/worker-status" && method === "GET") {
    const status = await pipeline.readJson<{
      state?: string
      lastBeat?: string
      activeClients?: number
      error?: string | null
    } | null>("worker-status.json", null)
    const beatAgeMs = status?.lastBeat
      ? Date.now() - new Date(status.lastBeat).getTime()
      : Infinity
    // The worker host rewrites the heartbeat every 2s, so a beat older than 15s
    // means the host (and therefore the worker) is not running.
    const hostUp = beatAgeMs < 15_000
    const state = !hostUp
      ? "off"
      : status?.state === "running"
        ? "running"
        : "idle"
    sendJson(res, 200, {
      state,
      active: state === "running",
      lastBeat: status?.lastBeat ?? null,
      activeClients: status?.activeClients ?? 0,
      error: status?.error ?? null,
    })
    return true
  }

  if (route === "/usage-stats" && method === "GET") {
    const stats = await pipeline.readJson<any>("usage-stats.json", null)
    sendJson(res, 200, stats)
    return true
  }
  if (route === "/usage-history" && method === "GET") {
    const history = await pipeline.readJson<any[]>("usage-history.json", [])
    sendJson(res, 200, history)
    return true
  }

  if (route === "/worker-session-usage" && method === "GET") {
    const usage = await pipeline.readJson<any>("worker-session-usage.json", {
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      lastUpdated: new Date().toISOString()
    })
    sendJson(res, 200, usage)
    return true
  }

  return false
}
