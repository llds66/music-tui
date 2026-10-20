<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text, ProgressBar } from 'vue-termui'
import { formatTime } from '../utils/formatTime'
import { theme } from '../theme'

const props = defineProps<{
  currentTime: number
  duration: number
  terminalWidth: number
  horizontalPadding: number
  compact: boolean
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
    flexDirection="column"
    :flexShrink="0"
    :gap="compact ? 0 : 1"
  >
    <Box
      width="100%"
      flexDirection="row"
      justifyContent="space-between"
    >
      <Text :fg="theme.primary">
        {{ formatTime(currentTime) }}
      </Text>

      <Text :fg="theme.secondary">
        {{ formatTime(duration) }}
      </Text>
    </Box>

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
