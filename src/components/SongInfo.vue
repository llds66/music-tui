<script setup lang="ts">
import { Box, Text } from 'vue-termui'

defineProps<{
  song: {
    title: string
    artist: string
    album: string
  }
}>()
</script>

<template>
  <Box
    width="100%"
    flexDirection="column"
    alignItems="center"
    :flexShrink="0"
    :paddingY="1"
  >
    <Text bold>{{ song.title }}</Text>
    <Text fg="#9aabb8">
      {{ song.artist }} · {{ song.album }}
    </Text>
  </Box>
</template>