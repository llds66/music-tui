<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text, ProgressBar } from 'vue-termui'
import { formatTime } from '../utils/formatTime'

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
      <Text fg="#d9e0e5">
        {{ formatTime(currentTime) }}
      </Text>

      <Text fg="#9aabb8">
        {{ formatTime(duration) }}
      </Text>
    </Box>

    <ProgressBar
      :value="currentTime"
      :max="duration"
      :width="progressWidth"
      color="#edc878"
      trackColor="#34414a"
      char="━"
    />
  </Box>
</template>
