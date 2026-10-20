<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Box, Text } from 'vue-termui'
import type { MusicFile } from '../services/musicLibrary'

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

// 边框占两行，标题占一行，其余空间全部用于歌曲窗口。
const visibleRowCount = computed(() =>
  Math.max(1, props.availableHeight - 3),
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
  const marker = index === props.currentIndex ? '▶' : ' '
  const number = String(index + 1).padStart(indexWidth.value, ' ')
  const title = metadata?.title || song.name
  const artist = metadata?.artist ? ` · ${metadata.artist}` : ''

  return `${marker} ${number}. ${title}${artist}`
}
</script>

<template>
  <Box
    :width="width"
    height="100%"
    flexDirection="column"
    :flexShrink="0"
    border
    borderStyle="rounded"
    :borderColor="isFocused ? '#edc878' : '#34414a'"
    overflow="hidden"
  >
    <Text
      width="100%"
      :fg="isFocused ? '#edc878' : '#9aabb8'"
      :bold="isFocused"
      textAlign="center"
      wrapMode="none"
      truncate
    >
      歌曲列表{{ isFocused ? ' · 已聚焦' : '' }}
    </Text>

    <Text v-if="songs.length === 0" fg="#62727d">
      暂无本地歌曲
    </Text>

    <Text
      v-for="item in visibleSongs"
      v-else
      :key="item.song.id"
      width="100%"
      :fg="item.index === currentIndex ? '#edc878' : item.index === selectedIndex ? '#67d9ef' : '#9aabb8'"
      :bg="item.index === selectedIndex ? '#28323a' : undefined"
      :bold="item.index === currentIndex || item.index === selectedIndex"
      wrapMode="none"
      truncate
    >
      {{ rowText(item.song, item.index) }}
    </Text>
  </Box>
</template>
