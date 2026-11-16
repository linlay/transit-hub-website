# Transit Hub 紧凑界面规范 · v0.4 待审阅

2026-11-16 · 基于前端 709c614 · 此文件是提案，不代表已批准实施。

## 范围与审阅入口

打开同目录 index.html（无需安装依赖，当前独立静态预览为 http://127.0.0.1:5186/index.html；也可由Vite访问 `/docs/ui-compact-draft/index.html`）。展示页不接入 React 路由，不请求管理 API，不存储业务数据。所有记录均为合成示例。支持浅／深色、原尺寸现状对照、状态样本、审计筛选和创建组织对话框。

本次只新增本目录。确认前不修改 src、业务路由、全局样式、后端或依赖。批准后再逐页收敛，不能把本目录 CSS 整体替换进生产。

## 现状依据

- `src/styles.css:3–10` 已定义 control-height 32、control-radius 9、panel-padding 16、panel-radius 20、page-padding 12、page-gap 14。
- 基础 input/select 在 146 行附近仍为 height 38、padding 12；2401 行附近圆角覆盖为 11；2494 行附近 search/filter 局部恢复为 32/9。2552 行附近又统一透明边框和 focus 外环。当前“同类控件不同尺寸”来自层叠，并非缺少 token。
- APIKeys 使用 search、filters、ResponsiveFilters；Traffic 使用 32px、13px 字和 8px gap。密钥多信息行最终高度 64px，应作为两行复杂信息的例外，不机械压到单行高度。
- Enterprise/Directory/Users 使用 enterprise-field；Users 的单搜索字段直接 width 100%。enterprise-field margin-block 10 + gap 7，enterprise-grid gap 16 + margin-block 16。相邻网格行字段外边距不会合并，控件到下一标签的空白可达 36px。
- Pricing/UpstreamPricing/Ledger/AuditLogs/MCPAccess 使用 finance-toolbar：gap 12、上下 margin 12/18，字段 flex 1 1 160，导致少量条件也占满整行。Audit 的日期／来源／结果适合定宽组合；MCP 的状态适合短宽度，不应和名称等宽。
- enterprise-field 标签使用未定义的 --text-muted 回退 #667085，未跟随暗色 color-text-muted；未来收敛时必须修正主题语义。
- 本机核对时 5175 属于 Shell AST Auditor；实际 Transit Hub 前端是 5173，已复用，没有停止进程。未要求后端写操作，也不依赖后端数据作展示。

展示页的“现状”来自冻结的当前 CSS 和相同结构，是可复现的样式对照，不是业务页面截图。冻结文件仅供审阅，不作为新生产样式源。

## 默认紧凑的定义

紧凑 = 同类控件同高、短字段按内容定宽、相关字段靠近、间距只有一层容器负责、减少重复标题和空壳卡片。禁止通过缩小正文、截断标签、隐藏错误或缩窄可点击范围来提高密度。

桌面默认只有一套 compact：单行 input/select 均32px（含边框），按钮与图标操作均28px；编辑表单输入也用32px。混排时以水平中心线对齐。复杂规则、权限说明、多行字段通过结构和行数扩展，不另造 38/40px 混合尺寸。手机 ≤760px 或 pointer:coarse，交互目标至少 44px；文本输入 16px 避免手机自动放大。761–1023px 自动换行，禁止压缩成不可读的窄栏。

## 尺寸、文字与边缘

| 项目 | 桌面默认 | 手机／触屏 |
|---|---|---|
| input / select | 高32px，box-sizing:border-box | 最小高44px |
| button / icon button | 高28px，左右8px；icon 28×28 | 最小44×44px |
| 文字 | 控件与表格 13px/20px；标签 12px/16px；说明 12px/18px | 输入/select 16px/22px；按钮14px/20px；标签13px/18px |
| 字体 | 沿用系统 -apple-system/BlinkMacSystemFont/SF Pro/Segoe UI/sans-serif；数值 tabular-nums；ID 可12px等宽 | 相同字体族 |
| 字重 | 正文400、标签500、按钮500、卡片标题600 | 同桌面 |
| 控件圆角 | 6px；textarea 6px；小状态标签6px | 6px |
| 控件内边距 | input 左右10px；select 左10右30px；textarea 8px 10px | 左右12px；select右32px |
| 图标 | Lucide 16×16、描边1.75–2，图文间距6px；input前缀距边10px，文字左内距32px | 18×18；图标按钮44×44 |
| 图标按钮 | 28×28，不把可点击框缩到16px图标尺寸；必须有稳定aria-label和tooltip | 44×44 |
| checkbox/radio | 可视16×16，标签整行可点，点击区至少32px高；不继承文本框高宽 | 点击区至少44px高 |
| textarea | 最小80px（3行20+上下16+边框）；纵向伸缩，最大高度由容器滚动处理 | 最小96px |

## Input / Select 状态（浅深色共用语义）

保留主蓝、成功／危险色与浅深色语义；按审阅意见移除页面蓝紫环境渐变，使用实心波浪背景和中性半透明毛玻璃表面。默认 input/select 保留 1px **透明占位边框**与 glass-field 背景，贴合现有无边框视觉；卡片边缘仍用 color-border。不得另写固定灰色标签。

| 状态 | 明确行为 |
|---|---|
| default | 文本 color-text，placeholder color-text-muted；placeholder 不替代 label |
| hover | 仅可编辑且未 disabled：glass-hover 背景，边框 color-border-control；不改变尺寸 |
| focus | 鼠标聚焦仅1px color-primary-border轻边框，不叠加光晕；Tab键盘导航用2px color-primary outline、offset2px。通过输入方式区分，不能直接删除键盘焦点；按钮保留focus-visible |
| disabled | disabled属性；opacity .56，neutral-soft背景，不响应hover、不可提交和Tab聚焦；必须看得见值，必要时在旁解释禁用原因 |
| read-only | readonly属性；neutral-soft背景；保留选中、复制和Tab；旁列“只读”，不做disabled处理。select无readonly，展示静态值或明确disabled原因 |
| error | 1px color-danger边框 + 下方错误文字12/18，距控件4px；aria-invalid和aria-describedby；鼠标focus保留红边，键盘focus外环仍蓝；不能只靠颜色；不预留每个字段的空错误行 |
| loading | 按钮保留宽度、aria-busy=true并禁用重复提交；文案“处理中…”；不让整个页面灰掉 |

select 与 input 必须同高、同字、同圆角。推荐采用统一风格的自定义选择弹层，不能让原生选项菜单与主题割裂。触发器32/44px、圆角6px，菜单padding4、选项高28/44、间隔2、最大高240/280，超出内部滚动。菜单使用中性半透明raised表面与20px模糊、选中项primary-soft，hover适度提亮；长选项不得超出视口。

选择器需要combobox/listbox/option语义、aria-expanded、aria-selected，支持方向键、首尾键、Enter选择、Esc关闭和Tab离开；禁用选项不可选。已选数量放触发器，不让多选标签撑高查询栏。正式实施应复用或扩展已有组件；草稿中的原生select仅隐藏保存合成筛选值，所有推荐样例显示统一弹层，左侧现状iframe保留旧原生行为。

日期也使用统一样式弹层，不弹出浏览器原生日历。触发器32/44px、图标16/18px、圆角6px；日历桌面宽280、内12，手机宽344（不超过视口减24）、内8；桌面日期高32、手机高44、7列布局；支持月份切换、方向键移动日期、选中状态、今天和Esc关闭。320px窄屏日历日期横向约40px，保持44px行高与1px间隔。日期范围错误仍显示文字。草稿“今天”为2026-11-16的合成场景；正式组件按用户时区计算，保留原页面的日期范围与查询语义。

## 宽度与排列

### 查询区：横向组合、按内容定宽

- 默认持久标签放控件左侧，标签与控件6px，组间8px，换行间8px。中文短标签不人为定宽；长标签或日期组允许局部上置，但一组保持一致。没有可见label时必须提供可访问名称，不能只留placeholder。
- 控件净宽：状态／来源／角色120px，协议／计费模式140px，组织／人员180px，单日期144px，日期范围（两端+分隔8px）296px，名称搜索240px，request_id等精确检索280px。查询项 flex:0 1 auto，不使用 flex:1。搜索最小180、最大320，剩余空白留给结果区，不硬拉满。
- 日期两个字段视为同一组，桌面尽量不拆；在窄视口换到下一行，手机两端分别成行，明确开始／结束标签。控件均 min-width:0，整体最大宽100%。
- 查询／重置与条件组相距8px；查询为轻主按钮（primary-soft背景、primary-strong文字），重置为文字次按钮。页面创建仍是header右侧的重点主按钮。
- 桌面主行最多放常用搜索+2–3个高频条件；超出主行两行的低频项放“更多条件”，已生效数量与摘要仍可见。Audit/Ledger可保留关键日期，来源／结果进入更多条件；不得把每个条件包成卡片。
- 手机保留搜索和“筛选(n)”入口，其他筛选用现有ResponsiveFilters对话框；44px点按区，条件单列。保持现有即时筛选语义，手机底部“完成”关闭，不伪装成“应用”；搜索是否Enter／防抖沿用各页，不在样式收敛中改变查询协议、权限或URL。
- 查询容器padding12，距表格12；若与表格同卡片，卡片内padding已提供12则不再嵌套一个12px查询壳。条件field自身margin:0。

### 编辑表单：上置标签、可阅读的字段组

- 创建／编辑／导入／调配仍进入对话框；标签在上，gap4px，field margin:0。form/grid统一负责列gap12、行gap12，section间16；grid margin:0。不同层不能重复添加垂直margin。
- 2列用于短且相关字段（名称+状态，协议+计费模式）；可用宽度≥480px才使用2列，每列最小220px。更窄一列。普通编辑表单最多2列，不默认auto-fit为3/4列。展示页以容器宽度479px为单列切换阈值。
- 输入宽100%填满**自己的表单列**；原因、说明、长模型ID、YAML、权限块跨全行。紧凑不是所有字段都变成查询栏式短宽。
- 必填用“名称 *”与required，格式要求写说明；错误增加对应行高而不覆盖下一行。数字单位相邻显示，不放placeholder。

## 按钮主次（v0.2 审阅修订）

- 桌面按钮全部高28、左右8、圆角6、文字13/20和500字重；图文间4；按钮间gap6。取消普通按钮64px最小宽，随内容自然宽；图标按钮28×28、图标16×16。手机及触屏目标仍至少44×44。
- 一级与查询采用用户偏好的浅主色底 + color-primary-strong文字，移除按钮渐变、白字和按钮阴影。一级以位置和简洁文字强调，每个区域最多一个重点动作；页面header和对话框footer分别计数。
- 浅色hover背景rgba(0,122,255,.17)，active .23；深色hover rgba(73,156,255,.27)，active .34。文字一直保留主题主色。各变体显式定义hover，禁止通用hover覆盖底色后遗留白字。hover不改变尺寸与透明度。
- 二级：neutral-soft背景、color-text；hover glass-hover。三级：透明底、color-text-soft，hover neutral-soft。危险：color-danger + danger-soft，hover增加danger-border，不改变文字色。禁用opacity .56，保持层级底色与可读文字。
- 复杂界面的刷新、查看、编辑、复制、行内撤销等高频局部动作优先icon；必须有aria-label与悬浮提示。新建、查询、保存等主要动作保留简洁文字，可配图标。多于3个行操作收进“更多”菜单，避免并排文字按钮占宽。
- 状态列、操作列表头与单元格水平居中、vertical-align:middle；状态pill为22px高的inline-flex居中，按钮28px高，行内以中心线对齐。状态不能伪装成可点击按钮；若状态可操作则使用真正button。手机pill至少24px，动作44px。
- 页面主要操作在顶层header右侧；返回在顶层左侧。表格行仅放局部操作，不把“创建／导入”复制进查询卡片。

## 间距、卡片、表格、对话框

| 对象 | 建议默认 |
|---|---|
| 间距刻度 | 4（标签/说明）、6（图文/按钮）、8（查询组）、12（表单/内容）、16（分区）；禁止随手增加7/10/14/18层叠间距 |
| 页面 | 外padding12，卡片间gap12；顶部header最小52高，水平padding16，按钮gap6 |
| 普通卡片 | padding16，圆角12，边框1px color-border与现有panel阴影；标题15/20，标题到正文12 |
| 列表／查询卡片 | padding12，圆角12；表格可延伸到卡片内边缘，不再嵌套卡片；查询与表格12 |
| 指标卡片 | padding12；标签12/16，值24/28，标签到值4，说明到值4；不强制固定大高度 |
| 单行表格 | th最小36、td行最小40；文字13/20，水平padding10，垂直padding4；有28px行按钮时行最小40 |
| 两行表格 | 20+18两行、行间2、上下8 → 最小56；复杂密钥／额度行允许64；多行内容自然增高，不能固定height裁切 |
| 表格可读性 | 表头12/16与600字重；数值右齐等宽数字；行hover surface-subtle；长ID省略须可查看完整值；手机table内部横滚，不撑宽页面；手机单行最小52px（容纳44px操作目标），两行最小64px |
| 对话框 | 小480／标准640／复杂规则960宽，均max-width:calc(100vw - 32px)；padding16，圆角12；header→body12，body→footer12，按钮gap6 |
| 对话框滚动 | max-height:calc(100dvh - 32px)，header/footer固定于框内，只有body滚动；不得让页面与对话框同时滚动 |
| 手机 | 页面/卡片padding12；dialog宽calc(100vw - 24px)、padding12、圆角12、max-height:calc(100dvh - 24px)；按钮目标44；表单gap12 |

导航与详情／main-content独立滚动；顶层header固定；滚动边界不串联。展示页导航与内容也独立滚动，演示对话框使用原生dialog及内部滚动。

## 后续实施边界与验收（确认后执行）

1. 先统一语义tokens和共享控件，修复 enterprise-field 主题标签、取消字段自身margin；分别提供 query布局和form-grid布局，避免一个全局class同时服务两种场景。
2. 密钥／流量作为密度参照，组织／目录／管理员、价格／采购价／流水、审计／追踪／MCP逐页迁移；保留header动作与dialog交互。
3. 验收1366/1280、1024、760、390、320宽和coarse pointer，浅深色，键盘Tab／焦点／错误／disabled／长英文／长ID；查询不溢出，表格内部横滚。运行构建和既有enterprise-ui合成回归，不写真实业务数据。

## 待确认

1. 是否批准桌面input/select 32px、圆角6px，按钮28px/左右8px，手机／触屏44px？
2. 是否批准查询区左置标签+定宽字段，编辑表单上置标签+最多2列？
3. 是否批准默认单行表格40px、两行56px、复杂密钥64px，以及列表padding12／普通卡片16／dialog16，卡片与dialog圆角12？
4. 是否认可纯浅色底按钮及其加深hover、更多icon动作、状态/操作列居中，以及鼠标细边框聚焦、键盘保留清晰外环？

以上选项审阅完成后再定稿；当前不启动全站迁移。

## v0.2 修订说明

按本次审阅意见：按钮取消渐变，改成“查询记录”式浅主色底；修复通用hover覆盖导致文字/底色失去对比的问题。桌面按钮由32收至28，复杂行操作用icon；状态和按钮中心对齐。input/select圆角9收至6，鼠标聚焦去掉强双环，键盘焦点单独保留。所有改动仍只在草稿目录。

对话框补充修订：圆角统一12px；桌面padding16px、手机12px；header/body/footer之间gap12px。保留正文内部滚动、表单行距12px。

## v0.4 当前视觉定稿候选

- 当前预览服务：http://127.0.0.1:5186/index.html。原5173服务在审阅中停止，本任务另起仅本机静态服务，未停止或更改其他进程。此目录不连接业务API。
- 背景为填充式SVG实心波浪，不用线条波纹，不铺整页蓝紫渐变。浅色底#f5f7f9；顶部波浪#b9dce4/.48，主要波浪#9fcbd0/.36、#b0c8e1/.27；底部#c3d9e5/.18，消除暖色叠加后发灰的效果。形状与层次保持稳定。
- 深色底#14191e；波浪#2a4b58/.48、#2a565c/.48、#374c70/.34、底部#375b73/.16。浅深色均使用独立SVG，背景固定在页面最底层，无动画、不接收点击。
- 卡片：浅色rgba(255,255,255,.62)，深色rgba(35,41,47,.62)。对话框/选择器/日历：浅色rgba(255,255,255,.88)，深色rgba(33,40,47,.90)。统一backdrop-filter:blur(20px) saturate(115%)；无支持时回退为实色。背景波浪通过毛玻璃柔和透出，不在卡片内部额外绘制波浪。
- 卡片、指标卡、列表卡、对话框圆角12px；input/select/button圆角6px；日历外框6px。桌面dialog内16、手机12、区段12。
- 按用户最后审阅意见，仅将波浪略调淡并去掉底部灰浊层；保留已认可的波浪结构与毛玻璃，不再大幅更换配色。
- 选择器与日期推荐样例均改成统一弹层，保持键盘操作与浅深色；现状iframe仅作为冻结的旧版对照。

所有数值仍为审阅草稿；本轮没有启动全站收敛。
