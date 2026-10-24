import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getCacheDirectory } from './cacheDirectory'
import type { LyricsProvider } from './lyricsProvider'

/**
 * 歌词
 * 负责调用 API、读取和保存本地 JSON 缓存。
 */
export interface LyricWord {
  text: string
  startMs: number
  durationMs?: number
}

export interface LyricLine {
  text: string
  startMs?: number
  durationMs?: number
  words: LyricWord[]
}

export type LyricsContentKind = 'lyrics' | 'credits' | 'instrumental' | 'plain' | 'none'

export type LyricsResult = {
  lines: LyricLine[]
  plainLyrics: string
  contentKind: LyricsContentKind
}

export type LyricsFetchResult = LyricsResult & {
  requestStatus: string
}

export class LyricsRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly retryAfterSeconds?: number

  constructor(status: number, code?: string, message?: string, retryAfterSeconds?: number) {
    super(message ?? code ?? `HTTP ${status}`)
    this.name = 'LyricsRequestError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
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
    retryAfterSeconds?: number
  }
}

const CACHE_DIR = getCacheDirectory()
const LYRICS_API_URL = 'https://api.lyriva.xyz/lyriva/lyrics'
const CACHE_VERSION = 3

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
  provider: LyricsProvider
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
  provider: LyricsProvider = 'auto',
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

  if (provider !== 'auto') {
    query.set('provider', provider)
    parameters.push({ name: 'provider', value: provider })
  }

  return {
    url: `${LYRICS_API_URL}?${query}`,
    provider,
    method: 'GET',
    headers: { Accept: 'application/json' },
    parameters,
  }
}

function getCachePath(title: string, artist: string, provider: LyricsProvider) {
  const key = `${title.trim().toLowerCase()}\0${artist.trim().toLowerCase()}\0${provider}`
  const hash = createHash('sha256').update(key).digest('hex')

  return resolve(CACHE_DIR, `${hash}.json`)
}

/** 只清理由歌词查询生成的哈希缓存文件，保留同目录的元数据缓存。 */
export async function clearLyricsCache(): Promise<void> {
  try {
    const names = await readdir(CACHE_DIR)
    await Promise.all(
      names
        .filter((name) => /^[a-f\d]{64}\.json$/i.test(name))
        .map((name) => unlink(resolve(CACHE_DIR, name))),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

function isLyricsContentKind(value: unknown): value is LyricsContentKind {
  return value === 'lyrics' ||
    value === 'credits' ||
    value === 'instrumental' ||
    value === 'plain' ||
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
    Number.isFinite((word as LyricWord).startMs),
  )
}

function normalizeLines(
  rawLines: LyricsApiLine[] | null | undefined,
): LyricLine[] {
  if (!Array.isArray(rawLines)) return []

  const normalized: Array<LyricsApiLine & { text: string; index: number }> = []
  rawLines.forEach((line, index) => {
    if (typeof line.text === 'string') normalized.push({ ...line, text: line.text, index })
  })

  return normalized
    .sort((a, b) => {
      const aIndex = a.index
      const bIndex = b.index
      const aTimed = Number.isFinite(a.startMs)
      const bTimed = Number.isFinite(b.startMs)
      if (aTimed && bTimed) return (a.startMs as number) - (b.startMs as number)
      if (aTimed) return -1
      if (bTimed) return 1
      return aIndex - bIndex
    })
    .map((line) => ({
      text: line.text,
      ...(Number.isFinite(line.startMs) ? { startMs: line.startMs as number } : {}),
      ...(Number.isFinite(line.durationMs) ? { durationMs: line.durationMs as number } : {}),
      words: normalizeWords(line.words),
    }))
}

function classifyLyrics(
  lines: LyricLine[],
  plainLyrics: string,
  instrumental: boolean,
): LyricsContentKind {
  if (instrumental) return 'instrumental'
  const timedLines = lines.filter((line) => Number.isFinite(line.startMs))
  if (timedLines.length === 0) {
    return plainLyrics.trim() || lines.length > 0 ? 'plain' : 'none'
  }
  if (timedLines.every((line) => CREDIT_PREFIX.test(line.text.trim()))) return 'credits'

  return 'lyrics'
}

export async function fetchLyrics(
  title: string,
  artist: string,
  provider: LyricsProvider,
  signal?: AbortSignal,
): Promise<LyricsFetchResult> {
  const request = createLyricsRequest(title, artist, provider)
  const cachePath = getCachePath(
    request.parameters.find(({ name }) => name === 'title')!.value,
    request.parameters.find(({ name }) => name === 'artist')?.value ?? '',
    provider,
  )

  // 优先读取本地缓存
  try {
    const content = await readFile(cachePath, 'utf8')
    const cached: unknown = JSON.parse(content)

    if (isCachedLyrics(cached)) {
      return { ...cached, requestStatus: '本地缓存' }
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
    const retryAfterValue = response.headers.get('Retry-After')
    const retryAfterHeader = retryAfterValue === null ? Number.NaN : Number(retryAfterValue)
    throw new LyricsRequestError(
      response.status,
      body.error?.code,
      body.error?.message,
      Number.isFinite(retryAfterHeader)
        ? retryAfterHeader
        : body.error?.retryAfterSeconds,
    )
  }

  const lines = normalizeLines(body.data?.syncedLyrics)
  const suppliedPlainLyrics = typeof body.data?.plainLyrics === 'string'
    ? body.data.plainLyrics
    : ''
  const plainLyrics = suppliedPlainLyrics || lines
    .filter((line) => !Number.isFinite(line.startMs))
    .map((line) => line.text)
    .join('\n')
  const result: CachedLyrics = {
    version: CACHE_VERSION,
    lines,
    plainLyrics,
    contentKind: classifyLyrics(lines, plainLyrics, body.data?.instrumental === true),
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

  return { ...result, requestStatus: 'HTTP 200' }
}
