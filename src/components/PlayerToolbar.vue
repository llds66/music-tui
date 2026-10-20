<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text } from 'vue-termui'

const props = defineProps<{
  terminalHeight: number
  isPlaying: boolean
  playMode: string
  listVisible: boolean
  listFocused: boolean
}>()

const isCompact = computed(() => props.terminalHeight < 20)
</script>

<template>
  <Box width="100%" flexDirection="column" :flexShrink="0" :gap="isCompact ? 0 : 1" overflow="hidden">
    <!-- 播放控制 -->
    <Box width="100%" flexDirection="row" justifyContent="center">
      <Text width="100%" fg="#edc878" textAlign="center" wrapMode="none" truncate>
        [ 上一首 ] [ {{ isPlaying ? '暂停' : '播放' }} ] [ 下一首 ]
      </Text>
    </Box>

    <!-- 正常窗口 -->
    <Box v-if="!isCompact" width="100%" flexDirection="row">
      <Text width="100%" fg="#647583" wrapMode="none" truncate>
        {{ listVisible ? `Tab 切换焦点 · ↑ ↓ ${listFocused ? '选择歌曲' : '切歌'} · Enter 播放选择 · ` : '↑ ↓ 切歌 · ' }}空格 播放/暂停 · ← → 快退/快进 · M 模式 [{{ playMode }}] · Q 退出
      </Text>
    </Box>

    <!-- 小窗口 -->
    <Text v-else width="100%" fg="#647583" wrapMode="none" truncate>
      {{ listVisible ? 'Tab 焦点 · ↑↓ 选择/切歌 · Enter 播放 · ' : '' }}SPACE 播放/暂停 · ←→ 快退/快进 · M 模式 · Q 退出
    </Text>
  </Box>
</template>
