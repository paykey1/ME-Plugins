# Selection dialogs, directory grants and transcoding tools

## Availability

These are additive API 2 capabilities, not a new API version. Do not infer support from a ME version number or the guide date alone. Inspect `features` returned by `MEPlugin.ready()` for `selection-dialog`, `directory-token` and `ffmpeg-tool`; disable functionality requiring missing features and request a compatible ME version. `selectionBound` indicates whether the current session has a bound selection. Older hosts may ignore new manifest fields: successful import is not proof of support. List the ME versions actually tested before publishing.

## Commands and selections

- Commands may declare `when:{selection:{minCount,maxCount,sameType,types}}`. Counts are integers from 1 to 10000, defaulting to 1 and 10000; `sameType` is an optional boolean, defaulting to unrestricted; `types` is a nonempty, duplicate-free subset of image/video/audio. Unknown fields and invalid values are rejected at installation.
- Types come from library `asset.type`, not extensions: MP4/AVI/MOV may be selected together; image/video mixtures fail `sameType:true`. Commands without `when` retain existing behavior, including legacy `images` context semantics.
- An API 2 command with `contexts:['selection']` and `ui:{open:'workspace-dialog',bindSelection:true}` opens `workspace.entry` from the media context menu or top plugin menu. The plugin must declare `media.read`. Keep the existing sidebar/page or creator-toolbar/dialog workspace configuration; no new placement value is introduced.
- Ineligible entries remain visible but disabled, with a reason. The host rechecks on opening and before backend execution. Plugins must still validate their own format, parameter and output requirements.
- Opening displays UI only; it does not execute the command. Declare a separate `contexts:['workspace']` command and call it with `MEPlugin.invoke` after the user confirms parameters. A selection-only launch command cannot be invoked as a workspace command.
- `MEPlugin.request('media.selection',{})` returns bound `[{assetId,path,type}]`, without accepting arbitrary IDs. Backend `sdk.request('media.selection',{})` receives the same selection. Sessions opened directly from the sidebar are unbound and return `PLUGIN_SELECTION_INVALID`. Close and reopen to change the selection.
- The snapshot includes media state at opening. Modification, removal or a changed path produces `PLUGIN_SELECTION_CHANGED`; reopen for a new decision. Closing, disabling, uninstalling, privacy lock and replacement revoke the session.

## Output directories

Call `MEPlugin.request('dialog.directory',{})` from the workspace with `ui.dialogs` permission. Custom paths and extra fields are not accepted. Cancellation returns `{cancelled:true}`. After the system folder picker and explicit write confirmation, the response is `{cancelled:false,token,name}`; the UI does not receive an absolute directory path.

The backend resolves `{path,name}` with `sdk.request('files.resolve',{token,mode:'write-dir'})`. Tokens are bound to plugin, user and workspace for 30 minutes. Closing revokes them; expiry, directory replacement and use across sessions or plugins fail. Resolve before each execution; never persist tokens or treat a resolved path as a permanent grant.

One directory confirmation covers batch output within that session, without per-file prompts. Official or user-granted plugin trust does not bypass directory authorization. The grant allows new output; it is not permission to overwrite originals, delete media or directly alter the library. Use separate output names and refuse existing targets (for example FFmpeg `-n`), preserving sources. Library changes must use available host proposal and confirmation APIs.

The backend is still a trusted-native process. Tokens constrain host API access, not the operating system. The host cannot retract paths already read by native code or control privately detached processes. Developers must honor the contract and must not retain directory access in the background.

## FFmpeg and task lifecycle

With `runtime.tools`, backend `sdk.request('runtime.tool',{name:'ffmpeg'})` returns `{path}` for an existing ME-managed executable. It accepts no custom executable path, starts no download and changes no system environment. An unavailable runtime returns `PLUGIN_TOOL_UNAVAILABLE`. The `ffmpeg-tool` feature indicates interface support, not installed dependencies. Existing uv/7z result contracts remain unchanged.

Use `execFile` or `spawn` with an argument array and no shell. Allowlist containers, codecs, options and input/output paths; never concatenate shell commands, accept arbitrary options or spawn detached children. Report batch progress with `tasks.progress`; host cancellation terminates the plugin process tree. Closing offers cancel-close, background continuation or stop, but immediately revokes selection and directory tokens: tasks requiring those APIs should keep the dialog open or stop. Never cache authorization for later requests. Temporary output belongs in private storage, and errors or retries must not delete source files.

## Runnable environment-check example

Save the files below and package according to the manifest. Supply a usage README and the complete 0BSD text in LICENSE.txt as shown in the complete guide. This example only runs FFmpeg `-version`; it does not convert media, create output or change tags. Select media of one type, open Conversion setup example, choose and authorize a directory, then check the environment. Actual conversion additionally needs format controls, overwrite prevention, progress and cancellation handling.

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

