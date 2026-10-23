import { access, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class MpvNotFoundError extends Error { }

function createDirectoryAccessError(
  musicDirectory: string,
  error: unknown,
): Error {
  const code = (error as NodeJS.ErrnoException).code
  const reason =
    code === 'ENOENT'
      ? '目录不存在'
      : code === 'EACCES'
        ? '目录不可读取'
        : '无法访问目录'

  return new Error(`${reason}：${musicDirectory}`, { cause: error })
}

/**
 * 解析 CLI 参数并确认音乐目录可读取。
 */
export async function parseCliArguments(
  args = process.argv.slice(2),
): Promise<string> {
  const positional = args[0] === '--' ? args.slice(1) : args

  if (positional.length > 1) {
    throw new Error('只能指定一个音乐目录。')
  }

  if (positional[0]?.startsWith('-')) {
    throw new Error(`未知选项：${positional[0]}。`)
  }

  const musicDirectory = resolve(process.cwd(), positional[0] ?? '.')

  let details
  try {
    details = await stat(musicDirectory)
  } catch (error) {
    throw createDirectoryAccessError(musicDirectory, error)
  }

  if (!details.isDirectory()) {
    throw new Error('请选择包含音乐的文件夹')
  }

  try {
    await access(musicDirectory, constants.R_OK)
  } catch (error) {
    throw createDirectoryAccessError(musicDirectory, error)
  }

  return musicDirectory
}


/** 在创建终端界面前确认播放器可用。 */
export async function ensureMpvAvailable(): Promise<void> {
  try {
    await execFileAsync('mpv.exe', ['--version'], {
      windowsHide: true,
      timeout: 5000,
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new MpvNotFoundError(
        '未检测到 mpv\n\n' +
        'Music.TUI 需要 mpv 才能播放音乐。\n\n' +
        'mpv 官方网站  https://mpv.io/installation/\n' +
        'mpv 安装参考教程  https://blog.lldsss.com/projects/music-tui#install-mpv',
      )
    }

    throw new Error(
      `无法运行 mpv.exe：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
