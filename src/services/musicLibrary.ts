import { readdir } from 'node:fs/promises'
import path from 'node:path'

export type MusicFile = {
  id: string
  name: string
  path: string
  extension: string
}

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
])

/**
 * 扫描指定目录中的音乐文件
 *
 * @param directory 音乐目录
 * @param recursive 是否递归扫描子目录
 */
export async function scanMusicDirectory(
  directory: string,
  recursive = true,
): Promise<MusicFile[]> {
  const files: MusicFile[] = []

  async function scan(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, {
      withFileTypes: true,
    })

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name)

      if (entry.isDirectory()) {
        if (recursive) {
          await scan(fullPath)
        }

        continue
      }

      if (!entry.isFile()) continue

      const extension = path.extname(entry.name).toLowerCase()

      if (!SUPPORTED_EXTENSIONS.has(extension)) continue

      files.push({
        id: fullPath,
        name: path.parse(entry.name).name,
        path: fullPath,
        extension,
      })
    }
  }

  await scan(directory)

  // 按文件名称排序，保证每次扫描顺序稳定
  return files.sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN', {
      numeric: true,
    }),
  )
}
