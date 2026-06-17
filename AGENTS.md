# AGENTS.md

## 项目定位

Transit Hub Website 是 Transit Hub 的管理后台前端，使用 React、Vite、TypeScript 构建。它面向内部管理员，提供登录、Dashboard、API Key、Session、Traffic、Pricing、Provider 和 User 管理页面。

生产环境中，website 是唯一对外暴露的入口。浏览器访问 website，前端以同源路径调用管理 API；Nginx 在容器内把管理 API 反向代理到运行时配置的后端 upstream。`TRANSIT_HUB_UPSTREAM` 必须在部署时显式配置。


## 目录结构

```text
src/main.tsx              React 入口、路由和 QueryClient 初始化。
src/pages/                页面级组件。
src/components/           可复用 UI 组件。
src/lib/api.ts            Admin API client，默认走同源请求。
src/lib/env.ts            VITE_BASE_URL / VITE_API_BASE_URL 规范化工具。
src/lib/types.ts          后端响应和页面数据类型。
src/lib/format.ts         展示格式化工具。
src/styles.css            全局样式。
vite.config.ts            Vite 构建和开发配置，生产静态资源按相对路径构建，开发态按 API 前缀代理到 localhost:8080。
Dockerfile                生产镜像，多阶段构建后由 Nginx 托管静态文件，启动时渲染运行时 baseUrl。
scripts/prepare-nginx.sh  根据运行时 baseUrl 安装静态文件、生成 runtime-config.js 并生成 Nginx 配置。
scripts/prepare-nginx.test.sh  prepare-nginx.sh 的运行时 base path 回归测试。
compose.yml               website 容器部署入口。
```

## 开发约定

- 保持前端 API 路径使用同源相对路径，生产环境不要硬编码后端域名。
- 页面基础路径统一使用运行时 `VITE_BASE_URL`，默认 `/`；子路径部署时在运行时环境变量中设置后重启容器。
- `VITE_BASE_URL` 表示浏览器看到的公网路径；`NGINX_BASE_URL` 表示请求到达 website 容器后的内部路径，未设置时默认跟随 `VITE_BASE_URL`。
- Ingress rewrite 场景通常设置 `VITE_BASE_URL=/transit-hub`、`NGINX_BASE_URL=/`，域名由 Ingress 规则负责。
- 只在 API 前缀需要与 `VITE_BASE_URL` 不一致时设置 `VITE_API_BASE_URL`。
- 后端代理目标使用 `TRANSIT_HUB_UPSTREAM`，必须按部署环境显式配置；单虚拟机环境可能是 `http://transit-hub:8080`，微服务环境可设置为类似 `http://transit-hub-server:80`。
- 新增页面时优先复用现有 Layout、MetricCard、StatusPill 和 EmptyState 组件。
- 新增后端字段时同步更新 `src/lib/types.ts`，并让页面展示逻辑兼容缺省值。
- UI 文案保持简洁，管理后台优先保证信息密度、可扫描性和操作清晰度。
- 修改生产路由或 API 前缀时，同步更新 `scripts/prepare-nginx.sh`、`README.md` 和后端 CORS/Cookie 配置说明。

## API 访问约定

- 开发态：`npm run dev`，Vite 将 API 前缀下的 `/admin`、`/api`、`/v1` 代理到 `http://localhost:8080`。
- 生产态：容器启动时生成 `runtime-config.js`，Nginx 将运行时 API 前缀下的 `/admin`、`/api`、`/v1` 代理到 `TRANSIT_HUB_UPSTREAM`。
- 登录态依赖后端 HttpOnly Cookie，前端请求统一使用 `credentials: "include"`。
- 管理后台不直接调用公开代理接口 `/v1/chat/completions` 或 `/v1/messages`。

## 容器部署约定

- website 和 server 使用同一个 external Podman network：`transit-hub-net`。
- 单虚拟机 Podman Compose 部署中，`TRANSIT_HUB_UPSTREAM` 按实际 server 服务名和端口填写；示例可用 `http://transit-hub:8080`。
- 后端容器名固定为 `transit-hub-server`，website 容器名固定为 `transit-hub-website`。
- 对外只暴露 website 的 HTTP/HTTPS 入口；server 不映射宿主机端口。
- 首次部署前需要执行 `podman network create transit-hub-net`。

## 注意事项

- 不要提交 `.env`、`.env.*`、真实密钥、构建产物 `dist/` 或 `node_modules/`；`.env.example` 是唯一可提交的 env 示例。
- 不要把生产 API 地址写入前端源码；优先使用同源相对 API 路径。
- 修改部署文件后至少运行 `sh scripts/prepare-nginx.test.sh`、`npm run build` 和 `podman build -t transit-hub-website .`。
- 如果 website 前面还有外部 HTTPS 反代，后端 `.env` 应根据实际域名设置 `CORS_ALLOWED_ORIGINS`，HTTPS Cookie 场景设置 `COOKIE_SECURE=true`。
