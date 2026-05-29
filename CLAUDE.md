# CLAUDE.md - 项目上下文恢复文件

最后更新：2026-05-29

## 项目概述

个人工具仓库，当前主体是一个**待办事项 (ToDo) PWA 应用**，前后端一体部署在 Railway 上，支持安装到手机主屏和离线访问。

- **AI 助手**: Claude Code + DeepSeek v4
- **运行环境**: Windows 11 + Git Bash
- **线上地址**: `https://git-production-67b1.up.railway.app`

## 架构

```
用户浏览器
    │
    ├── /                → public/todo.html（静态页面）
    ├── /manifest.json   → PWA 清单
    ├── /sw.js           → Service Worker
    ├── /api/login       → 登录获取 token（无需认证）
    └── /api/todos/*     → CRUD（需 Bearer token 认证）
            │
    Express server.js
        ├── authMiddleware (base64 token 验证)
        ├── express.static('public') + Cache-Control: no-cache for sw.js
        └── REST API → data.json（文件持久化）
            │
    Service Worker (浏览器端)
        ├── install: 预缓存 todo.html, manifest.json, 图标
        ├── activate: 清理旧版本缓存
        └── fetch: 缓存优先 → 网络回退 → 离线兜底
```

单文件单体架构：**server.js (138 行) + todo.html (286 行) + PWA 层（manifest + SW + 图标）**，无数据库，无构建步骤。

## 文件清单

| 文件 | 用途 |
|------|------|
| `server.js` | Express 后端，7 个 API 路由 + 认证中间件 + JSON 文件读写 + sw.js 缓存控制 |
| `public/todo.html` | 完整前端（HTML+CSS+JS），登录页 + 主界面 + 搜索/筛选/标签/日期 + PWA 注册 |
| `public/manifest.json` | PWA 清单，定义应用名、独立窗口模式、主题色、图标（URL 含 ?v=2 版本参数） |
| `public/sw.js` | Service Worker，CACHE_NAME = `todo-v3`，缓存优先+网络回退策略 |
| `public/icon-192.png` | PWA 图标 192x192 |
| `public/icon-512.png` | PWA 图标 512x512 |
| `data.json` | 运行时数据文件（已 gitignore，服务器重启不丢） |
| `package.json` | 项目元信息，依赖 express ^4.21，start 脚本 `node server.js` |
| `Procfile` | Railway 部署指令：`web: node server.js` |
| `.gitignore` | 排除 node_modules/、.env、data.json |
| `CLAUDE.md` | 项目上下文恢复文件（本文件） |
| `开发流程.md` | 历史开发记录文档 |

## 已完成功能

1. **REST API** — GET/POST/PUT/DELETE `/api/todos`，GET `/api/tags`，POST `/api/login`
2. **Bearer Token 认证** — `/api/login` 验证密码返回 base64 token，authMiddleware 保护所有 `/api/todos` 路由
3. **分类标签** — 4 个预设标签（工作/个人/学习/其他），彩色 pill 展示，前端标签筛选按钮组，后端 `?tag=` 过滤
4. **截止日期** — 可选日期字段，过期红色/今天橙色/未来灰色，后端 `?overdue=true` 筛选，按日期排序
5. **搜索** — 前端实时过滤（客户端 input 事件驱动），后端也支持 `?q=` 参数
6. **数据持久化** — readData/writeData 读写 data.json，启动加载，写操作即时同步
7. **Railway 部署** — Procfile 驱动，环境变量 `TODO_PASSWORD` 和 `PORT`，push main 即自动部署
8. **登录保护** — 未登录显示登录卡片，API 401 自动清除 token 跳回登录页
9. **PWA 支持** — 可安装到手机主屏（manifest.json），离线访问（SW 缓存优先策略），自定义图标
10. **PWA 缓存刷新** — sw.js 设置 `Cache-Control: no-cache`，manifest 图标 URL 加 `?v=2` 版本参数，CACHE_NAME = `todo-v3`
11. **标签筛选 Bug 修复** — "全部"按钮不含 `data-tag` 属性（用 `|| ''` fallback），`add()` 后自动重置为"全部"视图

## 最近提交历史

```
97db465 fix: 修复全部选项卡不显示所有标签待办的筛选Bug
a764a15 fix: 强制刷新 PWA 图标缓存
3b82027 chore: 更新 SW 缓存版本以刷新 PWA 图标
9c44b2b feat: 添加 PWA 支持，可安装到主屏并离线访问
4a1daa3 docs: 完善开发流程文档，新增分类标签、截止日期、用户登录保护章节
7c98b74 feat: 添加分类标签、截止日期、用户登录保护
```

## 关键代码路径

### 后端路由注册顺序（server.js）

```
POST   /api/login        — 公开，验证密码 → 返回 base64 token
app.use('/api/todos', authMiddleware)  ← 认证墙，以下全部需要 token
GET    /api/todos         — 列表（支持 ?q= & ?tag= & ?overdue=）
GET    /api/tags          — 标签去重列表
GET    /api/todos/:id     — 单个
POST   /api/todos         — 新增（{ text, tag?, dueDate? }）
PUT    /api/todos/:id     — 更新
DELETE /api/todos/:id     — 删除
```

### 数据模型

```json
{
  "id": 1,
  "text": "完成报告",
  "done": false,
  "tag": "工作",
  "dueDate": "2026-06-01"
}
```

### 认证方式

- 密码来自 `process.env.TODO_PASSWORD`，默认 `admin123`
- Token = base64(密码)，明文可逆（非安全方案，仅作简单保护）
- 前端存 token 于 `localStorage`，请求时带 `Authorization: Bearer <token>`
- 401 时自动清除 token 并跳回登录页

### 前端关键函数（todo.html）

- `api(method, path, body)` — 封装 fetch，自动附加 Auth header，401 时清除 token 并跳回登录
- `load()` — 根据 `currentTag` 拼接 `?tag=` 参数调用 GET /api/todos（`currentTag` 为空串时不带参数）
- `render(filter)` — 从 `load()` 获取数据，客户端按 `filter` 关键词过滤，含日期颜色逻辑和标签 pill，同时请求全量数据计算统计
- `add()` — POST 新增后重置 `currentTag = ''` 并切回"全部"标签，确保新项可见
- `toggle(id)` / `remove(id)` — 更新/删除后保持当前筛选状态重新渲染
- `showLogin()` / `showMain()` — 页面切换，`showMain()` 触发初始渲染

### 标签筛选按钮（todo.html）

- "全部"按钮无 `data-tag` 属性（`dataset.tag` 返回 `undefined`）
- 其他按钮有 `data-tag="工作"` 等属性
- 点击时 `currentTag = btn.dataset.tag || ''`，统一 fallback 到空字符串
- 空字符串在 `load()` 中不追加 `?tag=` 参数 → 请求全部数据

### PWA 缓存策略（sw.js）

- **CACHE_NAME** = `'todo-v3'` — 更新静态资源时递增版本号即可强制刷新所有客户端缓存
- **install**: `skipWaiting()` + 预缓存 `/todo.html`、`/manifest.json`、`/icon-192.png`、`/icon-512.png`
- **activate**: `self.clients.claim()` 立即接管页面，自动删除非当前版本的旧缓存
- **fetch**: GET 请求缓存优先 → 网络请求成功则动态加入缓存 → 网络失败且为页面导航时回退到缓存的 `/todo.html`
- **更新流程**: 修改 sw.js 任意内容 → 浏览器检测变化 → 新 SW 安装/激活 → 旧缓存被清理
- **服务器端**: `express.static` 的 `setHeaders` 对 `sw.js` 设置 `Cache-Control: no-cache`，确保浏览器每次都检查 SW 更新

### 图标缓存刷新（三个层面）

| 层面 | 文件 | 机制 |
|------|------|------|
| Service Worker | `sw.js` | `CACHE_NAME = 'todo-v3'` |
| Manifest | `manifest.json` | 图标 URL 含 `?v=2` |
| HTTP 头 | `server.js` | `sw.js` → `Cache-Control: no-cache` |

### 数据文件

- `data.json` 已 gitignore，本地开发和服务器各自维护
- 服务器重启不丢数据（文件持久化）
- `nextId` 从已有数据中推导最大值 + 1

### Git 操作注意

- Git 全局配置了 HTTP 代理 `http://127.0.0.1:7897`，端口经常未监听
- 推送失败时使用：`git -c http.proxy= -c https.proxy= push origin main`
- 代理端口可能在 VPN/代理软件启动后变化

## 待办 / 可扩展方向

- [ ] 多用户支持（当前单用户，无用户体系）
- [ ] 真正的 JWT 或 session 认证（当前 base64 可逆，仅适合个人使用）
- [ ] 标签支持用户自定义（当前硬编码 4 个）
- [ ] 拖拽排序或优先级标记
- [ ] 数据导出/导入
- [ ] 自动化测试
- [ ] GitHub Actions CI/CD

## 本地运行

```bash
npm install        # 安装依赖（仅 express）
node server.js     # 启动，默认 http://localhost:3000
```

环境变量（可选）：
- `PORT` — 服务器端口，默认 3000
- `TODO_PASSWORD` — 登录密码，默认 `admin123`
