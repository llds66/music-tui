import { createApp } from 'vue-termui'
import App from './App.vue'

// createApp is async — it spins up the OpenTUI renderer first.
const app = await createApp(App)
app.mount()

// Keep the process alive until the user quits.
await app.waitUntilExit()