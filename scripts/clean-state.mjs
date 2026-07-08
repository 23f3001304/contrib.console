import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")

async function cleanDir(dirPath, keepDir = true) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true })
      } else {
        await fs.unlink(fullPath)
      }
    }
    if (!keepDir) {
      await fs.rmdir(dirPath)
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`Error cleaning directory ${dirPath}:`, err.message)
    }
  }
}

async function main() {
  console.log("Cleaning workspace state to start from zero...")

  // 1. Clean cloned repositories in repos/
  const reposDir = path.join(root, "repos")
  await cleanDir(reposDir, true)
  console.log("- Cleaned repos/ folder")

  // 2. Clean pipeline subdirectories
  const pipelineDirs = [
    "queue",
    "issues",
    "map-requests",
    "repo-map",
    "repo-profile",
    "reviews",
    "responses",
    "pr-feedback",
  ]
  for (const dir of pipelineDirs) {
    await cleanDir(path.join(root, "pipeline", dir), true)
  }
  console.log("- Cleaned pipeline data directories")

  // 3. Clear pipeline files
  const pipelineFilesToEmptyArray = ["messages.json", "repos.json", "repo-suggestions.json"]
  for (const file of pipelineFilesToEmptyArray) {
    try {
      await fs.writeFile(path.join(root, "pipeline", file), "[]", "utf8")
    } catch (err) {
      if (err.code !== "ENOENT") console.error(`Error writing ${file}:`, err.message)
    }
  }

  const filesToDelete = [
    "schedule-trigger.json",
    "resume-trigger.json",
    "worker-status.json",
    "schedule-state.json",
  ]
  for (const file of filesToDelete) {
    try {
      await fs.unlink(path.join(root, "pipeline", file))
    } catch {
      // ignore
    }
  }
  console.log("- Reset pipeline state files")

  console.log("State cleaned successfully! Ready to start fresh.")
}

main().catch((err) => console.error("Clean failed:", err))
