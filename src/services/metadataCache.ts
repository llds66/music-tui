import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, normalize, resolve } from 'node:path'
import { getCacheDirectory } from './cacheDirectory.ts'

export type SongMetadata = {
  title?: string
  artist?: string
  album?: string
}

export type FileStamp = {
  size: number
  mtimeMs: number
}

type CacheEntry = SongMetadata & FileStamp

type CacheFile = {
  version: 1
  entries: Record<string, CacheEntry>
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim() || undefined
}

export function metadataFromTags(
  tags: Record<string, unknown> | null,
): SongMetadata | null {
  if (!tags) return null

  const normalized = Object.fromEntries(
    Object.entries(tags).map(([key, value]) => [key.toLowerCase(), value]),
  )
  const metadata: SongMetadata = {
    title: cleanText(normalized.title),
    artist: cleanText(normalized.artist) ?? cleanText(normalized.album_artist),
    album: cleanText(normalized.album),
  }

  return metadata.title || metadata.artist || metadata.album
    ? metadata
    : null
}

export function metadataKey(filePath: string): string {
  const absolute = normalize(resolve(filePath))
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute
}

function validEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<CacheEntry>
  return Number.isFinite(entry.size) &&
    Number.isFinite(entry.mtimeMs) &&
    [entry.title, entry.artist, entry.album].every(
      (field) => field === undefined || typeof field === 'string',
    ) &&
    Boolean(entry.title || entry.artist || entry.album)
}

export class MetadataCache {
  private readonly directory: string
  private readonly filePath: string
  private entries: Record<string, CacheEntry> = Object.create(null)
  private dirty = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private writing: Promise<void> | null = null
  private acceptsWrites = true

  constructor(directory = getCacheDirectory()) {
    this.directory = directory
    this.filePath = join(directory, 'metadata.json')
  }

  async load(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!parsed || typeof parsed !== 'object') return
      const file = parsed as Partial<CacheFile>
      if (file.version !== 1 || !file.entries || typeof file.entries !== 'object') return

      const entries: Record<string, CacheEntry> = Object.create(null)
      for (const [key, value] of Object.entries(file.entries)) {
        if (validEntry(value)) entries[key] = value
      }
      this.entries = entries
    } catch {
      // 缓存缺失、损坏或不可读时，扫描和播放继续进行。
    }
  }

  get(filePath: string, stamp: FileStamp): SongMetadata | null {
    const entry = this.entries[metadataKey(filePath)]
    if (!entry || entry.size !== stamp.size || entry.mtimeMs !== stamp.mtimeMs) {
      return null
    }
    return {
      title: entry.title,
      artist: entry.artist,
      album: entry.album,
    }
  }

  put(filePath: string, stamp: FileStamp, metadata: SongMetadata): void {
    if (!this.acceptsWrites) return

    const title = cleanText(metadata.title)
    const artist = cleanText(metadata.artist)
    const album = cleanText(metadata.album)
    if (!title && !artist && !album) return

    const key = metadataKey(filePath)
    const previous = this.entries[key]
    if (
      previous?.size === stamp.size &&
      previous.mtimeMs === stamp.mtimeMs &&
      previous.title === title &&
      previous.artist === artist &&
      previous.album === album
    ) return

    this.entries[key] = { size: stamp.size, mtimeMs: stamp.mtimeMs, title, artist, album }
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, 750)
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writing) await this.writing
    if (!this.dirty) return

    this.dirty = false
    const snapshot: CacheFile = { version: 1, entries: this.entries }
    const temporaryPath = join(this.directory, `metadata-${randomUUID()}.tmp`)
    this.writing = (async () => {
      try {
        await mkdir(this.directory, { recursive: true })
        await writeFile(temporaryPath, JSON.stringify(snapshot), 'utf8')
        await rename(temporaryPath, this.filePath)
      } catch {
        // 写入失败只影响下次启动的缓存命中率。
        await rm(temporaryPath, { force: true }).catch(() => {})
      }
    })()
    try {
      await this.writing
    } finally {
      this.writing = null
    }
  }

  /** 清除内存与磁盘中的歌曲元数据缓存。 */
  async clear(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.writing) await this.writing

    this.entries = Object.create(null)
    this.dirty = false
    await rm(this.filePath, { force: true })
  }

  /** 停止接收新条目，并取消尚未开始的延迟写入。 */
  stopScheduling(): void {
    this.acceptsWrites = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
