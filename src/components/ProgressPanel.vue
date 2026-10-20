<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text, ProgressBar } from 'vue-termui'
import { formatTime } from '../utils/formatTime'

const props = defineProps<{
  currentTime: number
  duration: number
  terminalWidth: number
}>()

// 减去 App.vue 左右各 1 列的 padding
const progressWidth = computed(() => {
  return Math.max(1, props.terminalWidth - 2)
})
</script>

<template>
  <Box
    width="100%"
    flexDirection="column"
    :flexShrink="0"
    :gap="1"
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