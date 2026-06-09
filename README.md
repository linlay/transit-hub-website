# Transit Hub Website

Transit Hub Website 是 Transit Hub 的 React + Vite 管理后台。生产环境中它是唯一对外暴露的入口，静态文件由 Nginx 托管，`/admin` 请求会反向代理到同一 Docker network 内的 `transit-hub:8080`。

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

开发态 Vite 会把 `/admin` 代理到 `http://localhost:7060`。如果本地后端监听端口不同，请同步调整 `vite.config.ts`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`，生产容器会使用同一条构建命令生成静态文件。

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

- 前端默认使用同源 `/admin` 调用管理 API。
- 生产环境不需要设置 `VITE_API_BASE_URL`。
- 登录态由后端 HttpOnly Cookie 维护，前端请求会携带 `credentials: "include"`。
- 如果 website 前面有 HTTPS 域名，后端 `.env` 通常需要设置 `CORS_ALLOWED_ORIGINS=https://your-domain.example.com` 和 `COOKIE_SECURE=true`。

## 常见排查

- 页面能打开但登录失败：确认 server 容器已启动，并且与 website 在 `transit-hub-net` 中。
- `/admin` 返回 502：确认 server compose 的服务名是 `transit-hub`，监听地址为 `:8080`。
- 宿主机 80 端口冲突：修改 website `compose.yml` 的 `ports` 映射，或交给外部反代接入。
- Cookie 无法保持登录：检查访问域名、HTTPS、`COOKIE_SECURE` 和后端 CORS 配置是否匹配。
# tunnel-hub-website
