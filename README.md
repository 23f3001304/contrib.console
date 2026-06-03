# Control Lib

Local-first control panel for steering an AI through real open source
contributions. It finds repos, makes one small commit at a time, and stops at
each for your review. Your token and the worker never leave your machine.

## What it does

You set target languages and Control Lib suggests repos with good first issues.
Approve the ones worth your time, queue an issue, and the worker makes one small
commit toward it. Every commit lands in a review inbox with its diff and a
per-file note. You approve or request changes, and the worker resumes on its
own. When the work is done you write the PR description and the dashboard opens
it as you.

## Why it runs locally

- Your GitHub token lives in `dashboard/.env.local`, read only by the dev
  server. It never reaches the browser or any third party.
- The worker is Claude Code running in a terminal on your machine. The dashboard
  talks to it through plain JSON files in `pipeline/`, not a remote queue.
- Commits stay local. The worker is blocked from any network git call, so
  nothing leaves until you approve a diff and open the PR yourself.

## The loop

1. **Discover** - pick languages, get repo suggestions, approve repos.
2. **Pick** - queue an issue, filtered by label, unassigned, and no linked PR.
3. **Map** - the worker clones the repo, maps it, and makes one small commit.
4. **Review** - read the diff and per-file notes, then approve or request changes.
5. **Ship** - write the PR description; the dashboard pushes and opens it as you.

## Constraints

| Rule | Value |
| --- | --- |
| Commit size | 50 changed lines and 2 files, at most |
| Review | every commit, before the next one |
| Push and PR | manual, opened by you, as you |
| Author | your git identity, no co-author |
| Worker | Claude Code in an embedded terminal |

## Setup

```bash
git clone https://github.com/23f3001304/Control-Lib.git
cd Control-Lib/dashboard
npm install
echo "GITHUB_TOKEN=ghp_your_token" > .env.local
npm run dev
```

Open `localhost:5173`, go to the Terminal tab, and run `claude`. Set a schedule
in Settings if you want it to start itself.

## Layout

- `dashboard/` - the Vite and React app, plus dev-server plugins for the file
  bus, the GitHub proxy, the embedded terminal, and the worker host.
- `pipeline/` - the JSON file bus between the app and the worker, created at
  runtime and not tracked.
- `repos/` - clones of the repos you contribute to, not tracked.
- `WORKER.md` - the runbook the worker follows.
- `docs/` - the landing page.

## License

MIT. See [LICENSE](LICENSE).
