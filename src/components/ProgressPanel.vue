<script setup lang="ts">
import { computed } from 'vue'
import { Box, ProgressBar } from 'vue-termui'
import { theme } from '../theme'

const props = defineProps<{
  currentTime: number
  duration: number
  terminalWidth: number
  horizontalPadding: number
}>()

// 扣除 App.vue 的水平内边距，避免窄终端下进度条越界。
const progressWidth = computed(() => {
  return Math.max(
    1,
    props.terminalWidth - props.horizontalPadding * 2,
  )
})
</script>

<template>
  <Box
    width="100%"
    :flexShrink="0"
  >
    <ProgressBar
      :value="currentTime"
      :max="duration"
      :width="progressWidth"
      :color="theme.accent"
      :trackColor="theme.divider"
      char="━"
    />
  </Box>
</template>
