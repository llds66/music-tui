<script setup lang="ts">
import { computed, ref } from 'vue'
import stringWidth from 'string-width'
import { Box, Text, StyledText, fg, type TextChunk } from 'vue-termui'
import { theme } from '../theme'
import type { LyricsRequestDetails } from '../services/lyrics'
import {
  LYRICS_PROVIDER_LABELS,
  type LyricsProvider,
} from '../services/lyricsProvider'

const props = defineProps<{
  showLogo: boolean
  availableWidth: number
  itemWidth: number
  terminalHeight: number
  lyricsRequest: LyricsRequestDetails | null
  lyricsProvider: LyricsProvider
  lyricsRequestStatus: string | null
  copyStatus: string | null
}>()

const emit = defineEmits<{
  (event: 'toggle-show-logo'): void
  (event: 'clear-cache'): void
  (event: 'reset-settings'): void
  (event: 'cycle-lyrics-provider', direction: -1 | 1): void
}>()

const items = [
  { id: 'showLogo', label: '显示 Logo' },
  { id: 'clearCache', label: '清空缓存' },
  { id: 'resetSettings', label: '恢复默认设置' },
  { id: 'lyricsProvider', label: '歌词来源' },
] as const
type ItemId = (typeof items)[number]['id']
type DataActionId = Extract<ItemId, 'clearCache' | 'resetSettings'>

const selectedIndex = ref(0)
const pendingAction = ref<DataActionId | null>(null)
const dataActionStatus = ref<{ action: DataActionId; text: string } | null>(null)

const requestParameters = computed(() => {
  if (!props.lyricsRequest) return []
  if (props.lyricsRequest.provider !== 'auto') return props.lyricsRequest.parameters

  return [
    ...props.lyricsRequest.parameters,
    {
      name: 'provider',
      value: 'auto（默认，未传）',
    },
  ]
})
// 让设置在常规窗口中有清晰的分组层次，同时避免矮终端裁掉调试信息。
const settingItemGap = computed(() =>
  props.terminalHeight >= 18 ? 2 : props.terminalHeight >= 11 ? 1 : 0,
)
const groupContentGap = computed(() => props.terminalHeight >= 10 ? 1 : 0)
const contentItemGap = computed(() => props.terminalHeight >= 12 ? 1 : 0)

function moveSelection(direction: -1 | 1): void {
  selectedIndex.value = (selectedIndex.value + direction + items.length) % items.length
  pendingAction.value = null
}

function toggleSelected(direction: -1 | 1): void {
  const id = items[selectedIndex.value]?.id
  if (id === 'showLogo') emit('toggle-show-logo')
  else if (id === 'lyricsProvider') emit('cycle-lyrics-provider', direction)
}

function activateSelected(): void {
  const id = items[selectedIndex.value]?.id
  if (id === 'showLogo') {
    emit('toggle-show-logo')
    return
  }
  if (id !== 'clearCache' && id !== 'resetSettings') return

  if (pendingAction.value !== id) {
    pendingAction.value = id
    return
  }

  pendingAction.value = null
  if (id === 'clearCache') emit('clear-cache')
  else emit('reset-settings')
}

function dataActionLabel(id: DataActionId): string {
  const status = dataActionStatus.value
  if (status?.action === id && status.text) return `[${status.text}]`
  if (pendingAction.value === id) return '[再次 Enter 确认]'
  return '[Enter]'
}

defineExpose({
  moveSelection,
  toggleSelected,
  activateSelected,
  showDataActionStatus: (action: DataActionId, text: string) => {
    dataActionStatus.value = { action, text }
  },
})

type Hint = { key: string; label: string; priority: number }
const hints: Hint[] = [
  { key: '↑↓', label: '选择', priority: 1 },
  { key: 'C', label: '复制 URL', priority: 2 },
  { key: 'Enter', label: '执行', priority: 3 },
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
    overflow="hidden">
    <Box width="100%" flexDirection="column" :flexGrow="1" overflow="hidden">
      <Box width="100%" :height="1" :flexShrink="0" overflow="hidden">
        <Text :fg="theme.primary" bold wrapMode="none">基本设置</Text>
      </Box>
      <template v-for="(item, index) in items" :key="item.id">
        <Box v-if="item.id === 'clearCache' || item.id === 'lyricsProvider'" width="100%" :height="1"
          :marginTop="settingItemGap" :flexShrink="0" overflow="hidden">
          <Text :fg="theme.primary" bold wrapMode="none">{{ item.id === 'clearCache' ? '数据管理' : '歌词请求 API' }}</Text>
        </Box>

        <Box :width="Math.min(itemWidth, availableWidth)" :height="1"
          flexDirection="row" :gap="1"
          :marginTop="item.id === 'showLogo' || item.id === 'clearCache' || item.id === 'lyricsProvider' ? groupContentGap : item.id === 'resetSettings' ? contentItemGap : 0"
          :flexShrink="0" overflow="hidden">
          <Text :fg="index === selectedIndex ? theme.accentSoft : theme.muted" :width="1" wrapMode="none">›</Text>
          <Text :fg="index === selectedIndex ? theme.primary : theme.secondary"
            :flexGrow="1" :minWidth="1" wrapMode="none" :truncate="true">{{ item.label }}</Text>
          <Text v-if="item.id === 'showLogo'" :fg="showLogo ? theme.accentSoft : theme.secondary" :flexShrink="0"
            wrapMode="none">{{ showLogo ? '[开启]' : '[关闭]' }}</Text>
          <Text v-else-if="item.id === 'clearCache' || item.id === 'resetSettings'" :fg="theme.accentSoft"
            :flexShrink="0" wrapMode="none">{{ dataActionLabel(item.id) }}</Text>
          <Text v-else-if="item.id === 'lyricsProvider'" :fg="theme.accentSoft"
            :flexShrink="0" wrapMode="none">[{{ LYRICS_PROVIDER_LABELS[lyricsProvider] }}]</Text>
        </Box>

        <Box v-if="item.id === 'lyricsProvider'" width="100%" flexDirection="column"
          :marginTop="contentItemGap" :gap="contentItemGap" :flexShrink="0" overflow="hidden">
          <Text v-if="!lyricsRequest" :fg="theme.muted" wrapMode="none">  请求参数：等待当前歌曲元数据</Text>
          <Text v-else :fg="theme.muted" width="100%" wrapMode="none" :truncate="true">  请求参数：{{ requestParameters.map((parameter) => `${parameter.name}: ${parameter.value}`).join(' · ') }}</Text>

          <Text :fg="theme.secondary" width="100%" wrapMode="none" :truncate="true">  请求 URL {{ copyStatus
            ?? (lyricsRequest ? '[按 C 复制]' : '无请求') }}</Text>
          <Text :fg="theme.secondary" width="100%" wrapMode="none" :truncate="true">  请求状态：{{ lyricsRequestStatus ?? '未请求' }}</Text>
        </Box>
      </template>
    </Box>

    <Box width="100%" :height="1" :flexShrink="0" overflow="hidden">
      <Text v-if="visibleHints.length" :width="hintsWidth" :content="hintsContent" wrapMode="none" />
    </Box>
  </Box>
</template>
