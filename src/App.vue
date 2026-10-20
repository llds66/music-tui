<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { resolve } from 'node:path'
import { Box, onKeyDown, useExit } from 'vue-termui'

import PlayerHeader from './components/PlayerHeader.vue'
import SongInfo from './components/SongInfo.vue'
import LyricsPanel from './components/LyricsPanel.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import PlayerToolbar from './components/PlayerToolbar.vue'

import { useTerminalSize } from './composables/useTerminalSize'
import { usePlayer } from './composables/usePlayer'
import { useMusicLibrary } from './composables/useMusicLibrary'
import { useLyrics } from './composables/useLyrics'
import { PLAY_MODE_LABELS } from './composables/useMusicLibrary'

const { terminalHeight, terminalWidth } = useTerminalSize()


const {
  song,
  isPlaying,
  currentTime,
  duration,
  isReady,
  init,
  loadSong,
  togglePlay,
  seek,
  close,
  onEnded
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

let switching = false

/**
 * 启动时扫描目录并播放第一首
 */
onMounted(async () => {
  await loadDirectory(musicDirectory)

  const firstSong = songs.value[0]

  if (!firstSong) return

  await init(firstSong.path)
})

/**
 * 切换音乐
 */
async function switchSong(direction: 'next' | 'previous') {
  if (!isReady.value || switching || songs.value.length === 0) {
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
 * 键盘控制
 */
onKeyDown((key) => {
  switch (key.name) {
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
      void switchSong('previous')
      break

    case 'down':
      void switchSong('next')
      break

    case 'q':
      close()
      exit()
      break

    case 'm':
      cyclePlayMode()
      break

    default:
      return
  }

  key.preventDefault()
})
</script>

<template>
  <Box width="100%" height="100%" flexDirection="column" :padding="1" :gap="1">
    <PlayerHeader />

    <SongInfo :song="song" />

    <LyricsPanel :lyrics="lyrics" :active-index="activeIndex" :active-word-index="activeWordIndex"
      :is-loading="lyricsLoading" :error="lyricsError" :terminal-height="terminalHeight" />

    <ProgressPanel :current-time="currentTime" :duration="duration" :terminal-width="terminalWidth" />

    <PlayerToolbar :terminal-height="terminalHeight" :is-playing="isPlaying" :play-mode="PLAY_MODE_LABELS[playMode]" />
  </Box>
</template>
