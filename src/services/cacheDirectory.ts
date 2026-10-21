import { homedir } from 'node:os'
import { join } from 'node:path'

export function getCacheDirectory(): string {
  if (process.platform === 'win32') {
    return join(
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
      'music.tui',
      'Cache',
    )
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'music.tui')
  }

  return join(
    process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'),
    'music.tui',
  )
}
