
import { scanMusicDirectory } from '../src/services/musicLibrary.ts'

const directory = 'C:\\dev\\tui-music\\music'
try {
  const songs = await scanMusicDirectory(directory)

  console.log(`共找到 ${songs.length} 首音乐`)

  for (const [index, song] of songs.entries()) {
    console.log(
      `${index + 1}. ${song.name} (${song.extension})`,
    )
    console.log(`   ${song.path}`)
  }
} catch (error) {
  console.error('扫描失败:', error)
  process.exitCode = 1
}
