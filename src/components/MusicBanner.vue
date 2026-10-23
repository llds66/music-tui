<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { banner, fonts } from 'ascii.rest/banner'
import { Box, Text } from 'vue-termui'

const props = defineProps<{
  width: number
  availableHeight: number
}>()

const emit = defineEmits<{
  (event: 'height-change', height: number): void
}>()

const title = 'Music.TUI'
const orange = '#f97316'
// slim 的三列 M 近似 H；借用同为五行的 block 字形保留斜笔画。
const logoFont = {
  ...fonts.slim,
  glyphs: { ...fonts.slim.glyphs, M: fonts.block.glyphs.M },
}

// 保留现有的扫光速度、填充字符和其余 slim 字形。
const options = {
  pixel: 1,
  shadow: 'none',
  fill: '▒',
  color: orange,
  effect: 'glint',
  speed: 1.8,
} as const

const variants = [
  banner(title, { ...options, font: logoFont, gap: 2 }),
  banner(title, { ...options, font: logoFont, gap: 1 }),
  banner(title, { ...options, font: logoFont, gap: 0 }),
]

// 为播放列表保留标题、分隔线和至少四行歌曲。
const selectedBanner = computed(() =>
  variants.find((piece) =>
    piece.meta.cols <= props.width &&
    props.availableHeight >= piece.meta.rows + 2 + 6,
  ),
)

const occupiedHeight = computed(() =>
  selectedBanner.value ? selectedBanner.value.meta.rows : 1,
)

watch(occupiedHeight, (height) => emit('height-change', height), { immediate: true })

const frame = ref('')
let timer: ReturnType<typeof setInterval> | undefined

function stopTimer() {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

watch(selectedBanner, (piece) => {
  stopTimer()
  if (!piece) {
    frame.value = ''
    return
  }

  const render = piece.default()
  const startedAt = performance.now()

  function draw() {
    frame.value = render((performance.now() - startedAt) / 1000)
  }

  draw()
  // 官网 fast 模式以 15 fps 更新；扫光周期由 ascii.rest 的帧函数负责。
  timer = setInterval(draw, 1000 / 15)
}, { immediate: true })

onUnmounted(stopTimer)
</script>

<template>
  <Box width="100%" :height="occupiedHeight" flexDirection="column" alignItems="center"
    :flexShrink="0" overflow="hidden">
    <Text v-if="selectedBanner" :width="selectedBanner.meta.cols" :height="selectedBanner.meta.rows"
      :content="frame" :fg="orange" wrapMode="none" />
    <Text v-else width="100%" :fg="orange" bold textAlign="center" wrapMode="none" :truncate="true">
      {{ title }}
    </Text>
  </Box>
</template>
