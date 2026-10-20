export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)

  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}