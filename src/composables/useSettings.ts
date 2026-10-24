import { reactive } from 'vue'
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  type UserSettings,
} from '../services/userSettings'
import { LYRICS_PROVIDERS } from '../services/lyricsProvider'

export function useSettings() {
  const settings = reactive<UserSettings>({ ...defaultSettings })
  let changed = false
  let pendingSave: Promise<void> = Promise.resolve()

  async function load(): Promise<void> {
    const saved = await loadSettings()
    if (!changed) Object.assign(settings, saved)
  }

  function persist(): void {
    changed = true
    const snapshot = { ...settings }
    pendingSave = pendingSave.then(() => saveSettings(snapshot)).catch(() => {})
  }

  function toggleShowLogo(): void {
    settings.showLogo = !settings.showLogo
    persist()
  }

  function cycleLyricsProvider(direction: -1 | 1): void {
    const index = LYRICS_PROVIDERS.indexOf(settings.lyricsProvider)
    settings.lyricsProvider = LYRICS_PROVIDERS[
      (index + direction + LYRICS_PROVIDERS.length) % LYRICS_PROVIDERS.length
    ]!
    persist()
  }

  function reset(): void {
    Object.assign(settings, defaultSettings)
    persist()
  }

  function flush(): Promise<void> {
    return pendingSave
  }

  return { settings, load, toggleShowLogo, cycleLyricsProvider, reset, flush }
}
