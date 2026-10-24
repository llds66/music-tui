import { spawn } from 'node:child_process'

/** 将文本写入系统剪贴板。当前 Windows 发行版使用系统自带的 clip.exe。 */
export function copyToClipboard(text: string): Promise<void> {
  const command = process.platform === 'win32'
    ? { file: 'clip.exe', args: [] }
    : process.platform === 'darwin'
      ? { file: 'pbcopy', args: [] }
      : { file: 'xclip', args: ['-selection', 'clipboard'] }

  return new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    })
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve()
    }

    child.once('error', finish)
    child.once('close', (code) => {
      finish(code === 0 ? undefined : new Error(`剪贴板命令退出码：${code}`))
    })
    child.stdin.end(text, 'utf8')
  })
}
