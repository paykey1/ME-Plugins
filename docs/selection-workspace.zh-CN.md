# 选区弹窗、目录授权与转码工具

## 支持范围

这是接口 2 的增量能力，不改变旧插件的接口号。不能仅根据 ME 版本号或指南更新时间判断支持情况。工作区通过 `MEPlugin.ready()` 返回的 `features` 检查 `selection-dialog`、`directory-token`、`ffmpeg-tool`；缺少任何必需能力就禁用对应功能并提示用户使用兼容的 ME。`selectionBound` 表示本次会话是否绑定选区。旧宿主可能忽略新增清单字段，不能把清单导入成功视为能力可用；发布插件前列出实际测试的 ME 版本。

## 命令与选区

- 命令可声明 `when:{selection:{minCount,maxCount,sameType,types}}`。数量为 1–10000 的整数，默认下限 1、上限 10000；`sameType` 为布尔值，默认不限制；`types` 为 image/video/audio 的非空、不重复子集。未知字段或非法值拒绝安装。
- 类型依据媒体库的 `asset.type`，不依据后缀。因此 MP4/AVI/MOV 可以同选；图片与视频在 `sameType:true` 时不满足条件。没有 `when` 的既有行为不变，不改变旧 `images` 上下文语义。
- 接口 2 命令同时声明 `contexts:['selection']` 和 `ui:{open:'workspace-dialog',bindSelection:true}`，由媒体右键菜单或顶部插件菜单打开 `workspace.entry`。插件必须声明 `media.read`，工作区仍使用原有 sidebar/page 或 creator-toolbar/dialog 配置；不新增 placement 值。
- 不满足条件的入口可见但灰显，并显示原因。主体在打开弹窗和启动后台任务时再次校验；插件仍应检查自己的格式、参数及输出约束。
- 打开只呈现界面，不执行命令。实际工作使用另一个声明 `contexts:['workspace']` 的命令，由用户确认参数后通过 `MEPlugin.invoke` 启动。不能把只声明 selection 的入口命令直接当作 workspace 命令调用。
- `MEPlugin.request('media.selection',{})` 返回绑定的 `[{assetId,path,type}]`，不接收任意 ID。后台 `sdk.request('media.selection',{})` 取得同一选区。侧栏直接打开的会话没有选区，返回 `PLUGIN_SELECTION_INVALID`；更换媒体选区需要关闭重开。
- 绑定内容包含打开时媒体状态，媒体被修改、删除或路径改变时返回 `PLUGIN_SELECTION_CHANGED`，需重开重新确认。关闭、停用、卸载、隐私锁和升级替换撤销会话。

## 输出目录

工作区调用 `MEPlugin.request('dialog.directory',{})`，需 `ui.dialogs`，不接受自定义路径或额外字段。取消返回 `{cancelled:true}`；通过系统目录选择及明确写入确认后返回 `{cancelled:false,token,name}`，界面不拿到目录绝对路径。

后台通过 `sdk.request('files.resolve',{token,mode:'write-dir'})` 得到 `{path,name}`。凭据绑定插件、用户和工作区，有效期 30 分钟；关闭后撤销，过期、替换目录、跨会话或跨插件使用均失败。每次执行前重新解析，不能持久化 token 或将解析出的路径当作永久授权。

一次目录确认可用于该会话内的整批输出，不逐文件弹窗。官方或用户信任状态也不跳过这次目录授权。目录授权允许新建输出，不代表可以覆盖原文件、删除媒体或直接修改媒体库。插件必须使用独立输出名称、拒绝已有目标（例如 ffmpeg `-n`），保留源文件；需要修改媒体库时使用主体已经提供的提议和确认接口，不能绕过审核。

插件后台仍是 trusted-native 原生进程，目录 token 约束的是主体接口，不是操作系统沙箱。主体无法收回原生插件已读到的路径或停止其私自启动的脱离进程；开发者必须遵守上述约定，不后台保留目录权限。

## FFmpeg 与任务生命周期

后台声明 `runtime.tools` 后调用 `sdk.request('runtime.tool',{name:'ffmpeg'})`，返回现有 ME 托管可执行文件的 `{path}`。它不接受自定义程序路径，不启动下载，不修改系统环境；未准备好时返回 `PLUGIN_TOOL_UNAVAILABLE`。前端的 `ffmpeg-tool` 表示接口支持，不代表依赖已安装。原 uv/7z 返回契约不变。

通过 `execFile` 或 `spawn` 的参数数组调用，不启用 shell；白名单校验容器、编码、参数、输入和输出路径。不要拼接命令字符串、接受任意参数或启动 detached 子进程。使用 `tasks.progress` 持续上报批量进度；用户取消时主体终止插件进程树。关闭时可以选择取消关闭、后台继续或停止任务，但会话关闭后选区和目录凭据立即失效：依赖这些接口的任务应保持弹窗打开，或选择停止，不能缓存授权用于后续请求。只在私有目录写临时文件，失败或重试不得删除用户原文件。

## 可运行的环境预检示例

以下是完整最小插件。保存对应文件并按清单打包；README 应说明使用方式，LICENSE.txt 使用完整 0BSD 许可文本（见完整指南）。本例只调用 FFmpeg `-version` 检查环境，不转换媒体、不产生输出、不修改标签。选中同类型媒体后，从“转换准备示例”入口打开；选择目录并确认，再点击检查环境。用于转换时另行实现格式参数、输出防覆盖、进度与取消处理。

### plugin.json

<!-- selection-example:plugin.json -->
```json
{
  "schemaVersion": 1,
  "apiVersion": 2,
  "id": "example.conversion-setup",
  "version": "1.0.0",
  "name": {
    "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
    "en-US": "Conversion setup example"
  },
  "description": {
    "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
    "en-US": "Conversion setup example"
  },
  "author": "Example Author",
  "license": "0BSD",
  "mode": "trusted-native",
  "entry": "main.js",
  "files": [
    "plugin.json",
    "main.js",
    "README.md",
    "LICENSE.txt",
    "ui/index.html",
    "ui/app.js",
    "ui/style.css"
  ],
  "permissions": [
    "media.read",
    "ui.dialogs",
    "runtime.tools"
  ],
  "workspace": {
    "entry": "ui/index.html",
    "title": {
      "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
      "en-US": "Conversion setup example"
    }
  },
  "commands": [
    {
      "title": {
        "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
        "en-US": "Conversion setup example"
      },
      "description": {
        "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
        "en-US": "Conversion setup example"
      },
      "effects": [
        "read"
      ],
      "permissions": [
        "media.read"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "outputSchema": {
        "type": "object"
      },
      "id": "convert",
      "contexts": [
        "selection"
      ],
      "ui": {
        "open": "workspace-dialog",
        "bindSelection": true
      },
      "when": {
        "selection": {
          "minCount": 1,
          "maxCount": 500,
          "sameType": true,
          "types": [
            "image",
            "video",
            "audio"
          ]
        }
      }
    },
    {
      "title": {
        "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
        "en-US": "Conversion setup example"
      },
      "description": {
        "zh-CN": "\u8f6c\u6362\u51c6\u5907\u793a\u4f8b",
        "en-US": "Conversion setup example"
      },
      "effects": [
        "read"
      ],
      "permissions": [
        "media.read",
        "ui.dialogs",
        "runtime.tools"
      ],
      "inputSchema": {
        "type": "object",
        "properties": {
          "directoryToken": {
            "type": "string",
            "maxLength": 100
          }
        },
        "required": [
          "directoryToken"
        ],
        "additionalProperties": false
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "count": {
            "type": "integer",
            "minimum": 0
          },
          "ready": {
            "type": "boolean"
          }
        },
        "required": [
          "count",
          "ready"
        ],
        "additionalProperties": false
      },
      "id": "inspect",
      "contexts": [
        "workspace"
      ]
    }
  ]
}
```

### main.js

<!-- selection-example:main.js -->
```js
'use strict';
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
exports.run = async ({command, input, sdk}) => {
  if (command !== 'inspect') throw Error('PLUGIN_COMMAND_INVALID');
  const rows = await sdk.request('media.selection', {});
  if (!rows.length || rows.length > 500 || new Set(rows.map(row => row.type)).size !== 1 || rows.some(row => !['image','video','audio'].includes(row.type))) throw Error('PLUGIN_SELECTION_INVALID');
  await sdk.request('files.resolve', {token:input.directoryToken, mode:'write-dir'});
  const tool = await sdk.request('runtime.tool', {name:'ffmpeg'});
  // Diagnostic only. Arguments are fixed, with no shell and no media writes.
  await promisify(execFile)(tool.path, ['-version'], {windowsHide:true, timeout:10000, maxBuffer:65536});
  return {count:rows.length, ready:true};
};
```

### ui/index.html

<!-- selection-example:ui/index.html -->
```html
<!doctype html>
<html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ME</title><link rel="stylesheet" href="style.css"></head>
<body><main><h1 id="title"></h1><p id="selection"></p><button id="directory" disabled></button><span id="folder"></span><button id="inspect" disabled></button><p id="status" role="status" aria-live="polite"></p></main><script src="app.js"></script></body></html>
```

### ui/style.css

<!-- selection-example:ui/style.css -->
```css
body { color:var(--ink); background:var(--panel); font:16px system-ui; margin:1rem; }
button { color:var(--ink); background:var(--canvas); border:1px solid var(--line); border-radius:.5rem; padding:.6rem; margin:.4rem; }
button:focus-visible { outline:2px solid var(--blue); }
button:disabled { opacity:.5; }
p, span { overflow-wrap:anywhere; }
```

### ui/app.js

<!-- selection-example:ui/app.js -->
```js
'use strict';
const $ = id => document.getElementById(id);
const labels = {
  'en-US': {title:'Conversion setup example',directory:'Choose output folder',inspect:'Check environment',selection:'Selected media',loading:'Loading...',ready:'Ready. This example checks setup only; it does not convert or write files.',unsupported:'Open this plugin from a media selection in a compatible ME version.',running:'Checking...',done:'Check completed. No files were changed.',failed:'Unable to complete. Reopen the dialog to retry; if FFmpeg is unavailable, prepare the ME managed media runtime first.'},
  'zh-CN': {title:'\u8f6c\u6362\u51c6\u5907\u793a\u4f8b',directory:'\u9009\u62e9\u8f93\u51fa\u76ee\u5f55',inspect:'\u68c0\u67e5\u73af\u5883',selection:'\u6240\u9009\u5a92\u4f53',loading:'\u6b63\u5728\u52a0\u8f7d\u2026',ready:'\u5df2\u5c31\u7eea\u3002\u672c\u793a\u4f8b\u53ea\u68c0\u67e5\u73af\u5883\uff0c\u4e0d\u8f6c\u6362\u6216\u5199\u5165\u6587\u4ef6\u3002',unsupported:'\u8bf7\u5728\u652f\u6301\u8fd9\u4e9b\u63a5\u53e3\u7684 ME \u4e2d\u9009\u4e2d\u5a92\u4f53\uff0c\u901a\u8fc7\u53f3\u952e\u83dc\u5355\u6253\u5f00\u6b64\u63d2\u4ef6\u3002',running:'\u6b63\u5728\u68c0\u67e5\u2026',done:'\u68c0\u67e5\u5b8c\u6210\uff0c\u6ca1\u6709\u4fee\u6539\u6587\u4ef6\u3002',failed:'\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u6253\u5f00\u5f39\u7a97\u540e\u91cd\u8bd5\uff1b\u82e5 FFmpeg \u4e0d\u53ef\u7528\uff0c\u8bf7\u5148\u51c6\u5907 ME \u6258\u7ba1\u5a92\u4f53\u8fd0\u884c\u73af\u5883\u3002'}
};
let locale='en-US', phase='loading', rows=[], directoryToken='', name='', alive=true, available=false, busy=false;
function render(){const t=labels[locale]||labels['en-US'];$('title').textContent=t.title;$('directory').textContent=t.directory;$('inspect').textContent=t.inspect;$('selection').textContent=t.selection+': '+rows.length;$('folder').textContent=name;$('status').textContent=t[phase];$('directory').disabled=!available||busy;$('inspect').disabled=!available||!directoryToken||busy;}
const unsubscribe=MEPlugin.subscribe(event=>{if(event.type==='context'){locale=event.locale;render();}});
window.addEventListener('unload',()=>{alive=false;unsubscribe();},{once:true});
$('directory').addEventListener('click',async()=>{busy=true;render();try{const value=await MEPlugin.request('dialog.directory',{});if(!alive)return;if(!value.cancelled){directoryToken=value.token;name=value.name;}}catch{phase='failed';}finally{busy=false;if(alive)render();}});
$('inspect').addEventListener('click',async()=>{busy=true;phase='running';render();try{const {taskId}=await MEPlugin.invoke('inspect',{directoryToken});while(alive){const task=await MEPlugin.status(taskId);if(task.state==='succeeded'){phase='done';break;}if(['failed','cancelled'].includes(task.state))throw Error(task.error?.code);await new Promise(resolve=>setTimeout(resolve,200));}}catch{phase='failed';}finally{busy=false;if(alive)render();}});
render();
MEPlugin.ready().then(async context=>{if(!alive)return;locale=context.locale;if(!context.selectionBound||!['selection-dialog','directory-token','ffmpeg-tool'].every(feature=>context.features?.includes(feature))){phase='unsupported';render();return;}rows=await MEPlugin.request('media.selection',{});if(!alive)return;available=true;phase='ready';render();}).catch(()=>{phase='failed';if(alive)render();});
```

