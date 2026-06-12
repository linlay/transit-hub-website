# AGENTS.md

## 项目定位

Transit Hub Website 是 Transit Hub 的管理后台前端，使用 React、Vite、TypeScript 构建。它面向内部管理员，提供登录、Dashboard、API Key、Session、Traffic、Pricing、Provider 和 User 管理页面。

生产环境中，website 是唯一对外暴露的入口。浏览器访问 website，前端以同源路径调用管理 API；Nginx 在容器内把管理 API 反向代理到同一 Docker network 内的 `transit-hub:8080`。


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
vite.config.ts            Vite 构建和开发配置，开发态按 API 前缀代理到 localhost:8080。
Dockerfile                生产镜像，多阶段构建后由 Nginx 托管静态文件，并注入构建时 baseUrl。
scripts/prepare-nginx.sh  根据构建时 baseUrl 安装静态文件并生成 Nginx 配置。
compose.yml               website 容器部署入口。
```

## 开发约定

- 保持前端 API 路径使用同源相对路径，生产环境不要硬编码后端域名。
- 页面基础路径统一使用 `VITE_BASE_URL`，默认 `/`；子路径部署时在 `.env` 中设置后重新 build。
- 只在 API 前缀需要与 `VITE_BASE_URL` 不一致时设置 `VITE_API_BASE_URL`。
- 新增页面时优先复用现有 Layout、MetricCard、StatusPill 和 EmptyState 组件。
- 新增后端字段时同步更新 `src/lib/types.ts`，并让页面展示逻辑兼容缺省值。
- UI 文案保持简洁，管理后台优先保证信息密度、可扫描性和操作清晰度。
- 修改生产路由或 API 前缀时，同步更新 `scripts/prepare-nginx.sh`、`README.md` 和后端 CORS/Cookie 配置说明。

## API 访问约定

- 开发态：`npm run dev`，Vite 将构建时 API 前缀下的 `/admin`、`/api`、`/v1` 代理到 `http://localhost:8080`。
- 生产态：Nginx 将构建时 API 前缀下的 `/admin`、`/api`、`/v1` 代理到 Docker network 内的 `http://transit-hub:8080`。
- 登录态依赖后端 HttpOnly Cookie，前端请求统一使用 `credentials: "include"`。
- 管理后台不直接调用公开代理接口 `/v1/chat/completions` 或 `/v1/messages`。

## 容器部署约定

- website 和 server 使用同一个 external Docker network：`transit-hub-net`。
- server 服务名保持 `transit-hub`，website Nginx 通过该服务名访问后端。
- 对外只暴露 website 的 HTTP/HTTPS 入口；server 不映射宿主机端口。
- 首次部署前需要执行 `docker network create transit-hub-net`。

## 注意事项

- 不要提交 `.env`、`.env.*`、真实密钥、构建产物 `dist/` 或 `node_modules/`；`.env.example` 是唯一可提交的 env 示例。
- 不要把生产 API 地址写入前端源码；优先使用同源相对 API 路径。
- 修改部署文件后至少运行 `npm run build` 和 `docker compose build`。
- 如果 website 前面还有外部 HTTPS 反代，后端 `.env` 应根据实际域名设置 `CORS_ALLOWED_ORIGINS`，HTTPS Cookie 场景设置 `COOKIE_SECURE=true`。
