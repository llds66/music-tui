<script setup lang="ts">
import { computed } from 'vue'
import { Box, Text } from 'vue-termui'
import { theme } from '../theme'
import { formatTime } from '../utils/formatTime'

const props = defineProps<{
  currentTime: number
  duration: number
  width: number
}>()

const elapsed = computed(() =>
  formatTime(Number.isFinite(props.currentTime) ? Math.max(0, props.currentTime) : 0),
)
const total = computed(() =>
  Number.isFinite(props.duration) && props.duration > 0
    ? formatTime(props.duration)
    : '--:--',
)
const compactTotal = computed(() => {
  const spaced = `/ ${total.value}`
  if (props.width >= elapsed.value.length + 1 + spaced.length) return spaced

  const tight = `/${total.value}`
  return props.width >= elapsed.value.length + tight.length ? tight : ''
})
</script>

<template>
  <Box width="100%" :height="1" flexDirection="row" alignItems="center"
    justifyContent="center" :gap="compactTotal.startsWith('/ ') ? 1 : 0"
    :flexShrink="0" overflow="hidden">
    <Text :fg="theme.primary" wrapMode="none" :content="elapsed" />
    <Text v-if="compactTotal" :fg="theme.secondary" wrapMode="none" :content="compactTotal" />
  </Box>
</template>
