# Transit Hub Website

Transit Hub Website 是 Transit Hub 的 React + Vite 管理后台。生产环境中它是唯一对外暴露的入口，静态文件由 Nginx 托管，管理 API 请求会反向代理到运行时配置的后端 upstream。`TRANSIT_HUB_UPSTREAM` 必须在部署时显式配置。

## 管理功能

- Dashboard：请求、Token、成本、错误率和活跃设备概览。
- Models：筛选运行态模型，查看公开模型到上游的映射、调用地址、curl 示例和脱敏 Provider YAML 模板。
- API Keys / JWT Grants：管理客户端密钥、模型白名单、配额和签发授权。
- Sessions / Traffic：查看客户端连接、用量与请求日志。
- Pricing / Providers：维护模型价格，查看 Provider、Pool、账号和连通状态。
- Playground / Users：调试模型路由和维护后台用户。

`/models` 是只读模型目录，不会直接修改 Provider YAML。详情页中的接入地址根据运行时 `VITE_API_BASE_URL` 和当前访问域名生成，因此同时兼容根路径、子路径和独立 API 域名部署。

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

构建产物输出到 `dist/`，生产容器会使用同一条构建命令生成静态文件。前端静态资源使用相对路径构建，因此同一镜像可以部署在根路径或子路径。生产基础路径由容器运行时环境变量决定，默认部署在根路径 `/`；如果浏览器访问路径是子路径，请在启动容器时设置：

```dotenv
VITE_BASE_URL=/transit-hub
```

未设置 `VITE_API_BASE_URL` 时，API 前缀默认跟随 `VITE_BASE_URL`，例如请求 `/transit-hub/admin/...`。如果页面部署在子路径但 API 仍保留根路径，可以设置：

```dotenv
VITE_API_BASE_URL=/
```

`VITE_BASE_URL` 只表示浏览器看到的公网路径，不表示域名或后端服务名。容器内 Nginx 实际收到的路径由 `NGINX_BASE_URL` 控制；未设置时默认跟随 `VITE_BASE_URL`，适合没有路径 rewrite 的单虚拟机 Podman Compose 部署。如果前置 Ingress 已经把 `/transit-hub/...` rewrite 成 `/...` 再转发给容器，请设置：

```dotenv
VITE_BASE_URL=/transit-hub
NGINX_BASE_URL=/
```

后端代理目标由 `TRANSIT_HUB_UPSTREAM` 控制，必须按实际后端服务显式配置。例如单虚拟机 Podman Compose 环境可能是：

```dotenv
TRANSIT_HUB_UPSTREAM=http://transit-hub:8080
```

## 容器部署

website 和 server 使用固定 external network：`transit-hub-net`。服务器首次部署前创建网络：

```bash
podman network create transit-hub-net
```

先启动后端：

```bash
cd /path/to/transit-hub-server
podman compose up -d --build
```

再启动 website：

```bash
cd /path/to/transit-hub-website
podman compose up -d --build
```

website 镜像名固定为 `transit-hub-website`，容器名固定为 `transit-hub-website`。

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
VITE_CURRENCY=CNY
```

然后重启或重新部署容器：

```bash
podman compose up -d
```

`.env` 不会被复制进镜像上下文；`compose.yml` 会把这些值作为运行时环境变量传给容器。容器启动时会生成 `runtime-config.js`、改写 HTML `<base>`，并生成 Nginx location。镜像打好后再修改 `.env` 不需要重新 build，但需要重启或重新部署容器让运行时配置重新生成。

### 两种线上部署方式

单虚拟机 Podman Compose：浏览器请求路径会原样进入 website 容器。根路径部署不需要配置 base path；子路径部署只需要设置公网路径，容器内路径默认跟随它：

```dotenv
VITE_BASE_URL=/transit-hub
TRANSIT_HUB_UPSTREAM=http://transit-hub:8080
```

微服务 / Kubernetes Ingress rewrite：Ingress 负责匹配域名和公网二级路径，转发到 website 容器前会改写路径。例如当前规则：

```yaml
nginx.ingress.kubernetes.io/rewrite-target: /$2
nginx.ingress.kubernetes.io/use-regex: "true"
path: /transit-hub(/|$)(.*)
```

这种情况下，`VITE_BASE_URL` 仍然填浏览器看到的二级路径，`NGINX_BASE_URL` 填容器实际收到的路径。以后端服务名为 `transit-hub-server`、端口为 `80` 为例：

```dotenv
VITE_BASE_URL=/transit-hub
NGINX_BASE_URL=/
TRANSIT_HUB_UPSTREAM=http://transit-hub-server:80
```

这类部署不要把 `VITE_BASE_URL` 配成域名或服务名；它只是浏览器路径前缀。

## 发布检查

发布前建议依次执行：

```bash
npm run build
podman build -t transit-hub-website .
```

部署后检查：

```bash
podman network inspect transit-hub-net
podman compose ps
```

确认后端容器 `transit-hub-server` 和 website 容器 `transit-hub-website` 都在 `transit-hub-net` 中，并且外部只访问 website 暴露端口。website 会通过网络内服务名 `transit-hub:8080` 访问后端。

## API 与登录

- 前端默认使用同源 API 调用管理接口；根路径部署时请求 `/admin`，子路径部署且未覆盖 API base 时请求 `/{VITE_BASE_URL}/admin`。
- 只在 API 前缀需要与页面基础路径不一致时设置 `VITE_API_BASE_URL`。
- Nginx 容器内的 API location 默认跟随 `NGINX_BASE_URL`；未设置 `NGINX_BASE_URL` 时跟随公网 API 前缀。
- 登录态由后端 HttpOnly Cookie 维护，前端请求会携带 `credentials: "include"`。
- 如果 website 前面有 HTTPS 域名，后端 `.env` 通常需要设置 `CORS_ALLOWED_ORIGINS=https://your-domain.example.com` 和 `COOKIE_SECURE=true`。

## 常见排查

- 页面能打开但登录失败：确认 server 容器已启动，并且 website 容器里的 `TRANSIT_HUB_UPSTREAM` 指向正确服务。
- `/admin` 或 `/transit-hub/admin` 返回 502：确认 `TRANSIT_HUB_UPSTREAM` 已配置且可被 website 容器解析，例如单虚拟机可能是 `http://transit-hub:8080`，微服务环境可能是 `http://transit-hub-server:80`。
- 子路径页面刷新 404：确认容器运行时环境变量中有正确的 `VITE_BASE_URL`；如果 Ingress 会 rewrite 路径，还要确认 `NGINX_BASE_URL=/`，并且修改后已经重启或重新部署容器。
- 宿主机 80 端口冲突：修改 website `compose.yml` 的 `ports` 映射，或交给外部反代接入。
- Cookie 无法保持登录：检查访问域名、HTTPS、`COOKIE_SECURE` 和后端 CORS 配置是否匹配。
# tunnel-hub-website
