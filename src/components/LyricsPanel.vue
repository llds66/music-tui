<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text, StyledText, bold, fg, type TextChunk } from 'vue-termui'
import stringWidth from 'string-width'
import type { LyricLine } from '../services/lyrics'

const props = defineProps<{
  lyrics: LyricLine[]
  activeIndex: number
  activeWordIndex: number
  isLoading: boolean
  error: string | null
  terminalHeight: number
}>()

// 根据终端高度调整歌词数量
const visibleLineCount = computed(() => {
  const height = props.terminalHeight

  if (height >= 30) return 7
  if (height >= 20) return 5
  if (height >= 14) return 3

  return 1
})

// 以当前歌词为中心截取可见歌词
const visibleLyrics = computed(() => {
  const count = visibleLineCount.value
  const half = Math.floor(count / 2)
  const centerIndex = Math.max(props.activeIndex, 0)

  return Array.from({ length: count }, (_, index) => {
    const lyricIndex = centerIndex - half + index
    const lyric = props.lyrics[lyricIndex]

    return {
      index: lyricIndex,
      text: lyric?.text ?? '',
      words: lyric?.words ?? [],
      active:
        props.activeIndex >= 0 &&
        lyricIndex === props.activeIndex,
    }
  })
})

const isCompact = computed(() => props.terminalHeight < 20)

const statusText = computed(() => {
  if (props.isLoading) return '正在获取歌词...'
  if (props.error) return '歌词获取失败'
  if (props.lyrics.length === 0) return '暂无同步歌词'

  return ''
})

// 当前行变化时才拼接文字并记录片段边界，保留原始空格和多字符片段。
const activeLineText = computed(() => {
  const words = props.lyrics[props.activeIndex]?.words ?? []
  const offsets = [0]
  let length = 0
  const text = words.map((word) => {
    length += word.text.length
    offsets.push(length)
    return word.text
  }).join('')

  // 固定自然列宽，保留窄终端中超宽歌词的居中裁剪。
  return { text, offsets, wordCount: words.length, width: stringWidth(text) }
})

const sung = fg('#edc878')
const current = fg('#ffe4a3')
const upcoming = fg('#62727d')

// 每次逐字推进最多生成三个富文本片段，不再创建逐字组件和布局节点。
const activeLineContent = computed(() => {
  const { text, offsets, wordCount } = activeLineText.value
  const index = props.activeWordIndex
  const sungEnd = offsets[Math.max(0, Math.min(index, wordCount))]!
  const currentEnd = offsets[Math.max(0, Math.min(index + 1, wordCount))]!
  const chunks: TextChunk[] = []

  if (sungEnd > 0) chunks.push(sung(text.slice(0, sungEnd)))
  if (currentEnd > sungEnd) {
    chunks.push(bold(current(text.slice(sungEnd, currentEnd))))
  }
  if (currentEnd < text.length) chunks.push(upcoming(text.slice(currentEnd)))

  // 重新赋值使 OpenTUI 的 content setter 更新文字缓冲区，避免原地修改 chunks。
  return new StyledText(chunks)
})
</script>

<template>
  <Box width="100%" flexDirection="column" :flexGrow="1" :flexShrink="1" :minHeight="3" border borderStyle="rounded"
    borderColor="#34414a" alignItems="center" justifyContent="center" overflow="hidden" :gap="isCompact ? 0 : 1">
    <Text v-if="statusText" fg="#62727d">
      {{ statusText }}
    </Text>

    <template v-else>
      <template v-for="line in visibleLyrics" :key="line.index">
        <!-- 当前行：单个 Text 显示逐字富文本，由外层 Box 保持居中 -->
        <Text v-if="line.active && line.words.length > 0" :content="activeLineContent" :width="activeLineText.width"
          wrapMode="none" />

        <!-- 其他歌词行 -->
        <Text v-else :fg="line.active ? '#edc878' : '#62727d'" :bold="line.active">{{ line.text || ' ' }}</Text>
      </template>
    </template>
  </Box>
</template>
