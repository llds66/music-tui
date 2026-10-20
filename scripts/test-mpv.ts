
import { MpvService } from '../src/services/mpv.ts'

const mpv = new MpvService()

const musicPath = 'C:\\dev\\tui-music\\music\\M800001OG7kh3lldI3.mp3'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

try {
  console.log('启动 mpv...')
  await mpv.start()

  console.log('加载音乐...')
  await mpv.loadFile(musicPath)

  // 等待文件加载并开始播放
  await sleep(1500)

  console.log('歌曲时长:', await mpv.getDuration())

  console.log('播放 5 秒...')
  await sleep(5000)

  console.log('当前进度:', await mpv.getCurrentTime())

  console.log('暂停...')
  await mpv.pause()
  await sleep(2000)

  console.log('暂停时进度:', await mpv.getCurrentTime())

  console.log('快进 10 秒...')
  await mpv.seek(10)

  console.log('恢复播放...')
  await mpv.play()
  await sleep(2000)

  console.log('当前进度:', await mpv.getCurrentTime())
} catch (error) {
  console.error('测试失败:', error)
} finally {
  console.log('关闭 mpv...')
  mpv.close()
}
