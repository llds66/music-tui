import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type UserSettings = {
  showLogo: boolean
}

export const defaultSettings: Readonly<UserSettings> = {
  showLogo: true,
}

export function getConfigDirectory(): string {
  if (process.platform === 'win32') {
    return join(
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'music.tui',
    )
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'music.tui')
  }

  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'music.tui')
}

export async function loadSettings(directory = getConfigDirectory()): Promise<UserSettings> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(directory, 'config.json'), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...defaultSettings }
    }

    const showLogo = (parsed as Record<string, unknown>).showLogo
    return { showLogo: typeof showLogo === 'boolean' ? showLogo : defaultSettings.showLogo }
  } catch {
    return { ...defaultSettings }
  }
}

export async function saveSettings(
  settings: UserSettings,
  directory = getConfigDirectory(),
): Promise<void> {
  const temporaryPath = join(directory, `config-${randomUUID()}.tmp`)
  try {
    await mkdir(directory, { recursive: true })
    await writeFile(temporaryPath, JSON.stringify(settings, null, 2), 'utf8')
    await rename(temporaryPath, join(directory, 'config.json'))
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {})
    throw error
  }
}
