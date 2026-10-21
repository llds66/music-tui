import { createApp } from 'vue-termui'
import App from './App.vue'
import { parseCliArguments } from './cli'

try {
  const result = await parseCliArguments()

  if (result.kind === 'message') {
    console.log(result.message)
  } else {
    // createApp is async — it spins up the OpenTUI renderer first.
    const app = await createApp(App, {
      musicDirectory: result.musicDirectory,
    })
    app.mount()

    // Keep the process alive until the user quits.
    await app.waitUntilExit()
  }
} catch (error) {
  console.error(
    error instanceof Error ? `music.tui: ${error.message}` : error,
  )
  process.exitCode = 1
}
