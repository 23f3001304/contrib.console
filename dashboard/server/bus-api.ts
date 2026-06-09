import path from "node:path"
import type { Plugin } from "vite"
import { GitHubClient, GitHubError } from "./github"
import {
  createMemoize,
  createPipeline,
  sendJson,
  type RouteContext,
} from "./pipeline"
import { handleDiscoveryRoutes } from "./discovery-routes"
import { handleWorkRoutes } from "./work-routes"
import { handleReviewRoutes } from "./review-routes"
import { handlePrRoutes } from "./pr-routes"

export interface BusApiOptions {
  githubToken?: string
}

// Vite dev-server plugin exposing the pipeline/ file bus and the GitHub proxy
// over /api. Helpers live in pipeline.ts; handlers live in the *-routes files.
// The browser app never touches disk or holds the token directly.
export function busApi(options: BusApiOptions = {}): Plugin {
  return {
    name: "pipeline-bus-api",
    configureServer(server) {
      const pipelineRoot = path.resolve(server.config.root, "..", "pipeline")
      const reposRoot = path.resolve(server.config.root, "..", "repos")
      const pipeline = createPipeline(pipelineRoot)
      const memoize = createMemoize()
      const github = options.githubToken
        ? new GitHubClient(options.githubToken)
        : null

      server.middlewares.use("/api", async (req, res) => {
        const parsed = new URL(req.url ?? "/", "http://localhost")
        const ctx: RouteContext = {
          route: parsed.pathname,
          method: req.method ?? "GET",
          query: parsed.searchParams,
          req,
          res,
          pipeline,
          github,
          memoize,
          pipelineRoot,
          reposRoot,
          githubToken: options.githubToken ?? null,
        }
        try {
          if (await handleDiscoveryRoutes(ctx)) return
          if (await handleWorkRoutes(ctx)) return
          if (await handleReviewRoutes(ctx)) return
          if (await handlePrRoutes(ctx)) return
          sendJson(res, 404, {
            error: "not found",
            method: ctx.method,
            route: ctx.route,
          })
        } catch (err) {
          const status = err instanceof GitHubError ? err.status : 500
          sendJson(res, status, { error: (err as Error).message })
        }
      })
    },
  }
}
