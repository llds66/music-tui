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
    overflow="hidden"
  >
    <Text width="100%" bold textAlign="center" wrapMode="none" truncate>{{ song.title }}</Text>
    <Text width="100%" fg="#9aabb8" textAlign="center" wrapMode="none" truncate>
      {{ song.artist }} · {{ song.album }}
    </Text>
  </Box>
</template>
