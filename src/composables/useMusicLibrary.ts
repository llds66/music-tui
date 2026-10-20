
import { ref } from 'vue'
import {
    scanMusicDirectory,
    type MusicFile,
} from '../services/musicLibrary'

export type PlayMode = 'sequential' | 'loop' | 'single'

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
    sequential: '顺序播放',
    loop: '列表循环',
    single: '单曲循环',
}

export function useMusicLibrary() {
    const songs = ref<MusicFile[]>([])
    const currentIndex = ref(-1)
    const isScanning = ref(false)
    const error = ref<string | null>(null)



    /**
     * 加载指定目录的音乐
     */
    async function loadDirectory(directory: string) {
        isScanning.value = true
        error.value = null

        try {
            songs.value = await scanMusicDirectory(directory)

            currentIndex.value =
                songs.value.length > 0 ? 0 : -1
        } catch (err) {
            songs.value = []
            currentIndex.value = -1

            error.value =
                err instanceof Error ? err.message : String(err)
        } finally {
            isScanning.value = false
        }
    }

    /**
     * 获取指定索引的音乐
     */
    function getSong(index: number): MusicFile | null {
        return songs.value[index] ?? null
    }

    /**
     * 选择音乐
     */
    function selectSong(index: number): MusicFile | null {
        const song = getSong(index)

        if (!song) return null

        currentIndex.value = index
        return song
    }

    /**
     * 选择下一首，循环到列表开头
     */
    function nextSong(): MusicFile | null {
        if (songs.value.length === 0) return null

        const nextIndex =
            (currentIndex.value + 1) % songs.value.length

        return selectSong(nextIndex)
    }

    /**
     * 选择上一首，循环到列表末尾
     */
    function previousSong(): MusicFile | null {
        if (songs.value.length === 0) return null

        const previousIndex =
            (currentIndex.value - 1 + songs.value.length) %
            songs.value.length

        return selectSong(previousIndex)
    }

    const playMode = ref<PlayMode>('loop')

    function cyclePlayMode() {
        const modes: PlayMode[] = ['sequential', 'loop', 'single']
        const index = modes.indexOf(playMode.value)

        playMode.value = modes[(index + 1) % modes.length]!
    }

    /**
     * 歌曲自然播放完成后，计算下一首
     * 不修改索引，等加载成功后再更新
     */
    function getAutoNextIndex(): number | null {
        const count = songs.value.length

        if (count === 0 || currentIndex.value < 0) {
            return null
        }

        switch (playMode.value) {
            case 'single':
                return currentIndex.value

            case 'loop':
                return (currentIndex.value + 1) % count

            case 'sequential':
                return currentIndex.value + 1 < count
                    ? currentIndex.value + 1
                    : null
        }
    }

    return {
        songs,
        currentIndex,
        isScanning,
        error,
        loadDirectory,
        getSong,
        selectSong,
        nextSong,
        previousSong,
        playMode,
        cyclePlayMode,
        getAutoNextIndex,
    }
}
