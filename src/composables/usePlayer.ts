
import { onUnmounted, ref } from 'vue'
import { MpvService } from '../services/mpv'

export type SongInfo = {
  title: string
  artist: string
  album: string
}

export function usePlayer() {
  const mpv = new MpvService()

  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const isReady = ref(false)
  const isEnded = ref(false)
  const isLoading = ref(false)
  const hasMedia = ref(false)
  const loadedPath = ref('')
  const error = ref<string | null>(null)

  const song = ref<SongInfo>({
    title: '未知歌曲',
    artist: '未知歌手',
    album: '未知专辑',
  })

  let disposed = false
  let currentPath = ''
  let loadVersion = 0

  function setError(err: unknown) {
    if (disposed) return
    error.value = err instanceof Error ? err.message : String(err)
  }

  /**
   * 读取当前音乐的元数据
   */
  async function loadMetadata(version: number) {
    try {
      const [metadata, mediaTitle] = await Promise.all([
        mpv.getMetadata(),
        mpv.getMediaTitle(),
      ])

      // 切歌期间，忽略旧请求返回的元数据
      if (disposed || version !== loadVersion) return

      const tags = Object.fromEntries(
        Object.entries(metadata ?? {}).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      )

      song.value = {
        title: tags.title || mediaTitle || '未知歌曲',
        artist:
          tags.artist ||
          tags.album_artist ||
          '未知歌手',
        album: tags.album || '未知专辑',
      }
    } catch (err) {
      if (version === loadVersion) setError(err)
    }
  }

  /**
   * 同步 mpv 播放属性
   */
  const unsubscribeProperty = mpv.onPropertyChange((event) => {
    if (disposed) return

    switch (event.name) {
      case 'time-pos':
        if (isEnded.value || isLoading.value) return

        if (typeof event.data === 'number') {
          currentTime.value = event.data
        }
        break

      case 'duration':
        if (isEnded.value || isLoading.value) return

        if (typeof event.data === 'number') {
          duration.value = event.data
        }
        break

      case 'pause':
        if (isEnded.value) return

        if (typeof event.data === 'boolean') {
          isPlaying.value = !event.data
        }
        break
    }
  })


  let onEndedCallback: (() => void) | null = null
  function onEnded(callback: () => void) {
    onEndedCallback = callback

    return () => {
      if (onEndedCallback === callback) {
        onEndedCallback = null
      }
    }
  }

  /**
   * 监听文件生命周期
   */
  const unsubscribeLifecycle = mpv.onLifecycle((event) => {
    if (disposed) return

    if (event.name === 'file-loaded') {
      hasMedia.value = true
      loadedPath.value = currentPath
      isEnded.value = false
      isLoading.value = false

      const version = loadVersion

      void loadMetadata(version)

      // 主动读取 mpv 当前的暂停状态
      void mpv
        .command<boolean>('get_property', 'pause')
        .then((paused) => {
          if (disposed || version !== loadVersion) return

          isPlaying.value = !paused
        })
        .catch(setError)

      return
    }

    if (event.name === 'end-file') {
      // 切换文件时，mpv 会结束旧文件
      // 只有自然播放到末尾才标记为播放完成
      if (event.reason === 'eof' && !isLoading.value) {
        isEnded.value = true
        isPlaying.value = false
        hasMedia.value = false
        currentTime.value = duration.value

        // 通知外部：当前歌曲自然播放完成
        onEndedCallback?.()
      } else if (!isLoading.value) {
        hasMedia.value = false
        isPlaying.value = false
      }
    }
  })

  /**
   * 初始化 mpv
   */
  async function init(path: string) {
    if (disposed || isReady.value) return

    error.value = null

    try {
      await mpv.start()

      if (disposed) return

      await mpv.observePlayback()

      if (disposed) return

      isReady.value = true

      await loadSong(path)
    } catch (err) {
      setError(err)
    }
  }

  /**
   * 加载并播放指定音乐
   */
  async function loadSong(path: string) {
    if (!isReady.value || disposed || isLoading.value) return

    const version = ++loadVersion

    currentPath = path
    isLoading.value = true
    loadedPath.value = ''

    isPlaying.value = false
    isEnded.value = false
    hasMedia.value = false
    currentTime.value = 0
    duration.value = 0
    error.value = null

    song.value = {
      title: '正在加载...',
      artist: '',
      album: '',
    }

    try {
      await mpv.loadFile(path)

      if (disposed || version !== loadVersion) return

      // loadfile 命令成功不代表文件已经加载完成
      // file-loaded 事件负责解除 isLoading
    } catch (err) {
      if (version !== loadVersion) return

      isLoading.value = false
      setError(err)
    }
  }

  /**
   * 开始或恢复播放
   */
  async function play() {
    if (!isReady.value || disposed || isLoading.value) return

    try {
      if (isEnded.value) {
        if (!currentPath) return

        await loadSong(currentPath)
        return
      }

      await mpv.play()
    } catch (err) {
      setError(err)
    }
  }

  /**
   * 暂停播放
   */
  async function pause() {
    if (!isReady.value || disposed || isLoading.value || isEnded.value) {
      return
    }

    try {
      await mpv.pause()
    } catch (err) {
      setError(err)
    }
  }

  /**
   * 切换播放 / 暂停
   */
  async function togglePlay() {
    if (!isReady.value || disposed || isLoading.value) return

    if (isEnded.value) {
      await play()
      return
    }

    try {
      // 直接读取 mpv 的真实暂停状态
      const paused = await mpv.command<boolean>(
        'get_property',
        'pause',
      )

      if (paused) {
        await mpv.play()
      } else {
        await mpv.pause()
      }
    } catch (err) {
      setError(err)
    }
  }

  /**
   * 快进或快退
   */
  async function seek(seconds: number) {
    if (
      !isReady.value ||
      disposed ||
      isLoading.value ||
      isEnded.value ||
      duration.value <= 0
    ) {
      return
    }

    try {
      await mpv.seek(seconds)
    } catch (err) {
      setError(err)
    }
  }


  /**
   * 关闭播放器
   */
  function close() {
    if (disposed) return

    disposed = true
    isReady.value = false
    isLoading.value = false
    isPlaying.value = false
    hasMedia.value = false
    loadedPath.value = ''
    onEndedCallback = null

    unsubscribeProperty()
    unsubscribeLifecycle()

    mpv.close()
  }

  onUnmounted(close)

  return {
    song,
    isPlaying,
    currentTime,
    duration,
    isReady,
    isEnded,
    isLoading,
    hasMedia,
    loadedPath,
    error,
    init,
    loadSong,
    play,
    pause,
    togglePlay,
    seek,
    close,
    onEnded
  }
}
