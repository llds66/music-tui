
import { MpvService } from '../src/services/mpv.ts'

const mpv = new MpvService()

const musicPath = 'C:\\dev\\tui-music\\music\\M800001OG7kh3lldI3.mp3'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

try {
  await mpv.start()

  const unsubscribe = mpv.onPropertyChange((event) => {
    console.log('属性变化:', event.name, event.data)
  })

  await mpv.observePlayback()

  console.log('加载歌曲...')
  await mpv.loadFile(musicPath)

  await sleep(3000)

  console.log('暂停...')
  await mpv.pause()

  await sleep(1000)

  console.log('快进 10 秒...')
  await mpv.seek(10)

  await sleep(1000)

  console.log('继续播放...')
  await mpv.play()

  await sleep(2000)

  unsubscribe()
} catch (error) {
  console.error('测试失败:', error)
} finally {
  mpv.close()
}
