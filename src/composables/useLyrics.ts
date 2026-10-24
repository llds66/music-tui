import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import {
  fetchLyrics,
  LyricsRequestError,
  type LyricsContentKind,
  type LyricLine,
} from '../services/lyrics'
import type { LyricsProvider } from '../services/lyricsProvider'
import type { SongInfo } from './usePlayer'

export function useLyrics(
  song: Ref<SongInfo>,
  currentTime: Ref<number>,
  provider: Ref<LyricsProvider>,
) {
  const lyrics = ref<LyricLine[]>([])
  const plainLyrics = ref('')
  const contentKind = ref<LyricsContentKind>('none')
  const requestStatus = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let controller: AbortController | null = null
  let requestVersion = 0

  function describeRequestError(error: unknown): { message: string; status: string } {
    if (error instanceof LyricsRequestError) {
      const status = `HTTP ${error.status}${error.code ? ` · ${error.code}` : ''}`
      const retry = error.retryAfterSeconds === undefined
        ? ''
        : `，${error.retryAfterSeconds} 秒后重试`

      switch (error.status) {
        case 400:
          return { message: '歌曲信息无效，无法查询歌词', status }
        case 404:
          return { message: '未找到歌词', status }
        case 409:
          if (error.code === 'PROVIDER_DISABLED') {
            return { message: '该歌词来源当前不可用，请切换来源', status }
          }
          if (error.code === 'RECORDING_CONFLICT') {
            return { message: '歌曲录音版本信息冲突', status }
          }
          return { message: '歌词匹配不明确，请切换来源', status }
        case 429:
          return { message: `请求过于频繁${retry || '，请稍后重试'}`, status }
        case 502:
          return { message: '歌词来源查询失败，请切换来源重试', status }
        case 503:
          return { message: `歌词服务暂不可用${retry || '，请稍后重试'}`, status }
        case 504:
          return { message: '歌词查询超时，请稍后重试', status }
        default:
          return { message: '歌词获取失败', status }
      }
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      return { message: '歌词查询超时，请稍后重试', status: '本地超时（125 秒）' }
    }

    return { message: '网络连接异常，歌词获取失败', status: '网络错误' }
  }

  const activeIndex = computed(() => {
    const currentMs = currentTime.value * 1000

    for (let i = lyrics.value.length - 1; i >= 0; i--) {
      const startMs = lyrics.value[i]!.startMs
      if (typeof startMs === 'number' && currentMs >= startMs) {
        return i
      }
    }

    return -1
  })

  const activeWordIndex = computed(() => {
    const line = lyrics.value[activeIndex.value]

    if (!line?.words?.length) return -1

    const currentMs = currentTime.value * 1000

    for (let i = line.words.length - 1; i >= 0; i--) {
      if (currentMs >= line.words[i]!.startMs) {
        return i
      }
    }

    return -1
  })

  async function loadLyrics(title: string, artist: string, selectedProvider: LyricsProvider) {
    controller?.abort()

    const version = ++requestVersion
    controller = new AbortController()

    lyrics.value = []
    plainLyrics.value = ''
    contentKind.value = 'none'
    requestStatus.value = '请求中...'
    error.value = null
    isLoading.value = true

    try {
      const result = await fetchLyrics(
        title,
        artist,
        selectedProvider,
        AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(125000),
        ]),
      )

      if (version !== requestVersion) return

      lyrics.value = result.lines
      plainLyrics.value = result.plainLyrics
      contentKind.value = result.contentKind
      requestStatus.value = result.requestStatus
    } catch (err) {
      if (version !== requestVersion) return

      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      const details = describeRequestError(err)
      error.value = details.message
      requestStatus.value = details.status
    } finally {
      if (version === requestVersion) {
        isLoading.value = false
      }
    }
  }

  watch(
    () => [song.value.title, song.value.artist, provider.value] as const,
    ([title, artist, selectedProvider]) => {
      // 等待 mpv 完成 metadata 读取
      if (
        !title ||
        title === '正在加载...' ||
        title === '未知歌曲'
      ) {
        controller?.abort()
        ++requestVersion
        lyrics.value = []
        plainLyrics.value = ''
        contentKind.value = 'none'
        requestStatus.value = null
        error.value = null
        isLoading.value = false
        return
      }

      void loadLyrics(
        title,
        artist === '未知歌手' ? '' : artist,
        selectedProvider,
      )
    },
    { immediate: true },
  )

  onUnmounted(() => {
    ++requestVersion
    controller?.abort()
  })

  return {
    lyrics,
    plainLyrics,
    contentKind,
    requestStatus,
    isLoading,
    error,
    activeIndex,
    activeWordIndex,
    loadLyrics,
  }
}
