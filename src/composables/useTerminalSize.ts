import { onMounted, onUnmounted, ref } from 'vue'

export function useTerminalSize() {
  const terminalHeight = ref(process.stdout.rows || 24)
  const terminalWidth = ref(process.stdout.columns || 80)

  function updateTerminalSize() {
    terminalHeight.value = process.stdout.rows || 24
    terminalWidth.value = process.stdout.columns || 80
  }

  onMounted(() => {
    process.stdout.on('resize', updateTerminalSize)
  })

  onUnmounted(() => {
    process.stdout.off('resize', updateTerminalSize)
  })

  return {
    terminalHeight,
    terminalWidth,
  }
}