<script setup lang="ts">
import { Box, Text } from 'vue-termui'
import { theme } from '../theme'
</script>

<template>
  <Box
    width="100%"
    flexDirection="row"
    justifyContent="space-between"
    :flexShrink="0"
  >
    <Text :fg="theme.primary" bold>♫ 音乐播放器</Text>
    <Text :fg="theme.muted">v0.1.1</Text>
  </Box>
</template>
