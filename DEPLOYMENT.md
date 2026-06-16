# Transit Hub Website 部署说明

本文档说明 `transit-hub-website` 在两类线上环境中的部署配置：

- K8s 微服务部署：请求先经过 Ingress，Ingress 按域名和路径命中后再转发到 website 容器。
- 单机虚拟机 Podman Compose 部署：请求直接进入 website 容器，或经过不改写路径的外部反向代理。

当前前端镜像支持运行时配置 base path。镜像构建后，不需要重新打包即可通过环境变量切换根路径或二级路径部署。

## 核心变量

| 变量 | 含义 | 是否必填 | 示例 |
| --- | --- | --- | --- |
| `VITE_BASE_URL` | 浏览器看到的公网路径前缀，只能是路径，不能是域名、服务名或后端地址。 | 否，默认 `/` | `/`、`/transit-hub` |
| `NGINX_BASE_URL` | 请求到达 website 容器后，Nginx 实际收到的路径前缀。 | 否，默认跟随 `VITE_BASE_URL` | `/`、`/transit-hub` |
| `VITE_API_BASE_URL` | 浏览器调用 API 的公网路径前缀。通常不需要配置，默认跟随 `VITE_BASE_URL`。 | 否 | `/`、`/gateway` |
| `NGINX_API_BASE_URL` | 请求到达 website 容器后，Nginx 实际收到的 API 路径前缀。通常不需要配置。 | 否 | `/`、`/gateway` |
| `TRANSIT_HUB_UPSTREAM` | website 容器内反向代理到后端服务的地址。 | 是 | `http://transit-hub-server:80` |

重要约定：

- `VITE_BASE_URL` 只表示浏览器地址栏里的路径前缀，例如 `/transit-hub`。
- 域名由 Ingress、网关、外部反向代理或 DNS 负责，不写进 `VITE_BASE_URL`。
- 后端地址只写进 `TRANSIT_HUB_UPSTREAM`。
- `TRANSIT_HUB_UPSTREAM` 没有默认值，所有部署环境都必须显式配置。
- 未配置 base path 时默认根路径 `/`；配置 `VITE_BASE_URL=/transit-hub` 时才启用二级路径。

## 部署组合总览

| 部署场景 | 浏览器访问路径 | 前置层是否 rewrite | website 容器实际收到路径 | 必要环境变量 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 单机虚拟机 Podman Compose，根路径 | `/` | 否 | `/` | `TRANSIT_HUB_UPSTREAM` | 默认模式，不配置 base path 即可。 |
| 单机虚拟机 Podman Compose，二级路径 | `/transit-hub/` | 否 | `/transit-hub/` | `VITE_BASE_URL=/transit-hub`、`TRANSIT_HUB_UPSTREAM` | 单机场景路径不被改写，容器收到的路径与浏览器一致。 |
| K8s 微服务 Ingress，根路径 | `/` | 建议否 | `/` | `TRANSIT_HUB_UPSTREAM` | Ingress 只按域名和 `/` 转发到 website service。 |
| K8s 微服务 Ingress，二级路径 | `/transit-hub/` | 是，rewrite 到 `/` | `/` | `VITE_BASE_URL=/transit-hub`、`NGINX_BASE_URL=/`、`TRANSIT_HUB_UPSTREAM` | 浏览器看到二级路径，但容器收到根路径。 |

## 单机虚拟机 Podman Compose

单机部署时，website 容器通常直接暴露端口，或挂在不改写路径的宿主机反向代理后面。也就是说，浏览器请求什么路径，website 容器就收到什么路径。

### 根路径部署

访问方式：

```text
http://your-domain.example.com/
```

或者：

```text
http://your-server-ip/
```

`.env` 示例：

```dotenv
WEBSITE_HTTP_PORT=80
VITE_BASE_URL=/
TRANSIT_HUB_UPSTREAM=http://实际后端服务:端口
```

也可以不写 `VITE_BASE_URL`，因为默认就是 `/`：

```dotenv
WEBSITE_HTTP_PORT=80
TRANSIT_HUB_UPSTREAM=http://实际后端服务:端口
```

启动或更新：

```bash
podman compose up -d --build
```

如果只是修改 `.env` 里的运行时变量，通常不需要重新 build，重启容器即可重新生成运行时配置：

```bash
podman compose up -d
```

### 二级路径部署

访问方式：

```text
http://your-domain.example.com/transit-hub/
```

`.env` 示例：

```dotenv
WEBSITE_HTTP_PORT=80
VITE_BASE_URL=/transit-hub
TRANSIT_HUB_UPSTREAM=http://实际后端服务:端口
```

这里不需要配置 `NGINX_BASE_URL`。未配置时，`NGINX_BASE_URL` 默认跟随 `VITE_BASE_URL`，因此 website 容器会按 `/transit-hub` 处理静态页面、资源和 API 代理。

启动或更新：

```bash
podman compose up -d --build
```

## K8s 微服务 Ingress

微服务部署时，请求链路通常是：

```text
浏览器 -> Ingress -> transit-hub-website service -> website 容器 Nginx
```

Ingress 负责匹配域名和路径。是否 rewrite 路径，会直接决定 `NGINX_BASE_URL` 应该怎么配置。

### 根路径部署

访问方式：

```text
https://transit-hub.qiuer.net/
```

Ingress 建议配置为根路径直接转发，不做 rewrite：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trasnit-front-ingress
  namespace: gxj-dev-aiagent
spec:
  ingressClassName: gxj-dev-admin
  rules:
    - host: transit-hub.qiuer.net
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: transit-hub-website
                port:
                  number: 80
```

website Deployment 环境变量示例：

```yaml
env:
  - name: VITE_BASE_URL
    value: /
  - name: TRANSIT_HUB_UPSTREAM
    value: http://实际后端Service:端口
```

`VITE_BASE_URL=/` 可以省略；保留也可以，语义更明确。

### 二级路径部署

访问方式：

```text
https://transit-hub.qiuer.net/transit-hub/
```

当前推荐的 Ingress 配置：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trasnit-front-ingress
  namespace: gxj-dev-aiagent
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: gxj-dev-admin
  rules:
    - host: transit-hub.qiuer.net
      http:
        paths:
          - path: /transit-hub(/|$)(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: transit-hub-website
                port:
                  number: 80
```

这条规则的行为是：

| 浏览器请求 | Ingress 转发给 website 容器 |
| --- | --- |
| `/transit-hub/` | `/` |
| `/transit-hub/assets/index.js` | `/assets/index.js` |
| `/transit-hub/admin/login` | `/admin/login` |
| `/transit-hub/api/...` | `/api/...` |
| `/transit-hub/v1/...` | `/v1/...` |

因此 website Deployment 必须这样配置：

```yaml
env:
  - name: VITE_BASE_URL
    value: /transit-hub
  - name: NGINX_BASE_URL
    value: /
  - name: TRANSIT_HUB_UPSTREAM
    value: http://实际后端Service:端口
```

这里 `VITE_BASE_URL=/transit-hub` 是给浏览器用的，保证页面资源和前端路由使用 `/transit-hub` 前缀。

这里 `NGINX_BASE_URL=/` 是给容器内 Nginx 用的，因为 Ingress 已经把 `/transit-hub/...` 改写成了 `/...`。

## API 代理说明

默认情况下，前端 API 路径跟随页面路径：

| 页面路径配置 | 浏览器 API 请求 | website 容器收到的 API 请求 | Nginx 代理到后端 |
| --- | --- | --- | --- |
| `VITE_BASE_URL=/` | `/admin/...`、`/api/...`、`/v1/...` | `/admin/...`、`/api/...`、`/v1/...` | `${TRANSIT_HUB_UPSTREAM}/admin/...`、`${TRANSIT_HUB_UPSTREAM}/api/...`、`${TRANSIT_HUB_UPSTREAM}/v1/...` |
| `VITE_BASE_URL=/transit-hub`，无 rewrite | `/transit-hub/admin/...`、`/transit-hub/api/...`、`/transit-hub/v1/...` | `/transit-hub/admin/...`、`/transit-hub/api/...`、`/transit-hub/v1/...` | `${TRANSIT_HUB_UPSTREAM}/admin/...`、`${TRANSIT_HUB_UPSTREAM}/api/...`、`${TRANSIT_HUB_UPSTREAM}/v1/...` |
| `VITE_BASE_URL=/transit-hub`，Ingress rewrite 到 `/` | `/transit-hub/admin/...`、`/transit-hub/api/...`、`/transit-hub/v1/...` | `/admin/...`、`/api/...`、`/v1/...` | `${TRANSIT_HUB_UPSTREAM}/admin/...`、`${TRANSIT_HUB_UPSTREAM}/api/...`、`${TRANSIT_HUB_UPSTREAM}/v1/...` |

只有当 API 的公网路径和页面路径不一致时，才需要配置 `VITE_API_BASE_URL`。大多数部署不需要设置它。

## Nginx ConfigMap 注意事项

当前镜像启动时会自动完成这些工作：

- 安装静态文件到 `/usr/share/nginx/html` 或对应子目录。
- 生成 `/usr/share/nginx/html/runtime-config.js` 或子路径下的 `runtime-config.js`。
- 根据运行时环境变量改写 `index.html` 中的 `<base>`。
- 生成 `/etc/nginx/conf.d/default.conf`。

因此，微服务部署中不建议继续使用旧的 Nginx ConfigMap 去做这些事情：

```nginx
sub_filter '<head>' '<head><base href="/transit-hub/">';
sub_filter 'src="/assets/' 'src="/transit-hub/assets/';
sub_filter 'href="/assets/' 'href="/transit-hub/assets/';
```

原因：

- base path 已经由运行时脚本处理，不需要 `sub_filter`。
- 如果 ConfigMap 覆盖 `/etc/nginx/conf.d/default.conf`，可能绕过镜像启动脚本生成的正确 location。
- 如果挂载覆盖 `/usr/share/nginx/html`，会覆盖运行时生成的 `runtime-config.js` 和改写后的 `index.html`。

如果平台必须挂载 Nginx 配置，配置内容需要与本文的路径模型保持一致：

- K8s 二级路径并且 Ingress rewrite 到 `/` 时，容器 Nginx location 应按根路径 `/` 处理。
- K8s 根路径部署时，容器 Nginx location 也按根路径 `/` 处理。
- 单机无 rewrite 的二级路径部署时，容器 Nginx location 才按 `/transit-hub` 处理。
- 后端 upstream 必须使用实际可解析的服务地址，不要使用未定义的默认服务名。

## 常见问题

### 把 `VITE_BASE_URL` 配成 `transit-hub` 可以吗？

可以。启动脚本会规范化为 `/transit-hub`。但建议直接写 `/transit-hub`，语义更清楚。

### 把 `VITE_BASE_URL` 配成域名可以吗？

不建议。`VITE_BASE_URL` 的职责是路径前缀，不是域名。域名应由 Ingress、外部网关、反向代理或 DNS 配置。

### 为什么 K8s 二级路径还要配置 `NGINX_BASE_URL=/`？

因为 Ingress 已经把浏览器请求的 `/transit-hub/...` rewrite 成 `/...` 再转发给 website 容器。容器实际收到的是根路径，所以 `NGINX_BASE_URL` 必须是 `/`。

### 为什么启动时报 `host not found in upstream "transit-hub"`？

这通常是把路径、服务名或默认后端地址混用了。`TRANSIT_HUB_UPSTREAM` 必须设置成当前环境中 website 容器能解析和访问的后端地址，例如 `http://实际后端Service:端口`。如果集群里没有名为 `transit-hub` 的服务，就不能使用 `http://transit-hub:8080`。

### 修改 base path 后需要重新构建镜像吗？

不需要。base path 是运行时配置。修改环境变量后重启或重新部署容器即可。

### 本地或服务器上用 Docker 命令吗？

不用。当前环境按 Podman 管理和构建镜像，命令使用 `podman` 和 `podman compose`。
