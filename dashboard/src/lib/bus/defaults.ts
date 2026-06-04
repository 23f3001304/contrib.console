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
    "Start a worker run per WORKER.md: take the top approved or queued issue, make one small change (max 50 lines, max 2 files), write a commit review for me, then stop. Do not push.",
  bypassPermissions: true,
}
