import { stat } from 'node:fs/promises'
import type { MusicFile } from './musicLibrary.ts'
import { MetadataCache, metadataFromTags, type SongMetadata } from './metadataCache.ts'
import { MpvService } from './mpv.ts'

type MetadataFound = (file: MusicFile, metadata: SongMetadata) => void

/** 独立静音 mpv 进程，与正在播放的 mpv 完全分离。 */
export class BackgroundMetadataReader {
  private stopped = false
  private stopPromise: Promise<void> | null = null
  private services = new Set<MpvService>()
  private cancellations = new Set<() => void>()
  private readonly cache: MetadataCache

  constructor(cache: MetadataCache) {
    this.cache = cache
  }

  async scan(files: MusicFile[], onFound: MetadataFound): Promise<void> {
    if (this.stopped) return
    let next = 0
    const worker = async () => {
      const mpv = new MpvService()
      this.services.add(mpv)
      try {
        await mpv.start(true)
        while (!this.stopped && next < files.length) {
          const file = files[next++]!
          try {
            const before = await stat(file.path)
            if (this.cache.get(file.path, before)) continue

            const metadata = await this.read(mpv, file.path)
            if (!metadata || this.stopped) continue

            const after = await stat(file.path)
            if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) continue

            this.cache.put(file.path, after, metadata)
            onFound(file, metadata)
          } catch {
            // 单个文件读取失败不妨碍其余文件和播放。
          }
        }
      } catch {
        // mpv 不可用时保留文件名和已有缓存。
      } finally {
        await mpv.close()
        this.services.delete(mpv)
      }
    }

    // 两个后台进程限制磁盘与 CPU 占用；不等待其完成。
    await Promise.all(
      Array.from({ length: Math.min(2, files.length) }, () => worker()),
    )
  }

  private async read(mpv: MpvService, path: string): Promise<SongMetadata | null> {
    let cancel: () => void = () => {}
    const loaded = new Promise<void>((resolve, reject) => {
      let settled = false
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        unsubscribe()
        this.cancellations.delete(cancel)
        if (error) reject(error)
        else resolve()
      }
      const unsubscribe = mpv.onLifecycle((event) => {
        if (event.name === 'file-loaded') finish()
        else if (event.name === 'end-file' && event.reason === 'error') {
          finish(new Error('mpv 无法加载文件'))
        }
      })
      const timer = setTimeout(() => finish(new Error('元数据读取超时')), 10000)
      cancel = () => finish(new Error('元数据读取已取消'))
      this.cancellations.add(cancel)
    })
    void loaded.catch(() => {})

    try {
      await mpv.loadFile(path)
      await loaded
      if (this.stopped) return null
      return metadataFromTags(await mpv.getMetadata())
    } catch {
      cancel()
      // 已被拒绝的 loaded Promise 仍需消费。
      await loaded.catch(() => {})
      return null
    }
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise

    this.stopped = true
    for (const cancel of this.cancellations) cancel()
    this.cancellations.clear()

    this.stopPromise = Promise.allSettled(
      [...this.services].map((service) => service.close()),
    ).then(() => {})

    return this.stopPromise
  }
}
