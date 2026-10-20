## MUSIC TUI

### 库

+ VueJS
+ Vue TermUI 渲染引擎
+ OpenTUI 渲染引擎
+ mpv 播放器
+ ascii.rest ASCII 视觉效果
+ https://lyriva.xyz/ 歌词 API

### 架构
tui-music/
├── src/
│   ├── main.ts
│   ├── App.vue
│   │
│   ├── components/             # UI 组件
│   │   ├── PlayerHeader.vue    # 顶部标题
│   │   ├── SongInfo.vue        # 歌名、歌手、专辑
│   │   ├── LyricsPanel.vue     # 歌词区域
│   │   ├── ProgressPanel.vue   # 时间和进度条
│   │   └── PlayerToolbar.vue   # 底部控制栏
│   │
│   ├── composables/            # 组合式逻辑
│   │   ├── usePlayer.ts        # 播放状态与控制
│   │   └── useTerminalSize.ts  # 终端尺寸监听
│   │
│   ├── services/               # 外部服务
│   │   └── player.ts           # mpv 播放引擎（以后实现）
│   │
│   ├── types/                  # TypeScript 类型
│   │   └── music.ts
│   │
│   ├── utils/                  # 纯工具函数
│   │   ├── formatTime.ts
│   │   └── lrc.ts              # 歌词解析（以后实现）
│   │
│   └── data/
│       └── mockMusic.ts        # 模拟歌曲和歌词
│
├── package.json
├── tsconfig.json
└── vite.config.ts

### 功能

+ 音频播放：mpv 播放、暂停、进度控制、切歌。
+ 播放模式：顺序播放、列表循环、单曲循环。
+ 歌曲信息：自动读取 MP3 metadata。
+ 歌词系统：Lyriva 自动获取、本地缓存、逐行同步、逐字高亮。
+ 终端界面：自适应高度、歌词自动居中。 
+ 歌曲列表（未实现）