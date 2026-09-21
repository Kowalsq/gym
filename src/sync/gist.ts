/** Cliente mínimo da API de Gists do GitHub. O Gist é privado e tem um arquivo, ferro.json. */

const API = 'https://api.github.com'
export const GIST_FILE = 'ferro.json'
export const GIST_DESCRIPTION = 'Ferro · sincronização do registro de treino'

export class GistError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = ((await res.json()) as { message?: string }).message ?? ''
    } catch {
      /* sem corpo */
    }
    throw new GistError(detail || `HTTP ${res.status}`, res.status)
  }
  return (await res.json()) as T
}

interface GistFile {
  filename: string
  content?: string
  truncated?: boolean
  raw_url: string
}
interface Gist {
  id: string
  description: string | null
  files: Record<string, GistFile>
  updated_at: string
}

export async function whoAmI(token: string): Promise<string> {
  const u = await request<{ login: string }>(token, '/user')
  return u.login
}

/** Procura o Gist de sincronização do usuário. */
export async function findGist(token: string): Promise<string | null> {
  const list = await request<Gist[]>(token, '/gists?per_page=100')
  const g = list.find((x) => x.files[GIST_FILE] && (x.description ?? '').startsWith('Ferro'))
  return g?.id ?? null
}

export async function createGist(token: string, content: string): Promise<string> {
  const g = await request<Gist>(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({ description: GIST_DESCRIPTION, public: false, files: { [GIST_FILE]: { content } } }),
  })
  return g.id
}

export async function readGist(token: string, id: string): Promise<{ content: string; updatedAt: string }> {
  const g = await request<Gist>(token, `/gists/${id}`)
  const f = g.files[GIST_FILE]
  if (!f) throw new GistError('O Gist não tem o arquivo ferro.json.', 404)
  if (f.truncated || f.content === undefined) {
    const res = await fetch(f.raw_url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new GistError(`Falha ao baixar o arquivo (HTTP ${res.status}).`, res.status)
    return { content: await res.text(), updatedAt: g.updated_at }
  }
  return { content: f.content, updatedAt: g.updated_at }
}

export async function writeGist(token: string, id: string, content: string): Promise<void> {
  await request<Gist>(token, `/gists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content } } }),
  })
}
