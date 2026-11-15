# Transit Hub Website

Transit Hub Website 是 Transit Hub 的 React + Vite 管理后台。生产环境中它是唯一对外暴露的入口，静态文件由 Nginx 托管，管理 API 请求会反向代理到运行时配置的后端 upstream。`TRANSIT_HUB_UPSTREAM` 必须在部署时显式配置。

## 管理功能

- Dashboard：请求、Token、成本、错误率和活跃设备概览。
- Models：筛选运行态模型，查看公开模型到上游的映射、调用地址、curl 示例和脱敏 Provider YAML 模板。
- 员工认证密钥：在 `/employee-keys` 查看员工身份、模型权限、累计用量、限流及日志；全局验签开关和身份属性由服务端配置控制。首次认证访问自动创建身份记录，不领取 API Key。
- 授权型密钥：在 `/grant-keys` 统一管理 API 密钥和 JWT 授权，顶部默认显示 API 密钥，可切换至 JWT 授权（`?tab=jwt-grants`）；管理模型白名单、配额和签发授权。旧 `/api-keys`、`/jwt-grants` 和 API 密钥详情链接会保留查询参数并跳转到统一入口。
- Sessions / Traffic：查看客户端连接、用量与请求日志。
- Usage audit：按模型查看 usage 来源分布、成功响应缺少或无法解码 usage 的异常汇总，以及估算值与上游用量的校准比值。
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

## Credits 管理

额度、消费和公开模型价格统一使用原生 Credits，不进行人民币换算。Key/JWT 创建与编辑支持总 Credits 额度及“不限”，窗口额度同样使用 Credits。Key 详情的生命周期累计消费独立于可清理的日志报表，允许显示负余额。价格支持文本缓存读写、图片尺寸/质量规则和显式免费。

API 金额字段使用十进制整数 micro-Credits 字符串，不提交浮点 Credits。前后端需配套发布；Desktop 的后续接入契约位于 server 的 `docs/credits-api.md`。

### Traffic 分析页

`/traffic` 支持时间范围、API Key/模型搜索多选、Provider、请求结果和统计时区筛选，条件保存在 URL。六类图表展示调用趋势、活跃度和花费、模型/Key 排行、词元与缓存、请求质量；点击排行可继续筛选，匹配日志在独立弹框内分页。

此页面依赖配套后端的 `/admin/traffic/analytics` 和增强的 `/admin/logs`，上线时先更新后端。统计基于保留日志，默认最近 7 天、UTC+8，Credits 汇总显示整数。日期边界和 URL 筛选测试：`node scripts/traffic-filters.test.mjs`。

## 原生 Credits

模型价格、额度、消费统一使用 Credits，1 Credit = 1,000,000 micro-Credits。API 金额使用十进制整数字符串，`credits-wire.ts` 在边界转换并检查安全整数范围，表单支持六位小数。与 Server 的当前契约同步升级，不使用人民币换算或 v2 接口。

## TTS 入口

开发态 Vite 和生产 Nginx 增加 `/bailian/`、`/minimax/` 代理，保留 provider 前缀转发后端，使用与现有 API 相同的运行时 API base path。两个公开 POST 接口为 `/bailian/v1/services/aigc/multimodal-generation/generation`、`/minimax/v1/t2a_v2`；支持 Ingress rewrite，关闭响应缓冲并使用 3600 秒上游读写超时。外层反代也需放行这些路径。

Pricing 支持 DashScope TTS / MiniMax TTS 协议和每万计费字符的 Credits 单价；Models 可筛选 TTS 并查看原生 curl 示例；流量日志和 Key 日志显示计费字符数。后端配置、字符计费与 Platform 接入见 server 的 `docs/tts.md`。

## 企业管理与验证

本地后端端口不为 8080 时，可设置 `VITE_DEV_PROXY_TARGET=http://127.0.0.1:7060 npm run dev -- --port 5180`，仅影响 Vite 开发代理。生产环境仍使用 `TRANSIT_HUB_UPSTREAM`。
开发代理规则回归：`node scripts/dev-proxy.test.mjs`，覆盖根路径、子路径和 `/mcp-access` 等页面不会被 API 规则截获。

新增模型路由、虚拟组织、目录导入、费用流水、审计、MCP 访问、渠道配置、请求追踪与上游采购价格页面。总管理员通过“管理员”列表的新增和授权对话框设置账号角色、员工登录绑定及可管理的组织或个人。范围管理员仅能管理授权组织的成员上限与告警，以及获授权个人的策略；平台管理员不能管理控制台账号或调配组织成员。

导航按“概览 → 组织与权限 → 模型与渠道 → 用量与账务 → 审计与集成”分组；组织管理员优先显示“我的组织”。左下角账号菜单可切换中文 / English，新页面的菜单、标题、表单、表头和状态随语言切换，业务数据和 API 参数保持原值。“模型与渠道”仅保留模型、渠道、调试台；从模型列表或详情的“路由”进入当前模型的路由页，渠道页面统一提供状态与配置，并支持从状态卡片打开对应渠道配置。旧 `/routing` 跳转模型列表，旧 `/provider-configuration` 跳转渠道配置页。`test:enterprise-ui` 覆盖两种语言、三种角色的页面组合，以及模型路由入口与作用域、渠道状态和配置切换、语言切换保留表单值、菜单顺序与手机展开导航。

渠道配置支持 YAML / 表单、文件导入、脱敏导出、版本查看与回滚。填写真实凭据请使用独立凭据框，文档中只保留 `${secret:名称}`。费用调整只影响报表；组织模式下的余额和消费需使用 Server 新契约。

生产反代和 Vite 均提供 `/mcp`；子路径部署沿用运行时 API base path。MCP Token 在个人访问页创建，只显示一次，账号停用或权限撤销后立即失效。

回归命令：

```sh
npm run build
sh scripts/prepare-nginx.test.sh
node scripts/traffic-filters.test.mjs
npm run test:enterprise-ui
```

浏览器测试只使用合成响应，覆盖三种角色、移动布局和写操作预览。先构建 dist；macOS 默认使用本机 Chrome，其余环境可安装 Playwright Chromium，或设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。截图默认写入临时目录，可用 `UI_SCREENSHOT_DIR` 改写。容器构建仍使用现有私有 Harbor 基础镜像，需构建环境能够访问该仓库。

组织与权限页面以列表和树形浏览为主：虚拟组织的创建、成员 CSV 批量调配在对话框中操作；组织架构左侧为可展开的部门树，员工作为部门下的叶子节点，右侧查看所选部门员工。新增／编辑部门、员工详情、所选成员调配及 JSON／CSV 文件导入均通过对话框处理。管理员页不展示常驻创建表单；新增和编辑授权对话框可选择组织与个人范围。`/managed-people` 仅列出当前管理员获授权的个人，策略保存由服务端逐人校验权限。

账务页面以查询和对比为主：`Pricing.tsx` 展示模型 Credits 计费价，支持协议／计价方式筛选，新增、编辑、规则详情与价格历史均使用对话框。`UpstreamPricing.tsx` 按渠道和上游模型展示当前／待生效价格与历史版本，采购成本保留原币种；新增和调价先预览再发布，表单变化后预览失效。`Ledger.tsx` 默认展示近 30 日明细，可按组织、成员和历史部门路径筛选，切换分组汇总；期间指标另取完整期间的流水类型／币种汇总，各币种分别展示。流水详情、对账和报表调整在对话框中操作，报表调整先预览再提交，导出明确限于当前页。图片、字符和长上下文阶梯价格由可视表单编辑，金额通过整数串转换提交。

本地合成预览可在构建后运行 `node scripts/finance-preview.mjs`，通过 `http://127.0.0.1:4178/pricing` 查看；示例数据和预览内的写入只保存在进程内，不连接任何网关。

审计与集成采用列表浏览和任务对话框：`AuditLogs.tsx` 按日期、组织、来源、结果和关键字筛选，使用游标翻页；详情显示操作前后字段变化和脱敏值。`RequestTrace.tsx` 先展示近期请求，也支持 `?request_id=...` 直接定位；详情显示路由候选、固定路由、会话亲和与逐次尝试时间线。`MCPAccess.tsx` 展示个人令牌的可用／过期／撤销状态，创建、连接指南和撤销均在对话框操作，权限选项来自服务端 `available_scopes`。新令牌默认遮挡，仅创建成功时可复制；关闭即清理页面状态，不写入 URL、浏览器存储或查询缓存。`integration-fixtures.mjs` 提供隔离的审计、追踪和令牌示例，沿用本地合成预览服务可查看这三个页面。
