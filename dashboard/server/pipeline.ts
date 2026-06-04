import path from "node:path"
import { promises as fs } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { GitHubClient } from "./github"

// Path-safe JSON access to the pipeline/ directory. Every read and write of the
// file bus goes through here so the browser app never touches disk directly.
export interface Pipeline {
  resolveInPipeline(relPath: string): string
  readJson<T>(relPath: string, fallback: T): Promise<T>
  writeJson(relPath: string, data: unknown): Promise<void>
  listJson<T>(dirRel: string): Promise<T[]>
  remove(relPath: string): Promise<void>
}

export function createPipeline(root: string): Pipeline {
  function resolveInPipeline(relPath: string): string {
    const full = path.resolve(root, relPath)
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error("path escapes the pipeline root")
    }
    return full
  }

  return {
    resolveInPipeline,
    async readJson<T>(relPath: string, fallback: T): Promise<T> {
      try {
        return JSON.parse(
          await fs.readFile(resolveInPipeline(relPath), "utf8"),
        ) as T
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback
        throw err
      }
    },
    async writeJson(relPath: string, data: unknown): Promise<void> {
      const full = resolveInPipeline(relPath)
      await fs.mkdir(path.dirname(full), { recursive: true })
      await fs.writeFile(full, JSON.stringify(data, null, 2) + "\n", "utf8")
    },
    async listJson<T>(dirRel: string): Promise<T[]> {
      const dir = resolveInPipeline(dirRel)
      let names: string[]
      try {
        names = await fs.readdir(dir)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
        throw err
      }
      const items: T[] = []
      for (const fileName of names) {
        if (!fileName.endsWith(".json")) continue
        items.push(
          JSON.parse(await fs.readFile(path.join(dir, fileName), "utf8")) as T,
        )
      }
      return items
    },
    async remove(relPath: string): Promise<void> {
      try {
        await fs.unlink(resolveInPipeline(relPath))
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
      }
    },
  }
}

export type Memoize = <T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
) => Promise<T>

// Short-lived in-memory cache so navigating and toggling filters does not burst
// the GitHub search API into a secondary rate limit.
export function createMemoize(): Memoize {
  const memo = new Map<string, { at: number; data: unknown }>()
  return async function memoize<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const hit = memo.get(key)
    if (hit && Date.now() - hit.at < ttlMs) return hit.data as T
    const data = await fn()
    memo.set(key, { at: Date.now(), data })
    return data
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown,
): void {
  res.statusCode = status
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify(data))
}

export function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ""
    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString()
    })
    req.on("end", () => {
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", reject)
  })
}

export interface RouteContext {
  route: string
  method: string
  query: URLSearchParams
  req: IncomingMessage
  res: ServerResponse
  pipeline: Pipeline
  github: GitHubClient | null
  memoize: Memoize
  pipelineRoot: string
  reposRoot: string
  githubToken: string | null
}

export function requireGitHub(
  res: ServerResponse,
  github: GitHubClient | null,
): GitHubClient | null {
  if (!github) {
    sendJson(res, 401, {
      error:
        "GITHUB_TOKEN is not set. Add it to dashboard/.env.local and the dev server will restart.",
    })
    return null
  }
  return github
}
