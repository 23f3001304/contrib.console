const API = "https://api.github.com"

function ghHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "contrib-console",
    "x-github-api-version": "2022-11-28",
    "content-type": "application/json",
  }
}

async function gh<T>(
  token: string,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(new URL(apiPath, API), {
    method,
    headers: ghHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

// Default branch and whether the token can push directly (otherwise we fork).
export async function getRepoMeta(
  token: string,
  owner: string,
  name: string,
): Promise<{ defaultBranch: string; canPush: boolean }> {
  const repo = await gh<{
    default_branch: string
    permissions?: { push: boolean }
  }>(token, "GET", `/repos/${owner}/${name}`)
  return {
    defaultBranch: repo.default_branch,
    canPush: repo.permissions?.push ?? false,
  }
}

export async function forkRepo(
  token: string,
  owner: string,
  name: string,
): Promise<string> {
  const fork = await gh<{ owner: { login: string } }>(
    token,
    "POST",
    `/repos/${owner}/${name}/forks`,
    {},
  )
  return fork.owner.login
}

export async function repoExists(
  token: string,
  owner: string,
  name: string,
): Promise<boolean> {
  try {
    await gh(token, "GET", `/repos/${owner}/${name}`)
    return true
  } catch {
    return false
  }
}

export async function findOpenPull(
  token: string,
  owner: string,
  name: string,
  head: string,
): Promise<{ number: number; url: string } | null> {
  const params = new URLSearchParams({ head, state: "open", per_page: "1" })
  const list = await gh<Array<{ number: number; html_url: string }>>(
    token,
    "GET",
    `/repos/${owner}/${name}/pulls?${params.toString()}`,
  )
  return list[0] ? { number: list[0].number, url: list[0].html_url } : null
}

export async function createPull(
  token: string,
  owner: string,
  name: string,
  input: { title: string; body: string; head: string; base: string },
): Promise<{ number: number; url: string }> {
  const pr = await gh<{ number: number; html_url: string }>(
    token,
    "POST",
    `/repos/${owner}/${name}/pulls`,
    input,
  )
  return { number: pr.number, url: pr.html_url }
}
