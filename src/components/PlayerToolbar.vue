<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text } from 'vue-termui'
import { theme } from '../theme'

const props = defineProps<{
  terminalHeight: number
  playMode: string
  listVisible: boolean
  listFocused: boolean
}>()

const isCompact = computed(() => props.terminalHeight < 20)
</script>

<template>
  <Box width="100%" flexDirection="column" :flexShrink="0" overflow="hidden">
    <!-- 正常窗口 -->
    <Box v-if="!isCompact" width="100%" flexDirection="row">
      <Text width="100%" :fg="theme.muted" wrapMode="none" :truncate="true">
        {{ listVisible ? `Tab 切换焦点 · ↑ ↓ ${listFocused ? '选择歌曲' : '切歌'} · Enter 播放选择 · ` : '↑ ↓ 切歌 · ' }}空格 播放/暂停 · ← → 快退/快进 · M 模式 [{{ playMode }}] · Q 退出
      </Text>
    </Box>

    <!-- 小窗口 -->
    <Text v-else width="100%" :fg="theme.muted" wrapMode="none" :truncate="true">
      {{ listVisible ? 'Tab 焦点 · ↑↓ 选择/切歌 · Enter 播放 · ' : '' }}SPACE 播放/暂停 · ←→ 快退/快进 · M 模式 · Q 退出
    </Text>
  </Box>
</template>
