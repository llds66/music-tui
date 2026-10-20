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
import { resolve } from 'node:path'
import { Box, onKeyDown, useExit } from 'vue-termui'

import LyricsPanel from './components/LyricsPanel.vue'
import MusicListPanel from './components/MusicListPanel.vue'
import PlayerHeader from './components/PlayerHeader.vue'
import PlayerToolbar from './components/PlayerToolbar.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import SongInfo from './components/SongInfo.vue'

import { useLyrics } from './composables/useLyrics'
import {
  PLAY_MODE_LABELS,
  useMusicLibrary,
} from './composables/useMusicLibrary'
import { usePlayer } from './composables/usePlayer'
import { useTerminalSize } from './composables/useTerminalSize'

const { terminalHeight, terminalWidth } = useTerminalSize()

const {
  song,
  isPlaying,
  currentTime,
  duration,
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
  currentIndex,
  playMode,
  loadDirectory,
  nextSong,
  previousSong,
  cyclePlayMode,
  getAutoNextIndex,
  selectSong,
} = useMusicLibrary()

const exit = useExit()
const musicDirectory = resolve(process.cwd(), 'music')

type FocusArea = 'list' | 'player'
type KnownMetadata = { title?: string; artist?: string }

const focusArea = ref<FocusArea>('player')
const selectedIndex = ref(-1)
const metadataByPath = reactive<Record<string, KnownMetadata>>({})

const outerPadding = computed(() =>
  terminalHeight.value >= 12 && terminalWidth.value >= 40 ? 1 : 0,
)
const rootGap = computed(() => terminalHeight.value >= 16 ? 1 : 0)
const showHeader = computed(() => terminalHeight.value >= 9)
const progressHeight = computed(() => terminalHeight.value >= 16 ? 3 : 2)
const toolbarHeight = computed(() => terminalHeight.value >= 20 ? 3 : 2)
const contentHeight = computed(() => {
  const childCount = showHeader.value ? 4 : 3
  const fixedHeight =
    outerPadding.value * 2 +
    (showHeader.value ? 1 : 0) +
    progressHeight.value +
    toolbarHeight.value +
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
const playingIndex = computed(() =>
  songs.value.findIndex((item) => item.path === loadedPath.value),
)

let switching = false
let exiting = false

/**
 * 启动时扫描目录并播放第一首
 */
onMounted(async () => {
  await loadDirectory(musicDirectory)

  const firstSong = songs.value[0]
  if (!firstSong) return

  selectedIndex.value = currentIndex.value
  await init(firstSong.path)
})

watch(showMusicList, (visible) => {
  if (!visible) focusArea.value = 'player'
})

watch(currentIndex, (index) => {
  if (index < 0) {
    selectedIndex.value = -1
  } else if (
    selectedIndex.value < 0 ||
    focusArea.value === 'player'
  ) {
    selectedIndex.value = index
  }
})

// 复用 mpv 已读取的元数据；歌曲播放过后，列表会保留其标题和歌手。
watch(
  () => [loadedPath.value, song.value.title, song.value.artist] as const,
  ([path, title, artist]) => {
    if (!path || !title || title === '正在加载...') return

    metadataByPath[path] = {
      title: title === '未知歌曲' ? undefined : title,
      artist:
        !artist || artist === '未知歌手'
          ? undefined
          : artist,
    }
  },
)

/**
 * 切换音乐
 */
async function switchSong(direction: 'next' | 'previous') {
  if (
    !isReady.value ||
    playerLoading.value ||
    switching ||
    songs.value.length === 0
  ) {
    return
  }

  switching = true

  try {
    const target =
      direction === 'next' ? nextSong() : previousSong()

    if (!target) return

    await loadSong(target.path)
  } finally {
    switching = false
  }
}

function moveSelection(direction: -1 | 1) {
  const count = songs.value.length
  if (count === 0) return

  const current = selectedIndex.value >= 0
    ? selectedIndex.value
    : Math.max(currentIndex.value, 0)

  selectedIndex.value = (current + direction + count) % count
}

async function playSelectedSong() {
  const index = selectedIndex.value
  const target = songs.value[index]

  if (
    !target ||
    !isReady.value ||
    playerLoading.value ||
    switching ||
    index === playingIndex.value
  ) {
    return
  }

  switching = true

  try {
    await loadSong(target.path)
    selectSong(index)
  } finally {
    switching = false
  }
}

async function quit() {
  if (exiting) return

  exiting = true
  close()

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
    }
  })()
})

onUnmounted(unsubscribeEnded)

/**
 * 所有快捷键只在根组件注册一次，列表组件仅负责显示。
 */
const unsubscribeKeyboard = onKeyDown((key) => {
  switch (key.name) {
    case 'tab':
      if (!showMusicList.value) return
      focusArea.value = focusArea.value === 'list' ? 'player' : 'list'
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
      if (focusArea.value === 'list') {
        moveSelection(-1)
      } else {
        void switchSong('previous')
      }
      break

    case 'down':
      if (focusArea.value === 'list') {
        moveSelection(1)
      } else {
        void switchSong('next')
      }
      break

    case 'return':
    case 'enter':
      if (focusArea.value !== 'list') return
      void playSelectedSong()
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
  <Box width="100%" height="100%" flexDirection="column" :padding="outerPadding" :gap="rootGap" overflow="hidden">
    <PlayerHeader v-if="showHeader" />

    <Box width="100%" :height="contentHeight" flexDirection="row" :gap="showMusicList ? 1 : 0" overflow="hidden">
      <MusicListPanel
        v-if="showMusicList"
        :songs="songs"
        :current-index="playingIndex"
        :selected-index="selectedIndex"
        :is-focused="focusArea === 'list'"
        :width="listWidth"
        :available-height="contentHeight"
        :metadata-by-path="metadataByPath"
      />

      <Box width="100%" height="100%" flexDirection="column" :flexGrow="1" :minWidth="1" overflow="hidden">
        <SongInfo v-if="contentHeight >= 7" :song="song" />

        <LyricsPanel :lyrics="lyrics" :active-index="activeIndex" :active-word-index="activeWordIndex"
          :is-loading="lyricsLoading" :error="lyricsError" :terminal-height="terminalHeight" />
      </Box>
    </Box>

    <ProgressPanel :current-time="currentTime" :duration="duration" :terminal-width="terminalWidth"
      :horizontal-padding="outerPadding" :compact="terminalHeight < 16" />

    <PlayerToolbar :terminal-height="terminalHeight" :is-playing="isPlaying"
      :play-mode="PLAY_MODE_LABELS[playMode]" :list-visible="showMusicList" :list-focused="focusArea === 'list'" />
  </Box>
</template>
