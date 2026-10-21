import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * 歌词
 * 负责调用 API、读取和保存本地 JSON 缓存。
 */
export interface LyricWord {
  text: string
  startMs: number
  durationMs: number
}

export interface LyricLine {
  text: string
  startMs: number
  durationMs: number
  words: LyricWord[]
}

interface LyricsApiResponse {
  data?: {
    provider: string
    track: {
      title: string
      artist: string
      duration: number
    }
    plainLyrics: string
    syncedLyrics: LyricLine[] | null
    instrumental: boolean
  }
  error?: {
    code?: string
    message?: string
  }
}

function getCacheDirectory() {
  if (process.platform === 'win32') {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      'music.tui',
      'Cache',
    )
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'music.tui')
  }

  return join(
    process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'),
    'music.tui',
  )
}

const CACHE_DIR = getCacheDirectory()

function getCachePath(title: string, artist: string) {
  const key = `${title.trim().toLowerCase()}\0${artist.trim().toLowerCase()}`
  const hash = createHash('sha256').update(key).digest('hex')

  return resolve(CACHE_DIR, `${hash}.json`)
}

export async function fetchLyrics(
  title: string,
  artist: string,
  signal?: AbortSignal,
): Promise<LyricLine[]> {
  const cachePath = getCachePath(title, artist)

  // 优先读取本地缓存
  try {
    const content = await readFile(cachePath, 'utf8')
    const cached: LyricLine[] = JSON.parse(content)

    if (Array.isArray(cached)) {
      return cached
    }
  } catch {
    // 缓存不存在或损坏，继续请求 API
  }

  const query = new URLSearchParams({ title })

  if (artist) {
    query.set('artist', artist)
  }
  // TODO 后续新增配置页
  query.set('provider', 'qq')

  const response = await fetch(
    `https://api.lyriva.xyz/lyriva/lyrics?${query}`,
    {
      headers: {
        Accept: 'application/json',
      },
      signal,
    },
  )

  const body = (await response.json()) as LyricsApiResponse

  if (!response.ok) {
    throw new Error(
      body.error?.message ??
      body.error?.code ??
      `HTTP ${response.status}`,
    )
  }

  const lines = body.data?.syncedLyrics

  if (!Array.isArray(lines) || lines.length === 0) {
    return []
  }

  // 验证基本结构并按时间排序
  const validLines = lines
    .filter(
      (line) =>
        typeof line.text === 'string' &&
        Number.isFinite(line.startMs) &&
        Number.isFinite(line.durationMs),
    )
    .sort((a, b) => a.startMs - b.startMs)

  // 缓存失败不应影响歌词显示
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(
      cachePath,
      JSON.stringify(validLines),
      'utf8',
    )
  } catch {
    // 忽略缓存写入错误
  }

  return validLines
}
