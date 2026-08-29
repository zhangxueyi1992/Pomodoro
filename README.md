# 番茄时钟（Pomodoro Timer）

基于番茄工作法的全栈专注计时应用。

- **前端**：Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus + ECharts
- **后端**：Node.js + Express + TypeScript + Prisma ORM + MySQL 8
- **工程**：pnpm workspace monorepo（`apps/web`、`apps/server`、`packages/shared`）

## 功能特性

- 🍅 工作 / 短休息 / 长休息三模式倒计时（SVG 圆环动画）
- ⏯️ 开始 / 暂停 / 重置 / 跳过；基于时间戳差值计时，后台标签页不漂移
- 🔄 自动切换模式，每 N 个（默认 4）番茄进入一次长休息，可自动开始下一阶段
- 📋 任务管理：创建 / 编辑 / 删除 / 标记完成，可关联当前专注任务，累计番茄数
- 📊 统计图表：按日 / 周 / 月查看番茄数与专注时长趋势
- 🔔 浏览器通知 + 提示音，网页标题实时显示倒计时
- 👤 用户系统：注册 / 登录 / JWT 鉴权，多用户数据隔离
- 🌙 深色模式、响应式布局
- 💾 刷新页面后恢复计时状态

## 技术架构

```
Pomodoro/
├── apps/
│   ├── web/          # Vue 3 前端（Vite）
│   └── server/       # Express 后端（Prisma + MySQL）
└── packages/
    └── shared/       # 前后端共享 TS 类型与常量
```

## 环境要求

- Node.js ≥ 20（开发环境为 v24）
- pnpm ≥ 9
- MySQL 8（本机实例端口 **3309**，账号 `root`，密码 `123456`——见 `.env`）

## 快速开始

```bash
# 1. 安装依赖（自动构建 shared 包）
pnpm install

# 2. 配置环境变量
cp .env.example .env   # 按需修改数据库连接串、JWT 密钥

# 3. 初始化数据库（创建表结构）
pnpm db:migrate

# 4. 启动前后端（两个进程）
pnpm dev:server        # http://localhost:3000
pnpm dev:web           # http://localhost:5173
# 或一条命令同时启动：
pnpm dev
```

打开 http://localhost:5173 ，注册账号后即可使用。

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 同时启动前后端开发服务器 |
| `pnpm dev:web` / `pnpm dev:server` | 单独启动前端 / 后端 |
| `pnpm build` | 构建所有包（shared → server → web） |
| `pnpm test` | 运行全部单元 / API 测试 |
| `pnpm db:migrate` | Prisma 迁移（开发环境） |

## API 概览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/me` | 当前用户信息 |
| GET/POST | `/api/tasks` | 任务列表 / 创建 |
| PATCH/DELETE | `/api/tasks/:id` | 更新 / 删除任务 |
| POST | `/api/sessions` | 上报结束的会话 |
| GET | `/api/sessions?from=&to=` | 查询历史会话 |
| GET | `/api/stats/summary?range=day\|week\|month` | 统计汇总 |
| GET/PATCH | `/api/settings` | 读取 / 更新设置 |

## 测试

```bash
pnpm test
```

- 后端：supertest + Vitest，覆盖认证、任务 CRUD、归属校验、会话上报、统计口径、设置（使用独立测试库 `pomodoro_test`）
- 前端：Vitest，覆盖时间格式化与模式切换规则

## 目录结构

```
apps/web/src/
├── api/            # axios 封装与接口定义
├── components/     # TimerCircle（圆环）、StatChart（图表）
├── composables/    # （预留）
├── router/         # 路由与鉴权守卫
├── stores/         # Pinia：auth / timer / tasks / settings
├── utils/          # 格式化、通知、模式切换规则
└── views/          # 登录 / 注册 / 计时器 / 任务 / 统计 / 设置

apps/server/src/
├── middleware/     # JWT 鉴权、参数校验、错误处理
├── routes/         # REST 路由
├── services/       # 业务逻辑
└── lib/            # Prisma 客户端
```

## 数据模型

- **User**：账号信息（email / username / 密码哈希）
- **Task**：任务（标题、描述、状态、预估与已完成番茄数）
- **PomodoroSession**：会话记录（类型、起止时间、计划时长、是否完整完成）
- **Settings**：用户偏好（各阶段时长、长休间隔、自动开始、通知开关）

统计口径：仅 **完整完成的工作会话** 计入番茄数与专注时长。

## 后续可扩展

- PWA 离线安装与桌面通知
- 密码找回、邮箱验证
- 多设备实时同步 / WebSocket
- 全局快捷键、番茄节奏报告（周报邮件）
