import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getCacheDirectory } from './cacheDirectory'

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

export type LyricsContentKind = 'lyrics' | 'credits' | 'instrumental' | 'none'

export type LyricsResult = {
  lines: LyricLine[]
  contentKind: LyricsContentKind
}

interface LyricsApiLine {
  text?: unknown
  startMs?: unknown
  durationMs?: unknown
  words?: unknown
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
    syncedLyrics: LyricsApiLine[] | null
    instrumental: boolean
  }
  error?: {
    code?: string
    message?: string
  }
}

const CACHE_DIR = getCacheDirectory()
const LYRICS_API_URL = 'https://api.lyriva.xyz/lyriva/lyrics'
const CACHE_VERSION = 2

type CachedLyrics = LyricsResult & { version: typeof CACHE_VERSION }

const CREDIT_PREFIX = /^(?:作词|作曲|编曲|制作(?:人)?|监制|演唱|和声|吉他|贝斯|鼓|键盘|录音|混音(?:师)?|母带(?:制作)?|出品|词曲|Composer|Arranger|Producer|Guitar|Bass|Drums|Mixing|Mastering|Vocal|Lyrics|Music)/i

/**
 * mpv 在部分没有标签的文件上会把已编码的文件名作为媒体标题返回。
 * 仅解码有效的百分号转义，避免 URLSearchParams 再次编码其中的 `%`。
 */
function decodeSearchText(value: string): string {
  if (!/%[\dA-Fa-f]{2}/.test(value)) return value

  try {
    return decodeURIComponent(value)
  } catch {
    // 转义不完整或非法时保留原文，保证歌词请求仍可进行。
    return value
  }
}

export type LyricsRequestDetails = {
  url: string
  method: 'GET'
  headers: {
    Accept: 'application/json'
  }
  parameters: Array<{
    name: 'title' | 'artist' | 'provider'
    value: string
  }>
}

/**
 * 构造歌词接口请求，并供设置页展示实际会使用的完整请求参数。
 */
export function createLyricsRequest(
  title: string,
  artist: string,
): LyricsRequestDetails {
  const normalizedTitle = decodeSearchText(title)
  const normalizedArtist = decodeSearchText(artist)
  const query = new URLSearchParams({ title: normalizedTitle })
  const parameters: LyricsRequestDetails['parameters'] = [
    { name: 'title', value: normalizedTitle },
  ]

  if (normalizedArtist) {
    query.set('artist', normalizedArtist)
    parameters.push({ name: 'artist', value: normalizedArtist })
  }

  query.set('provider', 'qq')
  parameters.push({ name: 'provider', value: 'qq' })

  return {
    url: `${LYRICS_API_URL}?${query}`,
    method: 'GET',
    headers: { Accept: 'application/json' },
    parameters,
  }
}

function getCachePath(title: string, artist: string) {
  const key = `${title.trim().toLowerCase()}\0${artist.trim().toLowerCase()}`
  const hash = createHash('sha256').update(key).digest('hex')

  return resolve(CACHE_DIR, `${hash}.json`)
}

function isLyricsContentKind(value: unknown): value is LyricsContentKind {
  return value === 'lyrics' ||
    value === 'credits' ||
    value === 'instrumental' ||
    value === 'none'
}

function isCachedLyrics(value: unknown): value is CachedLyrics {
  if (!value || typeof value !== 'object') return false

  const cached = value as Partial<CachedLyrics>
  return cached.version === CACHE_VERSION &&
    Array.isArray(cached.lines) &&
    isLyricsContentKind(cached.contentKind)
}

function normalizeWords(words: unknown): LyricWord[] {
  if (!Array.isArray(words)) return []

  return words.filter((word): word is LyricWord =>
    Boolean(word) &&
    typeof word === 'object' &&
    typeof (word as LyricWord).text === 'string' &&
    Number.isFinite((word as LyricWord).startMs) &&
    Number.isFinite((word as LyricWord).durationMs),
  )
}

function normalizeLines(
  rawLines: LyricsApiLine[] | null | undefined,
  trackDurationSeconds: number | undefined,
): LyricLine[] {
  if (!Array.isArray(rawLines)) return []

  const timedLines = rawLines
    .filter((line): line is LyricsApiLine & { text: string; startMs: number } =>
      typeof line.text === 'string' && Number.isFinite(line.startMs),
    )
    .sort((a, b) => a.startMs - b.startMs)
  const trackDurationMs = Number.isFinite(trackDurationSeconds)
    ? trackDurationSeconds! * 1000
    : undefined

  return timedLines.map((line, index) => {
    const nextStartMs = timedLines[index + 1]?.startMs
    const inferredDuration = nextStartMs !== undefined
      ? nextStartMs - line.startMs
      : trackDurationMs === undefined ? 0 : trackDurationMs - line.startMs

    return {
      text: line.text,
      startMs: line.startMs,
      durationMs: Number.isFinite(line.durationMs)
        ? Math.max(0, line.durationMs as number)
        : Math.max(0, inferredDuration),
      words: normalizeWords(line.words),
    }
  })
}

function classifyLyrics(
  lines: LyricLine[],
  instrumental: boolean,
): LyricsContentKind {
  if (instrumental) return 'instrumental'
  if (lines.length === 0) return 'none'
  if (lines.every((line) => CREDIT_PREFIX.test(line.text.trim()))) return 'credits'

  return 'lyrics'
}

export async function fetchLyrics(
  title: string,
  artist: string,
  signal?: AbortSignal,
): Promise<LyricsResult> {
  const request = createLyricsRequest(title, artist)
  const cachePath = getCachePath(
    request.parameters.find(({ name }) => name === 'title')!.value,
    request.parameters.find(({ name }) => name === 'artist')?.value ?? '',
  )

  // 优先读取本地缓存
  try {
    const content = await readFile(cachePath, 'utf8')
    const cached: unknown = JSON.parse(content)

    if (isCachedLyrics(cached)) {
      return cached
    }
  } catch {
    // 缓存不存在或损坏，继续请求 API
  }

  const response = await fetch(
    request.url,
    {
      method: request.method,
      headers: request.headers,
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

  const lines = normalizeLines(
    body.data?.syncedLyrics,
    body.data?.track.duration,
  )
  const result: CachedLyrics = {
    version: CACHE_VERSION,
    lines,
    contentKind: classifyLyrics(lines, body.data?.instrumental === true),
  }

  // 缓存失败不应影响歌词显示
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(
      cachePath,
      JSON.stringify(result),
      'utf8',
    )
  } catch {
    // 忽略缓存写入错误
  }

  return result
}
