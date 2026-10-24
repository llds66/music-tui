<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { Box, onKeyDown, useExit, useRenderer } from 'vue-termui'

import LyricsPanel from './components/LyricsPanel.vue'
import MusicBanner from './components/MusicBanner.vue'
import MusicListPanel from './components/MusicListPanel.vue'
import PlaybackTime from './components/PlaybackTime.vue'
import PlayerToolbar from './components/PlayerToolbar.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'

import { useLyrics } from './composables/useLyrics'
import {
  PLAY_MODE_LABELS,
  useMusicLibrary,
} from './composables/useMusicLibrary'
import { usePlayer } from './composables/usePlayer'
import { useSettings } from './composables/useSettings'
import { useTerminalSize } from './composables/useTerminalSize'
import { theme } from './theme'
import { stat } from 'node:fs/promises'
import { BackgroundMetadataReader } from './services/backgroundMetadata'
import { MetadataCache, type SongMetadata } from './services/metadataCache'
import { createLyricsRequest } from './services/lyrics'
import { copyToClipboard } from './services/clipboard'

const { terminalHeight, terminalWidth } = useTerminalSize()
const props = defineProps<{ musicDirectory: string }>()

const {
  song,
  metadata,
  currentTime,
  duration,
  isPlaying,
  isReady,
  isLoading: playerLoading,
  loadedPath,
  init,
  loadSong,
  togglePlay,
  seek,
  close,
  onEnded,
} = usePlayer()

const {
  lyrics,
  contentKind: lyricsContentKind,
  isLoading: lyricsLoading,
  error: lyricsError,
  activeIndex,
  activeWordIndex,
} = useLyrics(song, currentTime)

const {
  songs,
  playMode,
  loadDirectory,
  nextSong,
  previousSong,
  cyclePlayMode,
  getAutoNextIndex,
  selectSong,
} = useMusicLibrary()

const exit = useExit()
const renderer = useRenderer()
const rendererClosed = (renderer as unknown as { closed: Promise<void> }).closed
const currentView = ref<'player' | 'settings'>('player')
const settingsPanel = ref<InstanceType<typeof SettingsPanel> | null>(null)
const { settings, load: loadUserSettings, toggleShowLogo, flush: flushSettings } = useSettings()
const lyricsRequest = computed(() => {
  const title = song.value.title

  if (!title || title === '正在加载...' || title === '未知歌曲') return null

  return createLyricsRequest(
    title,
    song.value.artist === '未知歌手' ? '' : song.value.artist,
  )
})
const lyricsRequestCopyStatus = ref<string | null>(null)
let copyStatusTimer: ReturnType<typeof setTimeout> | null = null
const metadataByPath = reactive<Record<string, SongMetadata>>({})
const metadataCache = new MetadataCache()
const backgroundMetadata = new BackgroundMetadataReader(metadataCache)
const pendingMetadataWrites = new Set<Promise<void>>()

const outerPadding = computed(() =>
  terminalHeight.value >= 12 && terminalWidth.value >= 40 ? 1 : 0,
)
const rootGap = computed(() => terminalHeight.value >= 16 ? 1 : 0)
const progressHeight = 1
const toolbarHeight = 1
const contentHeight = computed(() => {
  const childCount = 3
  const fixedHeight =
    outerPadding.value * 2 +
    progressHeight +
    toolbarHeight +
    rootGap.value * (childCount - 1)

  return Math.max(1, terminalHeight.value - fixedHeight)
})
const showMusicList = computed(() =>
  terminalWidth.value >= 88 &&
  terminalHeight.value >= 19 &&
  contentHeight.value >= 8,
)
const listWidth = computed(() =>
  Math.min(44, Math.max(28, Math.floor(terminalWidth.value * 0.36))),
)
const bannerHeight = ref(1)
const sidebarGap = computed(() => contentHeight.value >= 18 ? 2 : 1)
const bannerAvailableHeight = computed(() =>
  Math.max(1, contentHeight.value - 1 - sidebarGap.value * 2),
)
const listAvailableHeight = computed(() =>
  Math.max(1, contentHeight.value - 1 - sidebarGap.value
    - (settings.showLogo ? bannerHeight.value + sidebarGap.value : 0)),
)
const playingIndex = computed(() =>
  songs.value.findIndex((item) => item.path === loadedPath.value),
)

type SwitchDirection = 'next' | 'previous'
const pendingDirections: SwitchDirection[] = []
let switching = false
let exiting = false

const PERSISTENCE_WAIT_MS = 750
const EXIT_TIMEOUT_MS = 2_000

type ShutdownTimings = {
  startedAt: number
  backgroundStoppedAt?: number
  playerClosedAt?: number
  tuiDestroyedAt?: number
  persistenceFinishedAt?: number
}

function waitForAtMost(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve(true)
      },
      () => {
        clearTimeout(timer)
        resolve(true)
      },
    )
  })
}

function describeShutdownTimings(timings: ShutdownTimings): string {
  const elapsed = (completedAt?: number) =>
    completedAt === undefined ? '未完成' : `${completedAt - timings.startedAt}ms`

  return [
    `停止后台扫描 ${elapsed(timings.backgroundStoppedAt)}`,
    `关闭 mpv ${elapsed(timings.playerClosedAt)}`,
    `关闭 TUI ${elapsed(timings.tuiDestroyedAt)}`,
    `保存设置和缓存 ${elapsed(timings.persistenceFinishedAt)}`,
  ].join('；')
}

function showCopyStatus(status: string): void {
  lyricsRequestCopyStatus.value = status
  if (copyStatusTimer) clearTimeout(copyStatusTimer)
  copyStatusTimer = setTimeout(() => {
    lyricsRequestCopyStatus.value = null
    copyStatusTimer = null
  }, 2_000)
}

async function copyLyricsRequest(): Promise<void> {
  const request = lyricsRequest.value
  if (!request) {
    showCopyStatus('无请求')
    return
  }

  try {
    await copyToClipboard(request.url)
    showCopyStatus('已复制')
  } catch {
    showCopyStatus('复制失败')
  }
}

/**
 * 启动时扫描目录并播放第一首
 */
onMounted(async () => {
  await loadUserSettings()
  await loadDirectory(props.musicDirectory)

  await metadataCache.load()
  const uncached = [] as typeof songs.value
  let next = 0
  await Promise.all(Array.from({ length: Math.min(16, songs.value.length) }, async () => {
    while (next < songs.value.length) {
      const file = songs.value[next++]!
      try {
        const stamp = await stat(file.path)
        const cached = metadataCache.get(file.path, stamp)
        if (cached) metadataByPath[file.path] = cached
        else uncached.push(file)
      } catch {
        uncached.push(file)
      }
    }
  }))

  const firstSong = songs.value[0]
  if (!firstSong) return

  await init(firstSong.path)
  void backgroundMetadata.scan(uncached, (file, value) => {
    metadataByPath[file.path] = value
  })
})

// 播放器得到真实文件标签时，同步列表并进入持久化缓存。
watch(
  metadata,
  (result) => {
    if (!result || exiting) return
    metadataByPath[result.path] = result.value
    const pending = stat(result.path).then((stamp) => {
      metadataCache.put(result.path, stamp, result.value)
    }).catch(() => {})
    pendingMetadataWrites.add(pending)
    void pending.finally(() => pendingMetadataWrites.delete(pending))
  },
  { flush: 'sync' },
)

/**
 * 切换音乐
 */
function switchSong(direction: SwitchDirection) {
  if (
    !isReady.value ||
    exiting ||
    songs.value.length === 0
  ) {
    return
  }

  pendingDirections.push(direction)
  void drainSwitches()
}

async function drainSwitches() {
  if (switching || playerLoading.value || !isReady.value || exiting || pendingDirections.length === 0) {
    return
  }

  switching = true

  try {
    // 同一轮快速按键依次沿用现有列表边界规则，只加载最终目标。
    let target: (typeof songs.value)[number] | null = null
    for (const direction of pendingDirections.splice(0)) {
      target = direction === 'next' ? nextSong() : previousSong()
    }
    if (target) await loadSong(target.path)
  } finally {
    switching = false
    if (pendingDirections.length > 0 && !playerLoading.value) void drainSwitches()
  }
}

watch(playerLoading, (loading) => {
  if (!loading) void drainSwitches()
})

async function quit() {
  if (exiting) return

  exiting = true
  const timings: ShutdownTimings = { startedAt: Date.now() }
  const forceExitTimer = setTimeout(() => {
    console.error(
      `music.tui: 退出超时（${EXIT_TIMEOUT_MS}ms；${describeShutdownTimings(timings)}），将强制结束。`,
    )
    if (timings.tuiDestroyedAt === undefined) exit()
    process.exit(1)
  }, EXIT_TIMEOUT_MS)
  forceExitTimer.unref()

  pendingDirections.length = 0
  metadataCache.stopScheduling()

  const backgroundStopped = backgroundMetadata.stop().then(
    () => { timings.backgroundStoppedAt = Date.now() },
    () => { timings.backgroundStoppedAt = Date.now() },
  )
  const playerClosed = close().then(
    () => { timings.playerClosedAt = Date.now() },
    () => { timings.playerClosedAt = Date.now() },
  )

  // 终端资源优先恢复；缓存与设置只做有限时间的补充等待。
  exit()
  const tuiClosed = rendererClosed.then(
    () => { timings.tuiDestroyedAt = Date.now() },
    () => { timings.tuiDestroyedAt = Date.now() },
  )

  const persistence = Promise.allSettled([
    metadataCache.flush(),
    flushSettings(),
  ]).then(() => {
    timings.persistenceFinishedAt = Date.now()
  })

  const persistenceFinished = await waitForAtMost(
    persistence,
    PERSISTENCE_WAIT_MS,
  )
  await Promise.allSettled([backgroundStopped, playerClosed, tuiClosed])

  // 已确认终端、mpv 和持久化均完成后，结束可能由 HTTP keep-alive
  // 等非关键句柄继续保持的 Node 进程，确保 shell 立即可用。
  if (persistenceFinished) process.exit(0)
}

const unsubscribeEnded = onEnded(() => {
  const nextIndex = getAutoNextIndex()

  // 顺序播放到最后一首时停止
  if (nextIndex === null) return

  const next = songs.value[nextIndex]
  if (!next) return

  // 避免与手动切歌发生冲突
  if (switching) return

  void (async () => {
    switching = true

    try {
      await loadSong(next.path)

      // loadSong 当前会捕获内部错误，
      // 这里先沿用现有的切歌处理方式
      selectSong(nextIndex)
    } finally {
      switching = false
      if (pendingDirections.length > 0 && !playerLoading.value) void drainSwitches()
    }
  })()
})

onUnmounted(unsubscribeEnded)
onUnmounted(() => {
  void backgroundMetadata.stop()
  metadataCache.stopScheduling()
  if (copyStatusTimer) clearTimeout(copyStatusTimer)
})

/**
 * 所有快捷键只在根组件注册一次，列表组件仅负责显示。
 */
const unsubscribeKeyboard = onKeyDown((key) => {
  if (key.name === 'c' && key.ctrl) {
    void quit()
    key.preventDefault()
    return
  }
  if (exiting) return

  if (currentView.value === 'settings') {
    switch (key.name) {
      case 'q':
        currentView.value = 'player'
        break

      case 'up':
        settingsPanel.value?.moveSelection(-1)
        break

      case 'down':
        settingsPanel.value?.moveSelection(1)
        break

      case 'left':
      case 'right':
      case 'return':
        settingsPanel.value?.toggleSelected()
        break

      case 'c':
        void copyLyricsRequest()
        break

      default:
        return
    }

    key.preventDefault()
    return
  }

  switch (key.name) {
    case 's':
      currentView.value = 'settings'
      break

    case 'space':
      void togglePlay()
      break

    case 'left':
      void seek(-5)
      break

    case 'right':
      void seek(5)
      break

    case 'up':
      switchSong('previous')
      break

    case 'down':
      switchSong('next')
      break

    case 'q':
      void quit()
      break

    case 'm':
      cyclePlayMode()
      break

    default:
      return
  }

  key.preventDefault()
})

onUnmounted(unsubscribeKeyboard)
</script>

<template>
  <Box width="100%" height="100%" flexDirection="column" :padding="outerPadding" :gap="rootGap"
    :backgroundColor="theme.background" overflow="hidden">
    <Box :visible="currentView === 'player'" width="100%" :height="contentHeight"
      flexDirection="row" :gap="showMusicList ? 1 : 0" overflow="hidden">
      <Box
        v-if="showMusicList"
        :width="listWidth"
        height="100%"
        flexDirection="column"
        :flexShrink="0"
        :gap="sidebarGap"
        overflow="hidden"
      >
        <MusicBanner v-if="settings.showLogo" :width="listWidth" :available-height="bannerAvailableHeight"
          @height-change="bannerHeight = $event" />
        <PlaybackTime :current-time="currentTime" :duration="duration" :width="listWidth" />
        <MusicListPanel
          :songs="songs"
          :current-index="playingIndex"
          :width="listWidth"
          :available-height="listAvailableHeight"
          :metadata-by-path="metadataByPath"
        />
      </Box>

      <Box width="100%" height="100%" flexDirection="column" :flexGrow="1" :minWidth="1" overflow="hidden">
        <PlaybackTime v-if="!showMusicList && contentHeight >= 5" :current-time="currentTime"
          :duration="duration" :width="terminalWidth - outerPadding * 2" />
        <LyricsPanel :lyrics="lyrics" :active-index="activeIndex" :active-word-index="activeWordIndex"
          :content-kind="lyricsContentKind" :is-loading="lyricsLoading" :error="lyricsError" :song="song"
          :available-height="contentHeight - (!showMusicList && contentHeight >= 5 ? 1 : 0)" />
      </Box>
    </Box>

    <ProgressPanel :visible="currentView === 'player'" :current-time="currentTime"
      :duration="duration" :terminal-width="terminalWidth"
      :horizontal-padding="outerPadding" />

    <PlayerToolbar :visible="currentView === 'player'"
      :available-width="terminalWidth - outerPadding * 2" :is-playing="isPlaying"
      :play-mode="PLAY_MODE_LABELS[playMode]" />

    <SettingsPanel ref="settingsPanel" :visible="currentView === 'settings'"
      :show-logo="settings.showLogo" :available-width="terminalWidth - outerPadding * 2"
      :item-width="listWidth"
      :terminal-height="terminalHeight" :lyrics-request="lyricsRequest"
      :copy-status="lyricsRequestCopyStatus" @toggle-show-logo="toggleShowLogo" />
  </Box>
</template>
