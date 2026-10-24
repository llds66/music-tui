export const LYRICS_PROVIDERS = [
  'auto',
  'netease',
  'qq',
  'apple',
  'youtube_music',
  'kugou',
  'lrclib',
  'amll',
] as const

export type LyricsProvider = (typeof LYRICS_PROVIDERS)[number]

export const LYRICS_PROVIDER_LABELS: Record<LyricsProvider, string> = {
  auto: '自动',
  netease: '网易云',
  qq: 'QQ 音乐',
  apple: 'Apple Music',
  youtube_music: 'YouTube Music',
  kugou: '酷狗',
  lrclib: 'LRCLIB',
  amll: 'AMLL',
}

export function isLyricsProvider(value: unknown): value is LyricsProvider {
  return typeof value === 'string' && (LYRICS_PROVIDERS as readonly string[]).includes(value)
}
