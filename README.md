# Transit Hub Website

Transit Hub Website 是 Transit Hub 的 React + Vite 管理后台。生产环境中它是唯一对外暴露的入口，静态文件由 Nginx 托管，管理 API 请求会反向代理到同一 Docker network 内的 `transit-hub:8080`。

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

开发态 Vite 会把当前 API 前缀下的 `/admin`、`/api`、`/v1` 代理到 `http://localhost:8080`。如果本地后端监听端口不同，请同步调整 `vite.config.ts`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`，生产容器会使用同一条构建命令生成静态文件。前端静态资源使用相对路径构建，因此同一镜像可以部署在根路径或子路径。生产基础路径由容器运行时环境变量决定，默认部署在根路径 `/`；如果要部署到子路径，请在启动容器时设置：

```dotenv
VITE_BASE_URL=/transit-hub
```

未设置 `VITE_API_BASE_URL` 时，API 前缀默认跟随 `VITE_BASE_URL`，例如请求 `/transit-hub/admin/...`。如果页面部署在子路径但 API 仍保留根路径，可以设置：

```dotenv
VITE_API_BASE_URL=/
```

## 容器部署

website 和 server 使用固定 external network：`transit-hub-net`。服务器首次部署前创建网络：

```bash
docker network create transit-hub-net
```

先启动后端：

```bash
cd /path/to/transit-hub-server
docker compose up -d --build
```

再启动 website：

```bash
cd /path/to/transit-hub-website
docker compose up -d --build
```

默认 `compose.yml` 将宿主机 `80` 端口映射到 website 容器 `80` 端口：

```yaml
ports:
  - "${WEBSITE_HTTP_PORT:-80}:80"
```

如果服务器已有外部网关或反代，可以在 website 项目的 `.env` 中设置端口，例如：

```dotenv
WEBSITE_HTTP_PORT=127.0.0.1:8081
```

如果要把 website 部署到 `/transit-hub` 子路径，在 `.env` 中设置：

```dotenv
VITE_BASE_URL=/transit-hub
VITE_API_BASE_URL=/transit-hub
VITE_CURRENCY=CNY
```

然后重启或重新部署容器：

```bash
docker compose up -d
```

`.env` 不会被复制进镜像上下文；`compose.yml` 会把这些值作为运行时环境变量传给容器。容器启动时会生成 `runtime-config.js`、改写 HTML `<base>`，并生成 Nginx location。镜像打好后再修改 `.env` 不需要重新 build，但需要重启或重新部署容器让运行时配置重新生成。

## 发布检查

发布前建议依次执行：

```bash
npm run build
docker compose build
```

部署后检查：

```bash
docker network inspect transit-hub-net
docker compose ps
```

确认 `transit-hub` 和 `transit-hub-website` 都在 `transit-hub-net` 中，并且外部只访问 website 暴露端口。

## API 与登录

- 前端默认使用同源 API 调用管理接口；根路径部署时请求 `/admin`，子路径部署且未覆盖 API base 时请求 `/{VITE_BASE_URL}/admin`。
- 只在 API 前缀需要与页面基础路径不一致时设置 `VITE_API_BASE_URL`。
- 登录态由后端 HttpOnly Cookie 维护，前端请求会携带 `credentials: "include"`。
- 如果 website 前面有 HTTPS 域名，后端 `.env` 通常需要设置 `CORS_ALLOWED_ORIGINS=https://your-domain.example.com` 和 `COOKIE_SECURE=true`。

## 常见排查

- 页面能打开但登录失败：确认 server 容器已启动，并且与 website 在 `transit-hub-net` 中。
- `/admin` 或 `/transit-hub/admin` 返回 502：确认 server compose 的服务名是 `transit-hub`，监听地址为 `:8080`。
- 子路径页面刷新 404：确认容器运行时环境变量中有正确的 `VITE_BASE_URL`，并且修改后已经重启或重新部署容器。
- 宿主机 80 端口冲突：修改 website `compose.yml` 的 `ports` 映射，或交给外部反代接入。
- Cookie 无法保持登录：检查访问域名、HTTPS、`COOKIE_SECURE` 和后端 CORS 配置是否匹配。
# tunnel-hub-website
