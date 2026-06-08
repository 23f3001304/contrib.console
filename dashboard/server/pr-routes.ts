import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import {
  createPull,
  findOpenPull,
  forkRepo,
  getRepoMeta,
  repoExists,
} from "./github-write"
import { readBody, requireGitHub, sendJson, type RouteContext } from "./pipeline"

const execFileAsync = promisify(execFile)
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function pushBranch(
  repoDir: string,
  headOwner: string,
  name: string,
  branch: string,
  token: string,
): Promise<void> {
  const url = `https://${token}@github.com/${headOwner}/${name}.git`
  await execFileAsync("git", ["-C", repoDir, "push", url, `${branch}:${branch}`], {
    timeout: 120_000,
  })
}

// Pull requests. Reads (your open PRs and their comments) and the write that
// pushes the branch and opens the PR all run here, as you. The worker stays
// local-only. Sending a comment to the worker just asks it for a local commit.
export async function handlePrRoutes(ctx: RouteContext): Promise<boolean> {
  const { route, method, query, req, res, pipeline, github, memoize } = ctx

  if (route === "/prs" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    if (!owner || !name) {
      sendJson(res, 400, { error: "owner and repo are required" })
      return true
    }
    const login = await memoize("me", 3_600_000, () => gh.getMe())
    sendJson(
      res,
      200,
      await memoize(`prs:${owner}/${name}`, 30_000, () =>
        gh.listUserPulls(owner, name, login),
      ),
    )
    return true
  }

  if (route === "/pr-comments" && method === "GET") {
    const gh = requireGitHub(res, github)
    if (!gh) return true
    const owner = query.get("owner") ?? ""
    const name = query.get("repo") ?? ""
    const number = Number(query.get("number") ?? "0")
    if (!owner || !name || !number) {
      sendJson(res, 400, { error: "owner, repo, and number are required" })
      return true
    }
    sendJson(
      res,
      200,
      await memoize(`pr-comments:${owner}/${name}/${number}`, 20_000, () =>
        gh.listPullComments(owner, name, number),
      ),
    )
    return true
  }

  if (route === "/pr/open" && method === "POST") {
    const token = ctx.githubToken
    if (!token) {
      sendJson(res, 401, { error: "GITHUB_TOKEN is not set." })
      return true
    }
    const body = (await readBody(req)) as {
      owner?: string
      name?: string
      branch?: string
      base?: string
      title?: string
      body?: string
    }
    if (!body.owner || !body.name || !body.branch || !body.title) {
      sendJson(res, 400, {
        error: "owner, name, branch, and title are required",
      })
      return true
    }
    const repoDir = path.join(ctx.reposRoot, `${body.owner}__${body.name}`)
    try {
      await fs.access(repoDir)
    } catch {
      sendJson(res, 400, {
        error: "That repo is not cloned locally yet. Start the worker on it first.",
      })
      return true
    }
    try {
      const meta = await getRepoMeta(token, body.owner, body.name)
      const base = body.base?.trim() || meta.defaultBranch
      let headOwner = body.owner
      if (!meta.canPush) {
        headOwner = await forkRepo(token, body.owner, body.name)
        for (
          let i = 0;
          i < 15 && !(await repoExists(token, headOwner, body.name));
          i++
        ) {
          await delay(1500)
        }
      }
      await pushBranch(repoDir, headOwner, body.name, body.branch, token)
      const head = meta.canPush ? body.branch : `${headOwner}:${body.branch}`
      const existing = await findOpenPull(token, body.owner, body.name, head)
      const pr =
        existing ??
        (await createPull(token, body.owner, body.name, {
          title: body.title,
          body: body.body ?? "",
          head,
          base,
        }))
      sendJson(res, 200, { ...pr, updated: Boolean(existing) })
    } catch (err) {
      const message = (err as Error).message.split(token).join("***")
      sendJson(res, 500, { error: message })
    }
    return true
  }

  if (route === "/pr/to-worker" && method === "POST") {
    const body = (await readBody(req)) as {
      owner?: string
      name?: string
      number?: number
      comment?: string
      author?: string
    }
    if (!body.owner || !body.name || !body.number) {
      sendJson(res, 400, { error: "owner, name, and number are required" })
      return true
    }
    const task = {
      repo: { owner: body.owner, name: body.name },
      prNumber: body.number,
      comment: body.comment ?? "",
      author: body.author ?? "",
      requestedAt: new Date().toISOString(),
      status: "requested",
    }
    await pipeline.writeJson(
      `pr-feedback/${body.owner}__${body.name}__${body.number}.json`,
      task,
    )
    sendJson(res, 200, task)
    return true
  }

  return false
}
