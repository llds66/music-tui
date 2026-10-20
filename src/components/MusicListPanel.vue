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
  selectedIndex: number
  isFocused: boolean
  width: number
  availableHeight: number
  metadataByPath: Readonly<Record<string, SongMetadata>>
}>()

const scrollOffset = ref(0)

// 标题和短分隔线占两行，其余空间全部用于歌曲窗口。
const visibleRowCount = computed(() =>
  Math.max(1, props.availableHeight - 2),
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

function ensureSelectedVisible() {
  const count = visibleRowCount.value
  const maxOffset = Math.max(0, props.songs.length - count)

  if (props.selectedIndex < 0 || props.songs.length === 0) {
    scrollOffset.value = 0
    return
  }

  if (props.selectedIndex < scrollOffset.value) {
    scrollOffset.value = props.selectedIndex
  } else if (props.selectedIndex >= scrollOffset.value + count) {
    scrollOffset.value = props.selectedIndex - count + 1
  }

  scrollOffset.value = Math.min(
    Math.max(0, scrollOffset.value),
    maxOffset,
  )
}

watch(
  () => [
    props.selectedIndex,
    props.songs.length,
    visibleRowCount.value,
  ],
  ensureSelectedVisible,
  { immediate: true },
)

function rowText(song: MusicFile, index: number) {
  const metadata = props.metadataByPath[song.path]
  const marker = index === props.currentIndex
    ? '▸'
    : index === props.selectedIndex ? '›' : ' '
  const number = String(index + 1).padStart(indexWidth.value, ' ')
  const title = metadata?.title || song.name
  const artist = metadata?.artist ? ` · ${metadata.artist}` : ''

  return `${marker} ${number}. ${title}${artist}`
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
      :fg="isFocused ? theme.primary : theme.secondary"
      :bold="isFocused"
      wrapMode="none"
      :truncate="true"
    >
      播放列表
    </Text>

    <Text :fg="theme.divider" wrapMode="none">────────</Text>

    <Text v-if="songs.length === 0" :fg="theme.muted">
      暂无本地歌曲
    </Text>

    <Text
      v-for="item in visibleSongs"
      v-else
      :key="item.song.id"
      width="100%"
      :fg="item.index === currentIndex ? theme.accent : item.index === selectedIndex ? theme.primary : theme.secondary"
      :bold="item.index === currentIndex || item.index === selectedIndex"
      wrapMode="none"
      :truncate="true"
    >
      {{ rowText(item.song, item.index) }}
    </Text>
  </Box>
</template>
