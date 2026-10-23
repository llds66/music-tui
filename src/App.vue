<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { Box, onKeyDown, useExit } from 'vue-termui'

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
const currentView = ref<'player' | 'settings'>('player')
const settingsPanel = ref<InstanceType<typeof SettingsPanel> | null>(null)
const { settings, load: loadUserSettings, toggleShowLogo, flush: flushSettings } = useSettings()
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
    if (!result) return
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
  pendingDirections.length = 0
  backgroundMetadata.stop()
  close()

  await Promise.allSettled(pendingMetadataWrites)
  await metadataCache.flush()
  await flushSettings()

  // 先让 close() 引起的响应式更新完成，再销毁终端渲染器。
  await nextTick()
  exit()
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
  backgroundMetadata.stop()
  void metadataCache.flush()
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
        settingsPanel.value?.toggleSelected()
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
          :is-loading="lyricsLoading" :error="lyricsError" :song="song"
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
      :terminal-height="terminalHeight" @toggle-show-logo="toggleShowLogo" />
  </Box>
</template>
