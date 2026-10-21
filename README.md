# music.tui

在终端中播放当前目录 `music/` 下的本地音乐，并显示同步歌词的 TUI 播放器。

## 界面截图

![music.tui 播放界面](https://imgbed.lldsss.com/file/1792592890411_Snipaste_1.png)

## 使用

要求：Node.js `>= 26.3.0`，并已安装且可从命令行调用 [mpv](https://mpv.io/)。

```bash
npx music.tui [音乐目录]
```

也可以全局安装：

```bash
npm install -g music.tui
music-tui
```

不传参数时扫描当前工作目录；传入相对路径时也以当前工作目录为基准。路径含空格时请加引号。支持 MP3、FLAC、WAV、M4A、AAC、OGG 和 OPUS。

## 缓存目录

程序将已读取的歌曲标题、歌手等元数据保存到缓存目录的 `metadata.json`，歌词也缓存在该目录中。音乐文件变更后会重新读取元数据；删除缓存不会影响扫描和播放。

| 系统 | 缓存目录 |
| --- | --- |
| Windows | `%LOCALAPPDATA%\music.tui\Cache` |
| macOS | `~/Library/Caches/music.tui` |
| Linux | `${XDG_CACHE_HOME:-~/.cache}/music.tui` |

## 快捷键

- `Space`：播放/暂停
- `←` / `→`：快退/快进 5 秒
- `↑` / `↓`：上一首/下一首；播放列表获得焦点时移动选择
- `Tab`：切换播放列表焦点（终端足够宽时）
- `Enter`：播放选中的歌曲
- `M`：切换播放模式
- `Q` / `Ctrl+C`：退出

## 技术栈

### 库

+ VueJS
+ Vue TermUI 渲染引擎
+ OpenTUI 渲染引擎
+ mpv 播放器
+ ascii.rest ASCII 视觉效果
+ https://lyriva.xyz/ 歌词 API


### 功能

+ 音频播放：mpv 播放、暂停、进度控制、切歌。
+ 播放模式：顺序播放、列表循环、单曲循环。
+ 歌曲信息：自动读取 MP3 metadata。
+ 歌词系统：Lyriva 自动获取、本地缓存、逐行同步、逐字高亮。
+ 终端界面：自适应高度、歌词自动居中。 
+ 歌曲列表
