<script setup lang="ts">
import { computed, ref } from 'vue'
import stringWidth from 'string-width'
import { Box, Text, StyledText, fg, type TextChunk } from 'vue-termui'
import { theme } from '../theme'
import type { LyricsRequestDetails } from '../services/lyrics'

const props = defineProps<{
  showLogo: boolean
  availableWidth: number
  itemWidth: number
  terminalHeight: number
  lyricsRequest: LyricsRequestDetails | null
  copyStatus: string | null
}>()

const emit = defineEmits<{
  (event: 'toggle-show-logo'): void
}>()

const items = [
  { id: 'showLogo', label: '显示 Logo' },
  { id: 'lyricsDebug', label: '歌词请求 API' },
] as const
const selectedIndex = ref(0)

const requestParameters = computed(() => props.lyricsRequest?.parameters ?? [])
// 让设置在常规窗口中有清晰的分组层次，同时避免矮终端裁掉调试信息。
const titleToItemsGap = computed(() => props.terminalHeight >= 10 ? 1 : 0)
const settingItemGap = computed(() =>
  props.terminalHeight >= 18 ? 2 : props.terminalHeight >= 11 ? 1 : 0,
)
const groupContentGap = computed(() => props.terminalHeight >= 10 ? 1 : 0)
const contentItemGap = computed(() => props.terminalHeight >= 12 ? 1 : 0)

function moveSelection(direction: -1 | 1): void {
  selectedIndex.value = (selectedIndex.value + direction + items.length) % items.length
}

function toggleSelected(): void {
  if (items[selectedIndex.value]?.id === 'showLogo') emit('toggle-show-logo')
}

defineExpose({
  moveSelection,
  toggleSelected,
})

type Hint = { key: string; label: string; priority: number }
const hints: Hint[] = [
  { key: '↑↓', label: '选择', priority: 1 },
  { key: 'C', label: '复制 URL', priority: 2 },
  { key: 'Enter', label: '切换', priority: 3 },
  { key: '←→', label: '切换', priority: 4 },
  { key: 'Q', label: '返回', priority: 5 },
]

function hintWidth(items: Hint[]): number {
  return items.reduce((width, item) =>
    width + stringWidth(item.key) + (item.label ? 1 + stringWidth(item.label) : 0), 0)
    + Math.max(0, items.length - 1) * stringWidth(' · ')
}

const visibleHints = computed(() => {
  const selected = [...hints]
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
  <Box width="100%" height="100%" flexDirection="column"
    :gap="titleToItemsGap" overflow="hidden">
    <Box width="100%" :height="1" justifyContent="center" :flexShrink="0" overflow="hidden">
      <Text :fg="theme.primary" bold wrapMode="none" :truncate="true">MUSIC.TUI 设置</Text>
    </Box>

    <Box width="100%" flexDirection="column" :flexGrow="1" overflow="hidden">
      <Box v-for="(item, index) in items" :key="item.id"
        :width="Math.min(itemWidth, availableWidth)" :height="1"
        flexDirection="row" :gap="1" :marginTop="item.id === 'lyricsDebug' ? settingItemGap : 0"
        :flexShrink="0" overflow="hidden">
        <Text :fg="index === selectedIndex ? theme.accentSoft : theme.muted" :width="1" wrapMode="none">›</Text>
        <Text :fg="index === selectedIndex ? theme.primary : theme.secondary"
          :flexGrow="1" :minWidth="1" wrapMode="none" :truncate="true">{{ item.label }}</Text>
        <Text v-if="item.id === 'showLogo'" :fg="showLogo ? theme.accentSoft : theme.secondary" :flexShrink="0"
          wrapMode="none">{{ showLogo ? '[开启]' : '[关闭]' }}</Text>
      </Box>

      <Box width="100%" flexDirection="column" :marginTop="groupContentGap" :gap="contentItemGap"
        :flexShrink="0" overflow="hidden">
        <Text v-if="!lyricsRequest" :fg="theme.muted" wrapMode="none">  请求参数：等待当前歌曲元数据</Text>
        <Text v-else :fg="theme.muted" width="100%" wrapMode="none" :truncate="true">  请求参数：{{ requestParameters.map((parameter) => `${parameter.name}: ${parameter.value}`).join(' · ') }}</Text>

        <Text :fg="theme.secondary" width="100%" wrapMode="none" :truncate="true">  请求 URL {{ copyStatus
          ?? (lyricsRequest ? '[按 C 复制]' : '无请求') }}</Text>
      </Box>
    </Box>

    <Box width="100%" :height="1" :flexShrink="0" overflow="hidden">
      <Text v-if="visibleHints.length" :width="hintsWidth" :content="hintsContent" wrapMode="none" />
    </Box>
  </Box>
</template>
