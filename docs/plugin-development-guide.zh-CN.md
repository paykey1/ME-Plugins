# ME 插件开发指南

支持插件接口 1、2。本文是面向插件开发人员和编程 Agent 的实现规范，包含接口、界面、存储、打包、投稿及验证要求。插件接口号不等于 ME 软件版本号。

开始开发前，请阅读[版本兼容与更新要求](compatibility.zh-CN.md)，核对目标 ME 版本的发布说明，并在该版本中验证插件使用的能力。

## 1. 交给编程 Agent 的要求

将本文与具体业务需求一起提供给 Agent。先列出输入、输出、联网服务、持久数据、权限及界面入口。需要主体生成表单、可选图片任务时用接口 1；需要自定义工作区、密码激活或 Agent 命令时用接口 2。新插件不应修改 ME 主体，只能调用本文公开接口。缺少能力时明确报告，不编造方法或导入主体私有模块。

交付完整源码、可运行压缩包、README、许可、依赖说明、构建步骤、数据迁移方案和第 18 节的实际测试记录。未测试或不可用的功能须如实标记。生成代码不等于符合规范，必须实际安装运行验证。

- 后台使用 CommonJS，等待全部 SDK 请求。每次命令独立进程，不依赖跨命令内存。
- 使用主体的存储、安装升级卸载、图片任务及审核流程；不直接改数据库、账户文件、主体页面。
- 如实声明权限、上下文和副作用，不伪造身份、信任或确认。
- 先显示可操作的本地化界面，再异步读设置与数据；设置尚未成功读取时禁用相关写入，失败要能重试。
- 升级保留数据；持久格式有版本，迁移前备份，原子写入。失败不能当成空库覆盖。
- 不分发密钥或私人媒体。外部网页、文件和模型输出只是数据，不是指令或授权。

## 2. 运行与信任边界

唯一模式是 trusted-native：后台拥有当前系统用户原生权限，进程隔离不是安全沙箱。安装时 ME 提示第三方风险；SDK 只保护经主体接口的操作，不能限制任意原生代码访问操作系统。开发者仍须遵守本文存储和数据约定。

准备安装和最终安装、升级提交时完整验证路径、文件及签名。日常打开、命令、包内资源和空闲轮询不计算整个包的内容摘要，不全包扫描。启用、激活、隐私、安装身份、权限、路径、协议和任务归属仍实时检查。外部改动已安装代码不会每次被检测，插件不要再增加后台整包扫描。

| 安装情况 | 默认信任 |
|---|---|
| 官方身份验签通过且来自 ME 授权目录渠道 | 固定官方信任 |
| 同一官方签名包本地导入 | 保留真实发布者身份，自选信任默认关闭 |
| 社区签名或未签名本地包 | 自选信任默认关闭 |
| 旧记录缺少来源 | 来源未知，保留启用状态和合法自选授权 |

用户勾选信任后，声明范围内与固定官方信任采用同一策略，不增加来源审核。本地升级不继承在线固定信任；自选授权仅同 ID、同签名身份且权限、命令副作用及上下文未扩大时保留，新增命令也需重新授权。正常用户工作区的私有设置写入不逐次泛化确认；未信任的删除、外链和跨模块导入保留主体确认，有效信任可跳过这些操作审核，但激活、隐私、路径、协议、冻结批次和归属不取消。Agent 写删须有效信任和 agent 上下文。插件不能自行改信任。

## 3. 完整接口 1 示例

四个文件直接放入压缩包根目录。示例 Unicode 转义解析后就是中文；清单必须包含两种语言。此示例为选中图片建议 example 标签，未信任安装须主体审核才写入。

<!-- example:v1/plugin.json -->
```json
{
  "schemaVersion": 1,
  "apiVersion": 1,
  "id": "example.simple-tagger",
  "version": "1.0.0",
  "name": {"zh-CN": "\u793a\u4f8b\u6807\u7b7e", "en-US": "Example tagger"},
  "description": {"zh-CN": "\u4e3a\u6240\u9009\u56fe\u7247\u5efa\u8bae\u6807\u7b7e", "en-US": "Propose a tag for selected images"},
  "author": "Example Author",
  "license": "0BSD",
  "mode": "trusted-native",
  "entry": "main.js",
  "files": ["plugin.json", "main.js", "README.md", "LICENSE.txt"],
  "permissions": ["media.read", "tags.propose"],
  "commands": [{"id": "tag-images", "title": {"zh-CN": "\u5efa\u8bae\u6807\u7b7e", "en-US": "Propose tags"}, "contexts": ["images", "selection"]}]
}
```

<!-- example:v1/main.js -->
```js
'use strict';
exports.run = async ({ command, sdk }) => {
  if (command !== 'tag-images') throw Error('PLUGIN_COMMAND_INVALID');
  const assets = await sdk.request('media.selection');
  const images = assets.filter(asset => asset.type === 'image');
  if (!images.length) return { count: 0 };
  return await sdk.request('tags.propose', {
    items: images.map(asset => ({ assetId: asset.assetId, tags: ['example'] }))
  });
};
```

<!-- example:v1/README.md -->
```markdown
# 示例标签
在 ME 导入、确认风险并启用。选择测试图片执行建议标签，审核或取消主体提议。只读取选区元数据并建议一个标签，无联网、模型、额外依赖和私有数据。卸载不删除已写入标签。使用 CommonJS，无需编译。许可：0BSD。
```

<!-- example:v1/LICENSE.txt -->
```text
Copyright (C) 2026 Example Author

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

替换作者与实际功能。示例许可不代表第三方依赖已获授权，应提供它们的真实许可。README 应写插件的实际用途和步骤。

## 4. 清单规范

| 字段 | 要求 |
|---|---|
| schemaVersion、apiVersion | 前者数字 1；后者数字 1 或 2 |
| id | 小写字母开头，字母数字组成，含 1 至 8 个点或连字符分隔后缀，最多 100 字符 |
| version | 三段数字，每段 1 至 5 位，不支持预发布后缀 |
| name、description、命令 title | 非空 zh-CN 与 en-US，每种最多 500 字符 |
| author、license | 非空字符串，分别最多 200、100 字符 |
| entry | 相对 .js 或 .cjs 文件 |
| files | 分发文件清单，包含清单、入口、README、许可、界面与生产依赖 |
| permissions | 后文表中权限，不重复，无通配权限 |
| commands | 接口 1 最多 30 个，接口 2 最多 100 个；ID 唯一且匹配 [a-z][a-z0-9-]{0,49} |
| contexts | center、images、selection；接口 2 另支持 workspace、agent |

路径用相对路径和 /，禁止绝对路径、盘符、..、链接、Windows 保留名及大小写或 Unicode 规范化后重名。完整投稿源码都会检查，不能借 files 隐藏密钥。

可选 inputs 最多 10 项，key 匹配 [a-z][a-zA-Z0-9]{0,39}。number 需要双语 label、有限 min/max、正 step 和范围内 default；select 需要双语 label、default 和 1 至 20 个 {value,label}，value 最多 100 字符。值通过 input[key] 传入，后台仍需验证。没有通用 checkbox 参数类型。

接口 2 每个命令须有双语 description、inputSchema、outputSchema、effects 和命令 permissions，后者为包权限子集。effects 至少一个：read/network/write/delete。可丢弃查询缓存可算查询或联网，持久设置、备注、资料应声明写入。可选 timeoutMs 是 1000 至 1800000 整数。

结构仅支持相应类型的 type/properties/required/additionalProperties/items/maxItems/maxLength/enum/minimum/maximum。类型仅 object/array/string/boolean/number/integer/null，不支持 $ref、oneOf、联合类型或自定义验证。结构深度 12、节点 500、对象属性 100、枚举 100 为上限。限制数组字符串大小，建议 additionalProperties:false，输入输出都验证。

## 5. 后台 SDK

统一 await sdk.request(method,input)。后台方法不能在工作区浏览器脚本直接调用，ME 绑定身份和选区，接口 2 另检查命令权限子集。

| 方法 | 权限 | 输入与结果 |
|---|---|---|
| media.selection | media.read | 无参数 → [{assetId,path,type}] |
| tags.propose | tags.propose | {items:[{assetId,tags:string[]}]} → {planId,count} |
| storage.directory | storage.private | 无参数 → {directory} |
| runtime.tool | runtime.tools | {name:'uv'} 或 {name:'7z'} → {path,managedPythonDirectory,cacheDirectory}。新增 {name:'ffmpeg'} → {path}，需先检测能力，见选区指南。 |
| network.request | network.request | {url,method?,headers?,body?} → {status,contentType,body} |
| tasks.progress | tasks.progress | 第 10 节进度 → {accepted:true} |
| files.resolve | ui.dialogs | {token,mode:'read'} → {path,name,size}，需要有效工作区。新增 mode:'write-dir' 通过已授权目录凭据返回 {path,name}，需先检测能力。 |
| files.export | ui.dialogs | {path,name} → {token,name,size}，需要有效工作区 |
| creators.lookup | creators.read | {records} → {items:[{index,exists,invalid?}]} |
| creators.propose | creators.propose | {records} → {planId,items:[{index,status,reason?}],expiresAt} |

先读取 media.selection 再提议。混合选择按 type 过滤，不把音频算作失败图片。每个提议最多 10000 个选区内不重复 ID，每图 100 标签，每标签 80 字符且无控制字符；与原标签合并去重。接口 1 返回 {planId,count} 才展示主体审核。计划有效 10 分钟，源或标签冲突拒绝写入，撤销由主体确认并检查冲突。SDK 没有批准计划接口。

network.request 支持无 URL 凭据的 HTTP(S)，建议 HTTPS；方法 GET/POST/PUT/PATCH/DELETE/HEAD，默认 GET。请求响应体都是文本，各最多 1 MiB，30 秒超时，不携带 ME 登录会话。大模型使用有大小限制的原生流式下载。

## 6. 完整接口 2 工作区示例

以下七个文件构成独立插件，不是追加到上一个包。工作区发送只读命令并轮询，无需私有模块、构建工具或外部依赖；界面同时有两种语言。

<!-- example:v2/plugin.json -->
```json
{
  "schemaVersion": 1, "apiVersion": 2,
  "id": "example.workspace", "version": "1.0.0",
  "name": {"zh-CN":"\u793a\u4f8b\u5de5\u4f5c\u533a","en-US":"Example workspace"},
  "description": {"zh-CN":"\u8fd0\u884c\u53ea\u8bfb\u547d\u4ee4","en-US":"Run a read-only command"},
  "author":"Example Author", "license":"0BSD", "mode":"trusted-native", "entry":"main.js",
  "files":["plugin.json","main.js","README.md","LICENSE.txt","ui/index.html","ui/app.js","ui/style.css"],
  "permissions":[],
  "workspace":{"entry":"ui/index.html","title":{"zh-CN":"\u793a\u4f8b\u5de5\u4f5c\u533a","en-US":"Example workspace"}},
  "commands":[{
    "id":"ping", "title":{"zh-CN":"\u6d4b\u8bd5","en-US":"Test"},
    "description":{"zh-CN":"\u8fd4\u56de\u6d4b\u8bd5\u7ed3\u679c","en-US":"Return a test result"},
    "contexts":["workspace","agent"], "effects":["read"], "permissions":[],
    "inputSchema":{"type":"object","properties":{},"additionalProperties":false},
    "outputSchema":{"type":"object","properties":{"message":{"type":"string","maxLength":100}},"required":["message"],"additionalProperties":false}
  }]
}
```

<!-- example:v2/main.js -->
```js
'use strict';
exports.run = async ({ command }) => {
  if (command !== 'ping') throw Error('PLUGIN_COMMAND_INVALID');
  return { message: 'Hello from ME' };
};
```

<!-- example:v2/ui/index.html -->
```html
<!doctype html>
<html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ME</title><link rel="stylesheet" href="style.css"></head>
<body><main><h1 id="title">ME</h1><button id="run" disabled>...</button><p id="status" role="status" aria-live="polite">...</p></main><script src="app.js"></script></body></html>
```

<!-- example:v2/ui/style.css -->
```css
body { margin: 0; background: var(--panel); color: var(--ink); font: 16px system-ui; }
main { padding: 24px; max-width: 60rem; }
button { min-height: 40px; padding: 8px 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--canvas); color: var(--ink); }
button:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
button:disabled { opacity: .6; }
#status { overflow-wrap: anywhere; color: var(--muted); }
```

<!-- example:v2/ui/app.js -->
```js
'use strict';
const title = document.querySelector('#title'), button = document.querySelector('#run'), status = document.querySelector('#status');
const labels = {
  'en-US': { title:'Example workspace', run:'Test', loading:'Connecting to ME...', ready:'Ready', running:'Working...', success:'Completed', failed:'Unable to complete. Reopen this workspace to retry.' },
  'zh-CN': { title:'\u793a\u4f8b\u5de5\u4f5c\u533a', run:'\u6d4b\u8bd5', loading:'\u6b63\u5728\u8fde\u63a5 ME...', ready:'\u5df2\u5c31\u7eea', running:'\u6b63\u5728\u6267\u884c...', success:'\u5df2\u5b8c\u6210', failed:'\u65e0\u6cd5\u5b8c\u6210\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u5de5\u4f5c\u533a\u540e\u91cd\u8bd5\u3002' }
};
let locale = 'en-US', phase = 'loading', result = '', alive = true, connected = false;
function render() {
  const text = labels[locale] || labels['en-US'];
  title.textContent = text.title; button.textContent = text.run;
  status.textContent = text[phase] + (result ? ': ' + result : '');
  button.disabled = !connected || phase === 'running';
}
render();
const unsubscribe = MEPlugin.subscribe(event => {
  if (event.type === 'context') { locale = event.locale; render(); }
});
window.addEventListener('unload', () => { alive = false; unsubscribe(); }, { once:true });
button.addEventListener('click', async () => {
  phase = 'running'; result = ''; render();
  try {
    const { taskId } = await MEPlugin.invoke('ping', {});
    while (alive) {
      const task = await MEPlugin.status(taskId);
      if (!alive) return;
      if (task.state === 'succeeded') { phase = 'success'; result = task.result.message; break; }
      if (['failed','cancelled'].includes(task.state)) throw Error(task.error?.code || 'PLUGIN_CANCELLED');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch { phase = 'failed'; }
  if (alive) render();
});
MEPlugin.ready().then(context => {
  if (!alive) return;
  locale = context.locale; connected = true; phase = 'ready'; render();
}).catch(() => { if (alive) { phase = 'failed'; render(); } });
```

<!-- example:v2/README.md -->
```markdown
# 示例工作区
导入并启用，打开工作区点击测试。返回固定消息，不联网、不读文件或媒体；界面跟随 ME 主题和语言。无需编译和额外依赖，可通过可用的可信 Agent 集成测试只读 ping。许可：0BSD，无卸载需清理的私有数据。
```

另将第 3 节完整 LICENSE.txt 复制到本示例压缩包中。

## 7. 工作区接口与生命周期

宿主注入 window.MEPlugin：ready()、invoke(command,input)、status(taskId)、cancel(taskId)、request(method,input)、subscribe(callback)。订阅返回取消订阅函数。ready 返回 {pluginId,version,locale,theme}；invoke 返回 {taskId}。任务状态 queued/running/succeeded/failed/cancelled，成功 result，失败 {error:{code,retryable}}。进度是快照，只在需要时轮询，销毁时清理计时器和订阅。

| 工作区请求 | 权限 | 输入与结果 |
|---|---|---|
| dialog.open | ui.dialogs | {extensions:['txt'],multiple:false} → {cancelled,files:[{token,name,size}]} |
| dialog.save | ui.dialogs | {token} → {cancelled} |
| media.selection | media.read | {} → 命令绑定的选区，需 selection-dialog 能力 |
| dialog.directory | ui.dialogs | {} → {cancelled:true} 或 {cancelled:false,token,name}，需 directory-token 能力 |
| storage.resource | storage.read | 相对 {path} → 会话内有效的图片 {url} |
| clipboard.write | ui.clipboard | {text} 最多 100000 字符 → {written:true} |
| external.open | ui.external | {url} → {opened:true} 或 {cancelled:true} |
| creators.confirm | creators.propose | {planId} → {imported,existing,failed:[{index,code}],cancelled} |
| diagnostics.report | 有效工作区 | 第 16 节纯数值报告 |
| diagnostics.log | 有效且可见工作区 | 可选的已捕获错误报告；检测 debug-logs 能力，见调试指南 |

正确调用为 MEPlugin.request('storage.resource',{path})，不存在 MEPlugin.storage.resource。sdk.request 和 MEPlugin.request 方法集合不同。pluginJobConfigure、pluginJobControl、安装器、信任控制属于主体内部，不是插件 SDK。

较新宿主的 ready() 另返回可选 features 和 selectionBound。使用新增接口前检测能力，字段缺失不能视为支持。详细返回格式和失效条件见选区指南。

脚本样式随包以相对路径加载，禁止内联脚本、eval、外部脚本、浏览器直接联网、Node 集成和 Electron IPC。外部文本用 textContent，不能 innerHTML；联网放后台。不复制主体桥接代码、不持久保存工作区或文件凭据。停用、卸载、隐私锁和升级替换会撤销会话；隐藏或关闭时请求可能失败，不能缓存写入后在返回时重放，应新会话重读状态。

接口 1 表单打开时绑定媒体选择，换选区需重开。接口 2 工作区不隐式提供媒体选区；声明选区弹窗命令后，可由媒体菜单显式绑定快照。默认工作区侧栏页面；workspace 可设 placement:'creator-toolbar'、platform、presentation:'dialog' 作为平台工具栏弹窗。支持 DOUYIN/TIKTOK/XIAOHONGSHU/TWITTER/INSTAGRAM/BILIBILI/PIXIV/FANTIA/OTHER。侧栏必须 page 且无 platform，不接受任意 DOM 选择器。关闭或 Escape 沿用主体任务选择。



选区条件 `when.selection`、命令弹窗 `ui.open`、工作区 `media.selection`、目录授权 `dialog.directory` / `files.resolve(write-dir)` 和托管 `runtime.tool(ffmpeg)` 见[选区弹窗与转码工具](selection-workspace.zh-CN.md)。该文档包含能力检测、完整可运行预检插件、权限与关闭规则；不能将这些新增能力默认视为所有旧版 ME 均支持。

## 8. 主题、语言与交互

未指定颜色继承 ME 并随主题更新，开发者明确指定则优先。可选 theme 支持 ink/muted/line/panel/canvas/blue/blue-dark/good/warning/danger/plugin-on-accent，值是 # 开头 3/4/6/8 位十六进制；不接受任意 CSS 或脚本。工作区 CSS 使用同名 -- 变量，覆盖仅本插件，不改变主体风险确认。

标签、错误、加载、确认均提供完整中英，监听 context 事件，切语言不丢输入、选择、任务和待确认状态。ID、协议及用户内容不翻译。模型标签语言独立于界面语言。离线词典随源码和 files 提供，在提议前翻译，未翻译词保留原文并说明，不能重排模型标签表。审核和保存的标签一致。

按钮等高、排版清晰、键盘焦点可见、窄窗可用。用主题区分主次和危险操作。等待设置、重型模块、模型、大列表之前先显示界面，列表分页或虚拟化。设置读失败须可见可重试，不用空默认覆盖原配置。

### 说明文本与圈叹号帮助

普通补充说明放在对应控件旁的圈叹号帮助入口，避免常驻大段文字。必要警告、权限要求、删除或覆盖等操作后果、错误和实时任务状态必须直接显示，不能隐藏到提示中，也不能替代主体确认。

帮助须支持键盘聚焦、点击和触摸，具备可读名称与说明关联；提示打开时 Escape 只关闭提示。同步中英文与主题，保留输入和任务状态，检查窄屏、窗口边缘及长文本。动态节点重复初始化不得重复绑定，销毁时清理监听、订阅、观察器和计时器。

主体帮助组件不作为沙箱插件 API 暴露。接口 1 使用已定义的描述字段，接口 2 在自己的 iframe 内实现，不能访问主体 DOM。见[可运行的插件说明提示示例](contextual-help.zh-CN.md)，包含真实可用代码、接入步骤与检查清单。

## 9. 存储、依赖和手动资源

使用 storage.directory，不硬编码盘符、用户目录或版本目录。ME 托管代码及数据在程序 AppData 下，模型、虚拟环境、设置、缓存、下载和临时文件用分配的目录。子安装器 TEMP/TMP/TMPDIR 指到其中，原生代码自行遵守，不能把缓存写到其它磁盘。

通过 sdk.request('runtime.tool',{name:'uv'}) 复用兼容的 ME 托管 Python，把返回目录用于 UV_PYTHON_INSTALL_DIR、UV_CACHE_DIR。在私有目录创建虚拟环境，由工具按支持方式引用或链接解释器，不另分发整套 Python。不改共享解释器包、不回退系统 Python。兼容解释器缺失时才准备并明确显示。Python -I 忽略 PYTHONUTF8，JSON 行协议应使用 -X utf8，测试中文路径。

可选 environment:{checkCommand,installCommand} 引用不同的现有 center 命令；检查命令无表单输入。ME 在已启用空闲时检查，返回 {ready:true} 才显示就绪。可以验证资源并短暂启动关闭推理进程，不得下载、安装或改媒体。安装必须用户触发。只有模型文件不代表推理依赖已就绪。

resources 最多 10 项 {name,size,sha256,urls}：无路径文件名、正安全整数、64 位小写摘要、1 至 4 个无凭据 HTTPS 地址，官方源在前、镜像在后。主体展示直链、校验值及实际目录。手动放置前停止安装，按原名放完整文件，再安装校验；.partial 不算完整。

下载固定版本、大小、摘要，有连接和无数据超时，写临时文件，校验后原子替换；镜像同摘要。有效模型及标签表应复用，不因缺依赖重复下载。说明联网目标、资源许可、大小和磁盘需求。资源完整性验证与主体取消日常插件整包扫描不是一回事。

## 10. 进度与错误

长任务约每 500 毫秒调用 tasks.progress，等待最后一次上报。done/total 必填安全整数，0 <= done <= total <= 10000。可选 phase 为 preparing/runtime/dependencies/downloading/verifying/processing/ready。receivedBytes/totalBytes 非负安全整数，前者不大于后者；总量未知同时省略或为零，显示不定进度。file 是不含路径的文件名，最多 100 字符。

可选 activity 为 environment/resolving/resolved/packageDownloading/packageDownloaded/prepared/installed；packageName 以字母数字开头，仅字母数字、下划线、点、连字符，最多 80 字符。elapsedSeconds/quietSeconds 为 0 至 86400 整数。实时提取安装器已知阶段，不转发可能含路径和凭据的原始日志。暂无新输出不等于卡死，不编造百分比。

可选 data 是纯 JSON 对象，最大 64 KiB、深度 8、节点 2000，主体复制校验。只保存最新快照，不保证每次上报都被轮询收到。结束返回完整结果或重新查询补齐。

| 错误 | 处理 |
|---|---|
| PLUGIN_PERMISSION_DENIED | 查插件和命令权限、上下文、当前授权 |
| PLUGIN_SOURCE_CHANGED、PLUGIN_APPROVAL_EXPIRED | 重新读取选区及状态、重新提议，不强制写旧计划 |
| PLUGIN_PACKAGE_MISSING、PLUGIN_PACKAGE_CHANGED | 提示修复重装或升级后重开，不清空数据 |
| PLUGIN_BUSY | 等待现有任务，不重复写入 |
| PLUGIN_CANCELLED、PLUGIN_TIMEOUT | 停后续工作，清临时资源，保留已提交数据 |
| PLUGIN_REQUEST_PENDING | 返回前 await 全部 SDK 请求 |
| 其它 | 本地化明确失败和处理建议，不露堆栈、路径和凭据 |

部分失败统一为 PLUGIN_REQUEST_FAILED。使用 try/catch/finally。进程单消息上限 2 MiB，大文件用凭据；每插件一个后台命令，最多四插件并行，接口 1 默认 30 分钟超时。写入结果未知时不盲目重试。

## 11. 主体图片任务和审核

声明 automation:{command:'tag-images'}，命令存在且有 media.read、tags.propose。命令能处理单张选中图片并返回提议；主体提供选区、全库、新图监听、统计、暂停继续停止、审核和自动写入。不要另做主体队列或调用 pluginJob*。

- 新图监听默认关闭，用户开启后随 ME 恢复；开启建立基线，不启动扫描旧库。停用插件不自动运行。
- 手动识别开始前主体让用户选择逐图审核或自动写入。改默认设置不追溯批准旧结果，明确确认才可应用所选已有结果。
- skipRecognized 默认 true，三类任务共用；零标签、待审、已写入都算成功，失败可重试。关闭后重新推理，成功才替换同图旧待审，不删已写入标签。
- 每次手动任务独立统计，历史待审和识别记录独立保留；混合选区只图片入队，不重叠创建手动任务。
- 暂停等当前图结束，继续恢复。停止终止当前任务但保留 watchNew，后来新图可开始下一任务，关闭监听须另操作。
- 清空仅当前队列、taskId、计数、错误；运行或在途时禁止，保留待审、历史、设置、模型、标签。
- 审核展示图片、原标签和带叉的候选标签。删候选不删原标签，全删后仍可通过为已审核。主体检查子集、源和标签冲突、安装记录身份，不重扫包。
- 全部通过冻结批次、保留候选删除，作为一次媒体库事务提交；冲突整批停止，新结果留下一批。1000 待审达到保护上限后暂停。
- 自动写入默认关闭，由主体用户确认开启；插件仍仅返回提议，不能自授批准。关闭后未提交保留待审，冲突不覆盖手动修改。
- 关闭按状态提供后台继续、保留暂停、停止、保留或清空待审；取消不改变状态，清待审不删媒体和已写入标签。

## 12. 文件与博主导入

导入：UI dialog.open → token 传给后台 → files.resolve({token,mode:'read'})。导出：后台在私有目录生成完整文件 → files.export({path,name}) → UI dialog.save({token})。凭据属于同插件、用户、工作区，30 分钟过期，关闭撤销。单文件 128 MiB，一次最多 20 个文件、1 至 10 个扩展名过滤。UI 不传大型 Base64 或绝对路径。storage.resource 支持校验后的 PNG/JPEG/GIF/WebP/BMP，最大 16 MiB，不支持 SVG。

external.open 只接受检查过的 HTTP(S) 或受限 magnet，不是任意程序启动。magnet 一个 xt=urn:btih，40 位十六进制或 32 位 Base32；可选 dn、重复 tr（HTTP/HTTPS/UDP），无 xs、凭据、控制字符，最长 8192。取消不启动外部程序，有效信任改变确认而不改变协议规则。

当前博主导入适配器只支持 X，其它工具栏平台 ID 不代表已支持该平台导入。博主 records 项为 {platform:'x',creatorId?,handle?,url,name?,avatarUrl?}。ID 是数字字符串，URL 和 handle 一致，头像是可选 HTTPS 元数据，不触发下载。每批最多 500，查询后提议，主体校验去重冻结；UI creators.confirm，未信任需批量确认。保留已有记录、标签、追更游标，重复确认幂等。超 500 展示总数、当前批和剩余，不截断尾部。Agent 可提议不能自批准，导入不隐式解析、下载、云同步。

## 13. 激活与 Agent 命令

接口 2 可选 activation:{type:'password',algorithm:'scrypt',salt,digest}。salt 为 32 位小写十六进制，digest 为 64 位；使用 scrypt(password,Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1})，不存明文。主体管理激活，五次错等一分钟；停用重启及合规同签名升级保留激活，卸载撤销，即便保留数据。换签名不可继承，Agent 不代激活。

声明 agent 上下文、真实结构、副作用、权限。ME 可信适配层构造调用者，不能由模型输入构造。宿主分发器 discover/invoke/status/cancel 是内部集成接口，不是额外 iframe API。提交及出队检查隐私、启用、激活、信任，每插件串行，最多 32 排队，忙碌要可见。

Agent 写删需有效信任，input 的 confirmed/trusted 无授权效力。结果无 Cookie、密码、令牌，部分失败返回结构化成功失败。时间查询有范围及时区，不以本地列表冒充远程检查。任务历史最多 1000，无键完成记录可淘汰，有幂等键在服务生命周期至少保留 30 分钟；崩溃后不保证幂等，不盲目重试未知写入。

## 14. 升级、卸载与持久化

ID 稳定，三段版本号递增，同版本不覆盖。升级保留启用、私有数据、合法参数；接口 1 以插件 ID/命令 ID/key 保存值，含义变化换 key。签名权限规则对激活信任独立于普通设置。

所有自有 JSON 有 schemaVersion，迁移前备份，完整临时写入后原子替换，测试旧数据。不能直接截断或读失败当空库，不把模型设置放代码版本目录。

主体负责安装卸载进度及恢复。卸载默认保留数据，关闭工作区、停用、取消任务、脱离自动任务、删除注册，再清代码及用户选删的私有数据。注销后文件锁失败表示已卸载待清理，重试不扩大删除选择、不删新安装。保留媒体原件、已写标签、共享 Python/缓存，兼容旧目录不参与私有数据删除。

storage:{binding:'actor-tracker'} 仅特许签名旧插件可用，不是任意目录 API，第三方不得照抄。目录下架不禁用或卸载本地副本，离线目录缓存可能过时需准确告知。

## 15. 打包、投稿与发布

压缩包文件名前缀应与 `plugin.json.id` 一致，推荐命名为 `<id>-<version>.zip`。填写投稿表单时，必须打开包内 `plugin.json`，分别读取 `id` 和 `version`；不能根据显示名称填写，也不能随意截取文件名作为 ID。文件名只帮助识别，清单才是身份依据。

例如，清单中 `id` 为 `example.tagger`、`version` 为 `1.1.4`：

| 项目 | 正确值 |
|---|---|
| 安装压缩包文件名 | `example.tagger-1.1.4.zip` |
| 投稿插件 ID | `example.tagger` |
| 投稿版本 | `1.1.4` |
| 可选源码包文件名 | `example.tagger-1.1.4-source.zip` |

投稿 ID 不包含版本号、`.zip` 或 `-source`。即使源码包额外带有 `source` 后缀，ID 仍为 `example.tagger`。新源码投稿限定 ZIP；本地插件安装仍支持 ZIP/7z，这是两个不同入口，不应混淆。

选择投稿 ZIP 后，ME 会读取包内 `plugin.json`，自动填入插件 ID 和版本；提交前检测到不一致时会阻止上传。自动填充依据清单，不依据文件名。上传后，服务器再次核对 ID 和版本；不一致的投稿会被驳回并提示正确值，不进入人工审核。如果客户端未提供自动填充，请手动填写清单中的值，服务器仍会进行相同校验。

安装包是 ZIP/7z，不是 EXE，清单、入口、README、许可和可运行依赖直接根目录，不套文件夹；无加密、链接、穿越、大小写重名。安装上限 64 MiB，解包 512 MiB、10000 条目；不是固定源码投稿上限。大模型独立下载。

JavaScript 无需编译；TypeScript 或打包器需完整原源码、锁定依赖及锁文件、构建说明、可运行输出及依赖许可。不能靠主体 node_modules 或全局安装。当前发布按 files 核对已审核源码并封装 ZIP，不执行上传构建脚本或 npm install。干净环境验证后投稿。

投稿源码用于审核，已发布的安装 ZIP 与签名目录通过官方插件中心分发。投稿 ID/版本匹配清单，登录后提交完整源码和许可、权限用途、依赖联网模型、故障及保留数据说明。审核通过、排队、构建、已发布是独立状态，须真实客户端下载校验安装才算发布验证成功。使用现有接口的兼容插件上架后，用户可直接在插件中心下载安装，无需为该插件单独更新 ME。发布后应验证实际下载和安装结果。

官方认证是管理员单独审核动作，绑定审核者、时间、源码摘要、ID、版本，普通审核为社区身份。构建用原审核源码，变更重审。源码与分发包摘要分别关联，作者或签名本身不证明官方。

发布方生成 signature.json，schema 2 用 Ed25519 签 UTF-8 JSON.stringify({schemaVersion:2,purpose:'me-plugin-package',publisher:{origin,id},files})，origin 为 official/community，id 是官方审核管理员或社区投稿者 UUID；files 为按 JS 字典序排序且排除 signature.json 的 SHA-256 映射。不能本地化排序或把最终 ZIP 摘要放自身签名；目录绑定相同发布者版本和最终摘要，安装前复查当前分发授权。schema 1 不自动官方；不伪造 UUID、不分发密钥、不以本地签名代官方认证。

## 16. 诊断与启动性能

可选 MEPlugin.request('diagnostics.report',{stage,elapsedMs,count?,bytes?})：阶段仅 ui.mount/ui.interactive/ui.list_rendered/ui.initialized/ui.longtask，毫秒有限 0 至 3600000，count 整数 0 至 10000000，bytes 整数 0 至 1 GiB，多余字段拒绝，每有效会话最多 16 次。不支持时不阻断功能，不发路径、文件名、身份、URL、内容、凭据或任意日志文本。列表完成只是插件声明 DOM 完成，不证明绘制完成。

主体记录有限数值阶段，最近工作区打开后最多两分钟进程级聚合；嵌套并发重叠，不能求和当总时延。分别测界面、桥接、设置、首批数据和完整初始化，使用足够规模合成库与多个后台空闲插件。页面切换快不等于插件启动快。

## 17. 不支持的能力和常见错误

- 接口 1 主体表单无任意 HTML；接口 2 沙箱工作区可自定义，但都不能向主体注入。
- SDK 没有任意媒体删除改名、数据库、账号凭据、改信任、自批准标签、代激活。
- storage.directory 返回路径，不是设置对象；runtime.tool 返回工具路径，不保证插件环境装好。
- 下载成功不等于安装成功，环境就绪不等于识别完成，识别完成不等于已审核。
- 不缓存会话凭据，不分享其它插件私有文件、不用主体私有 imports。缺能力应公开 SDK 扩展，不附带任意主体补丁。
- 下架、卸载、删私有数据、停任务、清待审不是同一件事。

## 18. 必做验证及交付

### 不依赖 ME 源码的本地调试

提供 debug-logs 能力的 ME 宿主支持统一插件调试：打开插件设置，开启开发者调试日志，复现问题后导出脱敏 JSON。记录包括后台和工作区错误、相对堆栈位置、任务编号及限量标准输出/错误输出。分享给 agent 前请检查内容。调试默认关闭，不上传数据。

详细容量、生命周期、已捕获错误报告接口、脱敏边界及源码映射限制见[插件调试与脱敏日志](debugging.zh-CN.md)。没有该能力的旧版宿主仍只有任务状态、错误代码及纯数值性能报告，不具备这套完整收集流程；不能宣称所有异常都能捕获。
记录实际结果、宿主版本、接口和插件版本。不适用须说明，不默默跳过。

| 项目 | 必须验证 |
|---|---|
| 首次安装 | 根目录、清单、依赖许可、默认停用、启用激活和失败恢复 |
| 接口 | 合法非法输入输出、缺权限上下文、空混合选区、未知能力可见失败 |
| 界面 | 中英切换保留输入、继承和自定义主题、窄窗键盘、先界面后数据、设置慢或失败 |
| 任务 | 实际进度、未知总量、超时、暂停继续停止清空、重复点击、后台关闭、隐藏不重放 |
| 审核 | 删候选、通过取消全部通过、自动写入、旧待审、源冲突、单次计数、跳过已识别 |
| 资源 | 模型标签复用、缺失损坏、手放镜像摘要、依赖进度、取消、中文路径、离线就绪 |
| 升级 | 保留启用设置数据环境、迁移备份、签名或权限变化不继承错误授权 |
| 信任 | 本地官方非固定，手动信任与目录官方操作策略一致，伪造输入无效 |
| 卸载 | 保留或删除、任务退出、清理重试、保留媒体标签共享运行时、重装激活 |
| 发布 | 完整源码复现、审核摘要绑定、真实目录下载校验安装 |
| 性能 | 大库、多空闲插件、无日常全包校验、早期可操作、有界列表 |

交付完整源码包、安装包、两个摘要、版本、构建命令或无需构建说明、依赖许可、限制及完整测试清单。兼容性声明应列出实际测试的 ME 版本；发布状态以插件中心显示及实际下载安装结果为准。
