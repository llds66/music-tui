<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text } from 'vue-termui'

const props = defineProps<{
  terminalHeight: number
  isPlaying: boolean
  playMode: string
}>()

const isCompact = computed(() => props.terminalHeight < 20)
</script>

<template>
  <Box width="100%" flexDirection="column" :flexShrink="0" :gap="1">
    <!-- 播放控制 -->
    <Box width="100%" flexDirection="row" justifyContent="center">
      <Text fg="#edc878">
        [ 上一首 ] [ {{ isPlaying ? '暂停' : '播放' }} ] [ 下一首 ]
      </Text>
    </Box>

    <!-- 正常窗口 -->
    <Box v-if="!isCompact" width="100%" flexDirection="row" justifyContent="space-between">
      <Text fg="#647583">
        空格 播放/暂停 · ← → 快进/快退 · M 切换模式 [{{ playMode }}]
      </Text>
      <Text fg="#647583">
        音量 75% · Q 退出
      </Text>
    </Box>

    <!-- 小窗口 -->
    <Text v-else fg="#647583">
      SPACE 播放/暂停 · Q 退出
    </Text>
  </Box>
</template>