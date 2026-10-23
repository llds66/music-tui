<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Box, Text } from 'vue-termui'
import type { MusicFile } from '../services/musicLibrary'
import { theme } from '../theme'

type SongMetadata = {
  title?: string
  artist?: string
}

const props = defineProps<{
  songs: MusicFile[]
  currentIndex: number
  width: number
  availableHeight: number
  metadataByPath: Readonly<Record<string, SongMetadata>>
}>()

const scrollOffset = ref(0)

// 标题、分隔线和一行空白占三行，歌曲之间也留一行空白。
const visibleRowCount = computed(() =>
  Math.max(1, Math.floor((props.availableHeight - 2) / 2)),
)

const visibleSongs = computed(() => {
  const start = scrollOffset.value
  const end = Math.min(
    props.songs.length,
    start + visibleRowCount.value,
  )

  return props.songs.slice(start, end).map((song, offset) => ({
    song,
    index: start + offset,
  }))
})

const indexWidth = computed(() =>
  Math.max(2, String(props.songs.length).length),
)

function ensurePlayingVisible() {
  const count = visibleRowCount.value
  const maxOffset = Math.max(0, props.songs.length - count)

  if (props.songs.length === 0) {
    scrollOffset.value = 0
    return
  }

  // 加载新歌曲期间不重置滚动；待播放器确认文件后再跟随当前播放项。
  if (props.currentIndex < 0) {
    scrollOffset.value = Math.min(scrollOffset.value, maxOffset)
    return
  }

  if (props.currentIndex < scrollOffset.value) {
    scrollOffset.value = props.currentIndex
  } else if (props.currentIndex >= scrollOffset.value + count) {
    scrollOffset.value = props.currentIndex - count + 1
  }

  scrollOffset.value = Math.min(
    Math.max(0, scrollOffset.value),
    maxOffset,
  )
}

watch(
  () => [
    props.currentIndex,
    props.songs.length,
    visibleRowCount.value,
  ],
  ensurePlayingVisible,
  { immediate: true },
)

function songText(song: MusicFile) {
  const metadata = props.metadataByPath[song.path]
  const title = metadata?.title || song.name
  const artist = metadata?.artist ? ` · ${metadata.artist}` : ''

  return `${title}${artist}`
}
</script>

<template>
  <Box
    :width="width"
    flexDirection="column"
    :flexGrow="1"
    :flexShrink="0"
    :minHeight="1"
    overflow="hidden"
  >
    <Text
      width="100%"
      :fg="theme.secondary"
      textAlign="center"
      wrapMode="none"
      :truncate="true"
    >
      播放列表
    </Text>

    <Text width="100%" :fg="theme.divider" textAlign="center" wrapMode="none">────────</Text>
    <Box width="100%" :height="1" :flexShrink="0" />

    <Text v-if="songs.length === 0" :fg="theme.muted">
      暂无本地歌曲
    </Text>

    <Box v-else width="100%" flexDirection="column" :gap="1" :flexGrow="1" overflow="hidden">
      <Box
        v-for="item in visibleSongs"
        :key="item.song.id"
        width="100%"
        flexDirection="row"
        :gap="1"
        :flexShrink="0"
        overflow="hidden"
      >
        <Text
          :width="indexWidth"
          :flexShrink="0"
          :fg="theme.index"
          wrapMode="none"
        >{{ String(item.index + 1).padStart(indexWidth, '0') }}</Text>
        <Text
          :flexGrow="1"
          :minWidth="1"
          :fg="item.index === currentIndex ? theme.accent : theme.secondary"
          :bold="item.index === currentIndex"
          wrapMode="none"
          :truncate="true"
        >{{ songText(item.song) }}</Text>
      </Box>
    </Box>
  </Box>
</template>
