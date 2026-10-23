import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from 'vue-termui'
import App from './App.vue'
import { ensureMpvAvailable, MpvNotFoundError, parseCliArguments } from './cli'
import { theme } from './theme'

try {
  const args = process.argv.slice(2)
  const isVersionRequest =
    args.length === 1 && (args[0] === '-v' || args[0] === '--version')

  if (isVersionRequest) {
    const packageJson = JSON.parse(
      await readFile(
        resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
        'utf8',
      ),
    ) as { version: string }
    console.log(`Music.TUI v${packageJson.version}`)
  } else {
    const musicDirectory = await parseCliArguments(args)
    await ensureMpvAvailable()

    // 终端网格外的像素余量使用终端背景色，和界面背景保持一致。
    if (process.stdout.isTTY) {
      process.stdout.write(`\x1b]11;${theme.background}\x1b\\`)
    }

    try {
      // createApp is async — it spins up the OpenTUI renderer first.
      const app = await createApp(App, {
        musicDirectory,
      }, {
        backgroundColor: theme.background,
        exitOnCtrlC: false,
        exitSignals: [],
      })
      app.mount()

      // Keep the process alive until the user quits.
      await app.waitUntilExit()
    } finally {
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b]111\x1b\\')
      }
    }
  }
} catch (error) {
  console.error(
    error instanceof MpvNotFoundError
      ? error.message
      : error instanceof Error ? `music.tui: ${error.message}` : error,
  )
  process.exitCode = 1
}
