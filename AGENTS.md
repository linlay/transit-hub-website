# AGENTS.md

## 项目定位

Transit Hub Website 是 Transit Hub 的管理后台前端，使用 React、Vite、TypeScript 构建。它面向内部管理员，提供登录、Dashboard、API Key、Session、Traffic、Usage audit（用量来源、异常汇总与估算校准）、Pricing、Provider 和 User 管理页面。

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

- 开发态：`npm run dev`，Vite 将 API 前缀下的 `/admin`、`/api`、`/v1`、`/bailian`、`/minimax`、`/mcp` 代理到 `http://localhost:8080`。
- 后端端口可用 `VITE_DEV_PROXY_TARGET` 覆盖；代理必须按路径段匹配，不能截获 `/mcp-access`、`/api-keys` 等管理站页面。修改后运行 `node scripts/dev-proxy.test.mjs`。
- 生产态：容器启动时生成 `runtime-config.js`，Nginx 将运行时 API 前缀下的 `/admin`、`/api`、`/v1`、`/bailian`、`/minimax`、`/mcp` 代理到 `TRANSIT_HUB_UPSTREAM`。
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

- TTS 管理展示使用 type=tts、协议 dashscope_tts/minimax_tts；Pricing 的 characters 模式通过 microcredits_per_10k_characters（整数字符串）定价，沿用 credits-wire 转换。请求日志 characters 独立展示，不混入 token。

## 企业管理页面

- 企业通用页面位于 `src/pages/Enterprise.tsx`，组织树位于 `src/pages/Directory.tsx`，管理员位于 `src/pages/Users.tsx`；路由、组织、目录、费用流水、审计、MCP、渠道配置、请求追踪和采购价复用同源 API。金额使用 bigint 转换，禁止浮点乘法传金额。
- `RequireAuth` 和 Layout 按 super_admin / platform_admin / user 控制路由与导航；服务端仍负责最终授权。组织管理员只能访问所属组织的明细和成员上限。
- 渠道编辑保留完整 YAML 结构，敏感字段只能填写凭据引用；真正凭据使用独立密码框提交，不写到预览或模型上下文。`yaml` 配置源显示只读提示。
- 新增或修改表单需保证 label 的可访问名称稳定；新页面主容器使用 enterprise-page，表格在手机上内部滚动，不把页面撑宽。
- `/mcp` 是独立精确代理位置，关闭响应缓冲；须同时覆盖根路径、子路径和 Ingress rewrite 场景。
- 页面使用 React.lazy 分包，普通组织管理员不需要加载图表和所有配置编辑代码。
- 管理后台 shell 固定在可视窗口内，导航与 `.main-content` 独立滚动并阻止边界滚动串联，顶层 header 固定。全页刷新、新增、导入、批量操作统一经 `usePageActions` 放在 header 右侧；列表不重复页标题或全页工具栏。模型／组织返回入口位于 header 左侧；配置、调配与编辑使用对话框。滚动条轨道透明，仅显示随主题变化的细滑块。
- 菜单分组与角色过滤统一维护在 `src/lib/navigation.ts`，顺序为概览、组织与权限、模型与渠道、用量与账务、审计与集成；组织管理员优先“我的组织”。模型与渠道仅包含模型、渠道、调试台；路由从模型列表或详情进入 `/models/:protocol/:modelId/routing`，渠道状态和配置统一在 `/providers`。
- 企业页面使用现有 `useI18n`，英文源键与中文翻译位于 `src/lib/enterprise-i18n.ts`；表头/枚举显示名位于 `enterprise-labels.ts`。只翻译显示文案，select 的 value、配置文档、用户数据和协议标识保持原值。
- 本地浏览器回归：先 `npm run build`，再 `npm run test:enterprise-ui`。测试启动隔离静态服务并拦截所有管理 API，只使用合成数据；不会访问真实后端。可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定浏览器；截图目录使用 `UI_SCREENSHOT_DIR`。

- 组织与权限以列表／树形展示为主，创建组织、批量调配、目录文件导入、部门维护和管理员授权使用 `ManagementDialog`；表单标签复用 `ManagementField` 保持可访问名称稳定。管理员角色 `user` 在界面称为“范围管理员”，显式组织和个人授权由后端校验；个人策略仅走 `/admin/managed-people/:id`，不得依赖前端过滤实现权限隔离。

- 账务页面分别位于 `Pricing.tsx`、`UpstreamPricing.tsx`、`Ledger.tsx`，金额和规则表单复用 `lib/finance.ts`、`components/PriceRules.tsx`。主界面保持列表／筛选／汇总，编辑、历史、详情、对账和调整使用对话框；采购价和报表调整的预览必须在表单变化后失效。Credits 与采购原币种分别展示，不做汇率换算或跨币种合计。`enterprise-smoke.mjs` 使用 `finance-fixtures.mjs` 覆盖真实 wire 字段和六位小数，不能连接真实后端。

- 审计与集成位于 `AuditLogs.tsx`、`RequestTrace.tsx`、`MCPAccess.tsx`。审计筛选在服务端执行并保留平台／组织权限范围，分页使用 `before_id`；详情显示可读字段差异，不直接展示原始 JSON。MCP 令牌明文只保留在创建成功的对话框状态，默认遮挡，关闭时清理，禁止写入 URL／localStorage／查询缓存。请求追踪支持 `request_id` 查询参数，详情以路由候选和尝试时间线为主。
