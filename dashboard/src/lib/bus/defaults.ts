import type { Preferences, WorkerSchedule } from "./types"

export const DEFAULT_PREFERENCES: Preferences = {
  languages: [],
  topics: [],
  minStars: 50,
  sort: "stars",
  git: { name: "", email: "" },
}

export const DEFAULT_SCHEDULE: WorkerSchedule = {
  enabled: false,
  times: [],
  intervalMinutes: 0,
  prompt:
    "Start a worker run per WORKER.md: take the top approved or queued issue, make one small change (max 50 lines, max 2 files), write a commit review for me, then stop. Do not push. You are granted full permission to read/write/modify any file within the scoped directory by default. If you need any tool, pull and install it directly within the scoped directory (e.g., .tools/) and invoke its binary directly by path; do not run global installs or modify the system PATH.",
  bypassPermissions: true,
  agentCommand: "agy",
  parallelism: false,
}
