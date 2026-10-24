import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import {
  fetchLyrics,
  type LyricsContentKind,
  type LyricLine,
} from '../services/lyrics'
import type { SongInfo } from './usePlayer'

export function useLyrics(
  song: Ref<SongInfo>,
  currentTime: Ref<number>,
) {
  const lyrics = ref<LyricLine[]>([])
  const contentKind = ref<LyricsContentKind>('none')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let controller: AbortController | null = null
  let requestVersion = 0

  const activeIndex = computed(() => {
    const currentMs = currentTime.value * 1000

    for (let i = lyrics.value.length - 1; i >= 0; i--) {
      if (currentMs >= lyrics.value[i]!.startMs) {
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

  async function loadLyrics(title: string, artist: string) {
    controller?.abort()

    const version = ++requestVersion
    controller = new AbortController()

    lyrics.value = []
    contentKind.value = 'none'
    error.value = null
    isLoading.value = true

    try {
      const result = await fetchLyrics(
        title,
        artist,
        AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(125000),
        ]),
      )

      if (version !== requestVersion) return

      lyrics.value = result.lines
      contentKind.value = result.contentKind
    } catch (err) {
      if (version !== requestVersion) return

      if (err instanceof Error && err.name === 'AbortError') {
        return
      }

      error.value =
        err instanceof Error ? err.message : String(err)
    } finally {
      if (version === requestVersion) {
        isLoading.value = false
      }
    }
  }

  watch(
    () => [song.value.title, song.value.artist] as const,
    ([title, artist]) => {
      // 等待 mpv 完成 metadata 读取
      if (
        !title ||
        title === '正在加载...' ||
        title === '未知歌曲'
      ) {
        controller?.abort()
        ++requestVersion
        lyrics.value = []
        contentKind.value = 'none'
        error.value = null
        isLoading.value = false
        return
      }

      void loadLyrics(
        title,
        artist === '未知歌手' ? '' : artist,
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
    contentKind,
    isLoading,
    error,
    activeIndex,
    activeWordIndex,
    loadLyrics,
  }
}
