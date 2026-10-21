# Music.TUI

基于 Vue 3、OpenTUI 和 mpv 构建的终端音乐播放器，支持本地音乐播放、同步歌词显示和歌曲元数据缓存。

## 界面预览

![Music.TUI 播放界面](https://imgbed.lldsss.com/file/1792592890411_Snipaste_1.png)

## 快速开始

**运行要求：**

- Node.js >= 26.3.0
- 已安装 [mpv](https://mpv.io/)，并确保可从终端调用

无需安装，直接运行：

```bash
# 扫描当前目录中的音乐
npx music.tui

# 指定音乐目录
npx music.tui "D:\Music"
```

也可以全局安装：

```bash
npm install -g music.tui
music-tui
```

不传参数时默认扫描当前工作目录；相对路径也以当前工作目录为基准。

支持的音频格式：MP3、FLAC、WAV、M4A、AAC、OGG、OPUS。

## 功能特性

- **音乐播放**：基于 mpv，支持播放、暂停、进度控制和切歌。
- **播放模式**：顺序播放、列表循环、单曲循环。
- **歌曲列表**：扫描本地音乐目录并展示歌曲。
- **歌曲信息**：读取音频文件元数据，缓存歌曲标题、歌手等信息。
- **同步歌词**：通过 Lyriva 获取歌词，支持逐行同步、逐字高亮和本地缓存。
- **终端界面**：自适应高度布局，歌词自动居中显示。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `←` / `→` | 快退 / 快进 5 秒 |
| `↑` / `↓` | 上一首 / 下一首；列表获得焦点时移动选择 |
| `Tab` | 切换播放列表焦点（终端足够宽时） |
| `Enter` | 播放选中的歌曲 |
| `M` | 切换播放模式 |
| `Q` / `Ctrl+C` | 退出 |

## 缓存

Music.TUI 会在本地缓存歌曲元数据和歌词，减少重复读取与网络请求。

歌曲元数据保存在 `metadata.json` 中。当音乐文件发生变化时，程序会重新读取对应信息。

| 系统 | 缓存目录 |
| --- | --- |
| Windows | `%LOCALAPPDATA%\music.tui\Cache` |
| macOS | `~/Library/Caches/music.tui` |
| Linux | `${XDG_CACHE_HOME:-~/.cache}/music.tui` |

删除缓存不会影响音乐扫描和播放。

## 技术栈

- [Vue 3](https://vuejs.org/) — UI 组件开发
- [Vue TermUI](https://www.npmjs.com/package/vue-termui) — Vue 终端 UI 渲染
- [OpenTUI](https://github.com/anomalyco/opentui) — 终端渲染引擎
- [mpv](https://mpv.io/) — 音频播放
- [ascii.rest](https://ascii.rest/) — ASCII 视觉效果
- [Lyriva](https://lyriva.xyz/) — 歌词 API

## 相关链接

- [npm](https://www.npmjs.com/package/music.tui)
- [官方网站](https://musictui.lldsss.com)

## License

MIT
