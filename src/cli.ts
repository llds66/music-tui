import { access, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

type CliResult =
  | { kind: 'run'; musicDirectory: string }
  | { kind: 'message'; message: string }

const HELP_TEXT = `用法: music.tui [音乐目录]

不传目录时，扫描当前工作目录。相对路径以当前工作目录为基准。

选项:
  -h, --help     显示帮助
  -v, --version  显示版本`

/**
 * 解析 CLI 参数并确认音乐目录可读取。
 */
export async function parseCliArguments(
  args = process.argv.slice(2),
): Promise<CliResult> {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    return { kind: 'message', message: HELP_TEXT }
  }

  if (args.length === 1 && (args[0] === '--version' || args[0] === '-v')) {
    return { kind: 'message', message: 'music.tui 0.1.0' }
  }

  const positional = args[0] === '--' ? args.slice(1) : args

  if (positional.length > 1) {
    throw new Error('只能指定一个音乐目录。请使用 --help 查看用法。')
  }

  if (positional[0]?.startsWith('-')) {
    throw new Error(`未知选项：${positional[0]}。请使用 --help 查看用法。`)
  }

  const musicDirectory = resolve(process.cwd(), positional[0] ?? '.')

  try {
    const details = await stat(musicDirectory)

    if (!details.isDirectory()) {
      throw new Error(`音乐路径不是目录：${musicDirectory}`)
    }

    await access(musicDirectory, constants.R_OK)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('音乐路径')) {
      throw error
    }

    const code = (error as NodeJS.ErrnoException).code
    const reason = code === 'ENOENT'
      ? '目录不存在'
      : code === 'EACCES'
        ? '目录不可读取'
        : '无法访问目录'

    throw new Error(`${reason}：${musicDirectory}`)
  }

  return { kind: 'run', musicDirectory }
}
