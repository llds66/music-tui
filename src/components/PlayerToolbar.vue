<script setup lang="ts">
import { computed } from 'vue'
import stringWidth from 'string-width'
import { Box, Text, StyledText, fg, type TextChunk } from 'vue-termui'
import { theme } from '../theme'

const props = defineProps<{
  availableWidth: number
  isPlaying: boolean
  playMode: string
}>()

type Hint = { key: string; label: string; priority: number }

const hints = computed<Hint[]>(() => [
  { key: '↑↓', label: '切歌', priority: 5 },
  { key: 'Space', label: props.isPlaying ? '暂停' : '播放', priority: 4 },
  { key: '←→', label: '跳转', priority: 2 },
  { key: 'M', label: '模式', priority: 1 },
  { key: 'S', label: '设置', priority: 0 },
  { key: 'Q', label: '退出', priority: 3 },
])

function hintWidth(items: Hint[]): number {
  return items.reduce((width, item) =>
    width + stringWidth(item.key) + (item.label ? 1 + stringWidth(item.label) : 0), 0)
    + Math.max(0, items.length - 1) * stringWidth(' · ')
}

const visibleHints = computed(() => {
  const selected = [...hints.value]
  while (selected.length && hintWidth(selected) > props.availableWidth) {
    const lowest = selected.reduce((index, item, current) =>
      item.priority < selected[index]!.priority ? current : index, 0)
    selected.splice(lowest, 1)
  }

  return selected.length ? selected : props.availableWidth >= 1
    ? [{ key: 'Q', label: '', priority: 0 }]
    : []
})

const hintsWidth = computed(() => hintWidth(visibleHints.value))
const modeWidth = computed(() => stringWidth(props.playMode))
const showMode = computed(() =>
  hintWidth(hints.value) + 2 + modeWidth.value <= props.availableWidth,
)

const keyColor = fg(theme.accentSoft)
const labelColor = fg(theme.secondary)
const separatorColor = fg(theme.muted)

const hintsContent = computed(() => {
  const chunks: TextChunk[] = []
  visibleHints.value.forEach((hint, index) => {
    if (index > 0) chunks.push(separatorColor(' · '))
    chunks.push(keyColor(hint.key))
    if (hint.label) chunks.push(labelColor(` ${hint.label}`))
  })
  return new StyledText(chunks)
})
</script>

<template>
  <Box width="100%" :height="1" flexDirection="row" justifyContent="space-between"
    :flexShrink="0" overflow="hidden">
    <Text v-if="visibleHints.length" :width="hintsWidth" :flexShrink="0"
      :content="hintsContent" wrapMode="none" />
    <Text v-if="showMode" :width="modeWidth" :flexShrink="0" :fg="theme.secondary"
      :content="playMode" wrapMode="none" />
  </Box>
</template>
