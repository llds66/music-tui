
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { connect, type Socket } from 'node:net'

export type MpvProperty = 'time-pos' | 'duration' | 'pause'

export type MpvPropertyEvent = {
    name: MpvProperty
    data: number | boolean | null
}

export type MpvLifecycleEvent =
    | { name: 'file-loaded' }
    | { name: 'end-file'; reason: string }

type PropertyListener = (event: MpvPropertyEvent) => void
type LifecycleListener = (event: MpvLifecycleEvent) => void

type MpvResponse = {
    request_id?: number
    error?: string
    data?: unknown
    event?: string
    name?: string
    reason?: string
}

type PendingRequest = {
    resolve: (value: unknown) => void
    reject: (reason: Error) => void
    timer: ReturnType<typeof setTimeout>
}

export class MpvService {
    private process: ChildProcess | null = null
    private socket: Socket | null = null
    private buffer = ''
    private requestId = 0

    private readonly pipeName = `\\\\.\\pipe\\tui-music-${randomUUID()}`

    private pending = new Map<number, PendingRequest>()
    private propertyListeners = new Set<PropertyListener>()
    private lifecycleListeners = new Set<LifecycleListener>()

    /**
     * 启动 mpv 并建立 IPC 连接
     */
    async start(metadataOnly = false): Promise<void> {
        if (this.socket) return

        this.process = spawn(
            'mpv.exe',
            [
                '--no-video',
                '--idle=yes',
                '--force-window=no',
                ...(metadataOnly ? ['--no-config', '--ao=null', '--pause'] : []),
                `--input-ipc-server=${this.pipeName}`,
            ],
            {
                stdio: 'ignore',
                windowsHide: true,
            },
        )

        // spawn 失败时仍由下方的连接超时路径报告，避免未处理的 error 事件。
        this.process.on('error', () => {})

        for (let i = 0; i < 50; i++) {
            if (this.process.exitCode !== null) {
                throw new Error('mpv 进程已退出')
            }

            try {
                await this.connect()
                return
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
        }

        this.close()
        throw new Error('连接 mpv IPC 超时')
    }

    /**
     * 连接 Windows 命名管道
     */
    private connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = connect(this.pipeName)

            socket.once('connect', () => {
                this.socket = socket

                socket.on('data', (chunk: Buffer) => {
                    this.handleData(chunk.toString('utf8'))
                })

                socket.on('close', () => {
                    if (this.socket === socket) {
                        this.socket = null
                    }

                    this.rejectPending(new Error('mpv IPC 连接已关闭'))
                })

                socket.on('error', () => {
                    // 连接后的异常由 close 事件统一处理
                })

                resolve()
            })

            socket.once('error', reject)
        })
    }

    /**
     * 解析 mpv IPC 消息
     */
    private handleData(data: string): void {
        this.buffer += data

        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() ?? ''

        for (const line of lines) {
            if (!line.trim()) continue

            let message: MpvResponse

            try {
                message = JSON.parse(line)
            } catch {
                continue
            }

            // 属性变化事件
            if (message.event === 'property-change') {
                if (
                    message.name === 'time-pos' ||
                    message.name === 'duration' ||
                    message.name === 'pause'
                ) {
                    const event: MpvPropertyEvent = {
                        name: message.name,
                        data:
                            typeof message.data === 'number' ||
                                typeof message.data === 'boolean'
                                ? message.data
                                : null,
                    }

                    for (const listener of this.propertyListeners) {
                        listener(event)
                    }
                }

                continue
            }

            // 文件加载完成
            if (message.event === 'file-loaded') {
                this.emitLifecycle({ name: 'file-loaded' })
                continue
            }

            // 文件播放结束、停止或加载失败
            if (message.event === 'end-file') {
                this.emitLifecycle({
                    name: 'end-file',
                    reason: message.reason ?? 'unknown',
                })
                continue
            }

            // 命令响应
            if (message.request_id === undefined) continue

            const pending = this.pending.get(message.request_id)
            if (!pending) continue

            clearTimeout(pending.timer)
            this.pending.delete(message.request_id)

            if (message.error && message.error !== 'success') {
                pending.reject(new Error(`mpv: ${message.error}`))
            } else {
                pending.resolve(message.data)
            }
        }
    }

    /**
     * 派发播放生命周期事件
     */
    private emitLifecycle(event: MpvLifecycleEvent): void {
        for (const listener of this.lifecycleListeners) {
            listener(event)
        }
    }

    /**
     * 拒绝所有等待中的 IPC 请求
     */
    private rejectPending(error: Error): void {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer)
            pending.reject(error)
        }

        this.pending.clear()
    }

    /**
     * 发送 IPC 命令
     */
    command<T = unknown>(...args: unknown[]): Promise<T> {
        if (!this.socket) {
            return Promise.reject(new Error('mpv 尚未连接'))
        }

        const socket = this.socket
        const id = ++this.requestId

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`mpv 请求超时: ${args[0]}`))
            }, 5000)

            this.pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject,
                timer,
            })

            socket.write(
                JSON.stringify({
                    command: args,
                    request_id: id,
                }) + '\n',
            )
        })
    }

    /**
     * 订阅属性变化
     */
    onPropertyChange(listener: PropertyListener): () => void {
        this.propertyListeners.add(listener)

        return () => {
            this.propertyListeners.delete(listener)
        }
    }

    /**
     * 订阅播放生命周期事件
     */
    onLifecycle(listener: LifecycleListener): () => void {
        this.lifecycleListeners.add(listener)

        return () => {
            this.lifecycleListeners.delete(listener)
        }
    }

    /**
     * 订阅指定 mpv 属性
     */
    async observeProperty(
        property: MpvProperty,
        id: number,
    ): Promise<void> {
        await this.command('observe_property', id, property)
    }

    /**
     * 订阅播放进度、总时长、暂停状态
     */
    async observePlayback(): Promise<void> {
        await Promise.all([
            this.observeProperty('time-pos', 1),
            this.observeProperty('duration', 2),
            this.observeProperty('pause', 3),
        ])
    }

    /**
     * 加载音乐
     */
    loadFile(path: string) {
        return this.command('loadfile', path, 'replace')
    }

    /**
     * 恢复播放
     */
    play() {
        return this.command('set_property', 'pause', false)
    }

    /**
     * 暂停播放
     */
    pause() {
        return this.command('set_property', 'pause', true)
    }

    /**
     * 相对跳转，单位为秒
     */
    seek(seconds: number) {
        return this.command('seek', seconds, 'relative')
    }

    /**
     * 获取当前播放位置
     */
    getCurrentTime() {
        return this.command<number | null>('get_property', 'time-pos')
    }

    /**
     * 获取歌曲总时长
     */
    getDuration() {
        return this.command<number | null>('get_property', 'duration')
    }
    /**
 * 获取媒体标题
 */
    getMediaTitle() {
        return this.command<string | null>(
            'get_property',
            'media-title',
        )
    }

    /**
     * 获取音乐文件元数据
     */
    getMetadata() {
        return this.command<Record<string, string> | null>(
            'get_property',
            'metadata',
        )
    }

    /**
     * 停止播放
     */
    stop() {
        return this.command('stop')
    }

    /**
     * 关闭播放器
     */
    close(): void {
        this.rejectPending(new Error('mpv 服务已关闭'))

        this.propertyListeners.clear()
        this.lifecycleListeners.clear()

        this.socket?.destroy()
        this.socket = null

        this.process?.kill()
        this.process = null

        this.buffer = ''
    }
}
