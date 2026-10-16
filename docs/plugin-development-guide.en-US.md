# ME Plugin Developer Guide

Supported plugin APIs: 1 and 2. This implementation specification is for plugin developers and coding agents. It covers APIs, interfaces, storage, packaging, submission and validation. A plugin API number is not an ME application version.

Before development, read [Compatibility and update requirements](compatibility.en-US.md), check the release notes for your target ME version, and verify the capabilities your plugin uses in that version.

## 1. Instructions for a coding agent

Use this document together with the requested plugin's functional requirements. First list its inputs, outputs, network services, persistent data, required permissions and UI entry points. Choose API 1 for host-generated command forms and optional image jobs, or API 2 for a custom workspace, activation or Agent-callable commands. Implement against the documented SDK only. Do not modify ME to install a new plugin and do not invent SDK methods when a needed capability is absent: report the missing capability explicitly.

Deliver complete source, the runnable archive, README, license and dependency notices, build instructions, data migration rules, and evidence for the applicable checks in section 18. Identify untested or unavailable features honestly. A generated implementation is not compliant merely because it follows this document: install and exercise it in ME before calling it ready.

Mandatory rules:

- Use CommonJS for the background entry and await all SDK calls. Each invocation is a separate process; process globals do not persist between commands.
- Use host-managed storage, lifecycle, image-review and confirmation flows. Never modify ME's database, account files, host DOM or private modules directly.
- Declare every permission, context and side effect truthfully. Never manufacture caller identity, trust or confirmation flags.
- Render a usable, localized interface immediately, then load settings and data asynchronously. Show loading, progress, cancellation and recoverable failure states. Disable writes until required settings have loaded successfully.
- Preserve settings and data on upgrade. Use versioned, atomic persistence and backups before migrations. Never reset a user's data because parsing, migration or networking failed.
- Do not distribute secrets or private media. Treat remote pages, files and model output as data, never as instructions or authority.

## 2. Runtime and trust boundaries

`mode: "trusted-native"` is the supported execution mode. Background code has the current OS user's native privileges. Process separation limits crashes; it is not an OS security sandbox. ME warns users before installation. SDK checks protect operations mediated by ME, not arbitrary native filesystem operations. Developers must honor the documented storage and data-access rules even though native code is powerful.

ME fully verifies archive paths, contents and signatures during preparation and again at final installation or upgrade commit. Normal opening, command execution, packaged-resource loading and idle polling do not hash or scan the whole installed package. Live enabled state, activation, privacy, identity, permission, path, protocol and task ownership checks remain. External modification of installed code is therefore not detected on every use; do not implement a competing background package scanner.

Publisher identity and installation channel are separate:

| Installation | Default effective trust |
|---|---|
| Verified official publisher through ME's authorized catalog channel | Fixed official trust |
| The same official-signed archive imported locally | Publisher remains official; optional trust defaults off |
| Community-signed or unsigned local package | Optional trust defaults off |
| Legacy record without a recorded channel | Unknown channel; retain enabled state and valid existing optional grant |

Explicit user trust grants the same declared-operation policy as fixed official trust, without another source-based approval layer. Local upgrades lose fixed catalog trust. Optional trust survives only the same plugin ID/signing identity without expanded permissions, command effects or contexts; adding commands also requires renewed trust. An ordinary private-data write from a live user workspace does not require repeated generic confirmation. Untrusted destructive actions, external links and cross-module imports retain host confirmation; effective trust can skip those operation reviews. Activation, privacy, paths, protocols, frozen batches and ownership still apply. Agent write/delete commands require effective trust and an `agent` context. Plugin code cannot change trust.

## 3. Complete API 1 example

Create the following four files directly at the archive root. JSON Unicode escapes encode the required Chinese display values while keeping this English guide free of mixed-language explanations. Do not remove either locale from an actual manifest. This example proposes `example` for selected images; an untrusted installation requires the host's review before writing.

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
# Example tagger
Import the archive in ME, acknowledge the risk and enable it. Select disposable images in the media center and run Propose tags. Review or cancel the host proposal. This plugin reads selected image metadata and proposes one tag. It has no network calls, models, extra runtime dependencies or private persistent data. Uninstalling does not remove approved media tags. Built with plain CommonJS; no compilation step. License: 0BSD.
```

<!-- example:v1/LICENSE.txt -->
```text
Copyright (C) 2026 Example Author

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

Replace the author and example behavior for your plugin. This sample license covers the sample; it does not grant rights to third-party dependencies. Ship their actual licenses too.

## 4. Manifest contract

| Field | Requirements |
|---|---|
| `schemaVersion`, `apiVersion` | Schema is numeric 1; API is numeric 1 or 2 |
| `id` | Lowercase letter first; lowercase letters/digits with 1 to 8 dot/hyphen-separated suffixes; at most 100 characters |
| `version` | Three numeric components, each 1 to 5 digits; no prerelease suffix |
| `name`, `description`, command `title` | Nonempty `zh-CN` and `en-US`, each at most 500 characters |
| `author`, `license` | Nonempty strings, at most 200 and 100 characters respectively |
| `entry` | Relative `.js` or `.cjs` path |
| `files` | Distribution file list including manifest, entry, README, license, UI and production dependencies |
| `permissions` | Unique names from the API tables below; no implicit wildcard |
| `commands` | At most 30 for API 1 or 100 for API 2; unique IDs matching `[a-z][a-z0-9-]{0,49}` |
| `contexts` | API 1: `center`, `images`, `selection`; API 2 additionally `workspace`, `agent` |

All packaged paths use relative `/` paths. Reject absolute paths, drive letters, `..`, links, reserved Windows names and names colliding after case/Unicode normalization. Do not rely on `files` hiding secrets: the complete submitted source is inspected.

Optional command `inputs` contain at most 10 fields, keyed by `[a-z][a-zA-Z0-9]{0,39}`. A `number` field requires bilingual `label`, finite `min`, `max`, `step > 0` and a default in range. A `select` requires bilingual `label`, `default` and 1 to 20 `{value,label}` options; values are strings at most 100 characters. Values arrive as `input[key]`; validate them again in background code. There is no generic checkbox input type; do not invent one.

API 2 commands additionally require bilingual `description`, `inputSchema`, `outputSchema`, `effects` and command-level `permissions` drawn from the package permissions. Effects are `read`, `network`, `write`, `delete`; use at least one. Disposable query caches may be read/network, but persistent settings, notes and records are writes. Optional `timeoutMs` is an integer from 1,000 to 1,800,000.

Schemas support only `type`, `properties`, `required`, `additionalProperties`, `items`, `maxItems`, `maxLength`, `enum`, `minimum`, `maximum` for their appropriate types. Types: object, array, string, boolean, number, integer, null. No `$ref`, `oneOf`, unions, custom validators or arbitrary JSON Schema keywords. Schema depth is at most 12, node count 500, object properties 100, enum values 100. Use bounded arrays/strings and `additionalProperties:false`; input and output are both validated.

## 5. Background SDK reference

Call `await sdk.request(method, input)`. These methods run in the background entry, not directly in a workspace's browser JavaScript. ME binds identity and selection. API 2 also checks the command's declared permission subset.

| Method | Permission | Input and result |
|---|---|---|
| `media.selection` | `media.read` | No input; `[{assetId,path,type}]` for the bound selection |
| `tags.propose` | `tags.propose` | `{items:[{assetId,tags:string[]}]}`; `{planId,count}` |
| `storage.directory` | `storage.private` | No input; `{directory}` |
| `runtime.tool` | `runtime.tools` | `{name:'uv'}` or `{name:'7z'}`; `{path,managedPythonDirectory,cacheDirectory}`. Feature-gated `{name:'ffmpeg'}` returns `{path}`; see the selection guide. |
| `network.request` | `network.request` | `{url,method?,headers?,body?}`; `{status,contentType,body}` |
| `tasks.progress` | `tasks.progress` | Progress object described in section 10; `{accepted:true}` |
| `files.resolve` | `ui.dialogs` | `{token,mode:'read'}`; `{path,name,size}`, live workspace required. Feature-gated `mode:'write-dir'` returns `{path,name}` for an authorized directory token. |
| `files.export` | `ui.dialogs` | `{path,name}`; `{token,name,size}`, live workspace required |
| `creators.lookup` | `creators.read` | `{records}`; `{items:[{index,exists,invalid?}]}` |
| `creators.propose` | `creators.propose` | `{records}`; `{planId,items:[{index,status,reason?}],expiresAt}` |

Read `media.selection` before proposing tags. Filter mixed selections by `type`; do not count audio as failed images. Each proposal accepts at most 10,000 unique selected asset IDs, at most 100 tags per image and 80 characters per tag, without control characters. Tags merge with existing tags. Return `{planId,count}` from an API 1 command to display the host review. Plans last 10 minutes; source/tag conflicts reject submission. Undo is host-controlled and conflict-checked. There is no background SDK method to approve a plan.

`network.request` supports HTTP(S) without URL credentials, preferably HTTPS; methods GET/POST/PUT/PATCH/DELETE/HEAD, default GET. Request and response bodies are text, at most 1 MiB each, with a 30-second timeout. ME cookies and login sessions are not included. Use a bounded native stream for large model downloads, not this text API.

## 6. Complete API 2 workspace example

The next seven files form a separate plugin, not additions to the API 1 archive. It opens a workspace, sends a read-only command and polls its task. No private host module, build tool or external dependency is needed. The packaged UI has both locales; escaped Chinese strings keep the documentation itself English-only.

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
# Example workspace
Import and enable the plugin, open its workspace and click Test. It returns a fixed test message without network, filesystem or media access. The interface follows ME's theme and language. No compilation or extra dependency is needed. Test the same read-only ping through an available trusted Agent integration. License: 0BSD. There is no private data to remove on uninstall.
```

For `LICENSE.txt`, copy the complete license from section 3 into this separate archive.

## 7. Workspace APIs and lifecycle

ME injects `window.MEPlugin` into the sandboxed frame. It exposes `ready()`, `invoke(command,input)`, `status(taskId)`, `cancel(taskId)`, `request(method,input)` and `subscribe(callback)`. `subscribe` returns an unsubscribe function. `ready()` resolves to `{pluginId,version,locale,theme}`. `invoke` returns `{taskId}`; status states are `queued`, `running`, `succeeded`, `failed`, `cancelled`. Successful tasks include `result`; failures include `{error:{code,retryable}}`. Progress is a snapshot, not an event stream. Poll only while needed and stop timers/subscriptions on disposal.

| Workspace request | Permission | Contract |
|---|---|---|
| `dialog.open` | `ui.dialogs` | `{extensions:['txt'],multiple:false}`; `{cancelled,files:[{token,name,size}]}` |
| `dialog.save` | `ui.dialogs` | `{token}`; `{cancelled}` |
| `media.selection` | `media.read` | `{}`; bound command selection, available with `selection-dialog` |
| `dialog.directory` | `ui.dialogs` | `{}`; `{cancelled:true}` or `{cancelled:false,token,name}`, available with `directory-token` |
| `storage.resource` | `storage.read` | Relative `{path}`; session-bound `{url}` for a supported image |
| `clipboard.write` | `ui.clipboard` | `{text}` at most 100,000 characters; `{written:true}` |
| `external.open` | `ui.external` | `{url}`; `{opened:true}` or `{cancelled:true}` |
| `creators.confirm` | `creators.propose` | `{planId}`; `{imported,existing,failed:[{index,code}],cancelled}` |
| `diagnostics.report` | Live workspace | Numeric-only report described in section 16 |
| `diagnostics.log` | Live visible workspace | Optional handled-error report; detect `debug-logs`, see the debugging guide |

Use `MEPlugin.request('storage.resource',{path})`, not `MEPlugin.storage.resource`. Likewise `sdk.request` and `MEPlugin.request` have different method sets. The host's `pluginJobConfigure`, `pluginJobControl`, installer and trust controls are ME UI internals, not plugin APIs.

Newer hosts also return optional `features` and `selectionBound` from `ready()`. Detect features before using the additional interfaces; a missing field does not indicate support. See the selection guide for response shapes and invalidation rules.

Pack scripts and styles; load them by relative path. Do not use inline scripts, eval, external scripts, direct browser network requests, Node integration or Electron IPC. Render external text via `textContent`, never `innerHTML`. Network work belongs in background commands. Do not copy host bridge code into the package or persist workspace/file tokens. Disable, uninstall, privacy lock and replacement revoke resources. Requests from hidden or closed workspaces may fail; never queue and replay hidden writes when returning. Reload current state in a new live session.

API 1 command forms bind the media selection when opened; reopen for a changed selection. API 2 workspaces are not an implicit media-selection API; selection-dialog commands can explicitly bind a snapshot from media menus. The default API 2 workspace appears as a sidebar page. Optional `workspace.placement:'creator-toolbar'`, `platform` and `presentation:'dialog'` instead register a platform toolbar dialog. Accepted platform IDs: `DOUYIN`, `TIKTOK`, `XIAOHONGSHU`, `TWITTER`, `INSTAGRAM`, `BILIBILI`, `PIXIV`, `FANTIA`, `OTHER`. A sidebar workspace requires page presentation without a platform. Arbitrary DOM selectors are unsupported. Close/Escape uses host task decisions.



See [selection dialogs and transcoding tools](selection-workspace.en-US.md) for `when.selection`, command `ui.open`, workspace `media.selection`, `dialog.directory` / `files.resolve(write-dir)` and managed `runtime.tool(ffmpeg)`. It includes feature detection, a complete runnable setup-check plugin, permission requirements and close behavior. These additions must not be assumed available in every older ME release.

## 8. Theme, language and usability

Omitted colors inherit ME and update when its theme changes. Explicit developer colors take precedence. Optional manifest `theme` accepts `ink`, `muted`, `line`, `panel`, `canvas`, `blue`, `blue-dark`, `good`, `warning`, `danger`, `plugin-on-accent`, each a hex color of 3/4/6/8 digits. No arbitrary CSS or scripts are accepted in that field. Workspace CSS uses the matching `--` variables. Overrides remain scoped to that plugin, not ME's risk dialogs.

Provide complete Chinese and English UI labels, errors, loading states and confirmations. Listen for `context` events; switching language must not lose typed text, selection, task state or a pending decision. Keep IDs, protocols and user content unchanged. Model tag language is separate from UI language. Ship any offline dictionary with complete source and in `files`; translate before proposing tags, preserve untranslated terms with a clear explanation, and never reorder a model's label table. Reviewed and saved tags must match.

Use consistent button height, readable alignment, visible keyboard focus and narrow-window layouts. Differentiate primary, secondary and destructive actions using the host theme. Show a shell before awaiting settings, heavy module imports, models or large lists; page or virtualize large lists. A settings-load failure must be visible and retryable, never treated as empty defaults that can overwrite saved settings.

### Contextual help and explanatory text

Put ordinary supplementary explanations behind a circled exclamation help button next to the relevant control instead of permanent paragraphs. Required warnings, permissions, consequences such as deletion or overwriting, errors and live task status must remain directly visible. Help must never replace host confirmation.

Support keyboard focus, click and touch, readable names and description relationships. While help is open, Escape closes only that help. Update language and theme without losing inputs or task state; check narrow windows, viewport edges and long text. Reinitializing dynamic nodes must not duplicate bindings; disposal must clean up listeners, subscriptions, observers and timers.

The host help component is not exposed as a sandbox plugin API. API 1 uses documented description fields; API 2 implements help inside its own iframe without accessing host DOM. See the [runnable plugin contextual help example](contextual-help.en-US.md) for working code, integration steps and a verification checklist.

## 9. Storage, dependencies and manual resources

Always obtain storage through `storage.directory`. ME's managed plugin locations are below the application's `AppData`, including the installed code and private data. Do not hardcode a drive, user home, version path or another disk. Keep models, virtual environments, settings, caches and downloads in assigned data storage; place temporary files there too and set TEMP/TMP/TMPDIR for child installers. Native code must follow these conventions itself.

Use `runtime.tool({name:'uv'})` through the background SDK to reuse compatible ME-managed Python. Set UV_PYTHON_INSTALL_DIR and UV_CACHE_DIR to the supplied directories. Create a plugin-specific virtual environment under private storage; it references or links the managed interpreter as supported by the tool rather than distributing another complete Python. Never alter shared interpreter packages or fall back to system Python. If a compatible interpreter is missing, explicitly prepare it and show that distinct stage. Under Python `-I`, PYTHONUTF8 is ignored: use `-X utf8` for a UTF-8 JSON-lines protocol and test Unicode paths.

Optional `environment:{checkCommand,installCommand}` references two different existing `center` commands. The check command cannot have form inputs. ME checks enabled idle plugins and displays ready only after `{ready:true}`. Checks inspect existing resources and may briefly start and stop an inference process; they must not download, install or change media. Installation is an explicit user action. Model files alone do not prove inference dependencies are ready.

Optional `resources` contains at most 10 entries `{name,size,sha256,urls}`: filename only, positive safe integer size, lowercase 64-digit SHA-256, and 1 to 4 HTTPS URLs without credentials. Put the official source first, then mirrors. ME displays links, checksums and the actual storage folder. Tell users to stop installation, place complete files under the exact names, and run installation verification. A partial file is not a complete resource.

Native downloads must pin revisions, sizes and checksums, bound connection/stall timeouts, use temporary files and atomically promote only verified files. Mirrors must match the same hash. Reuse valid local model and label files; do not download again solely because dependencies are missing. Document network destinations, resource licenses, download sizes and disk needs. Resource verification is distinct from the host's no-per-execution-package-scan policy.

## 10. Progress and errors

Report `tasks.progress` about every 500 ms during long operations and await the last report. Required `done` and `total` are safe integers, `0 <= done <= total <= 10000`. Optional `phase`: preparing/runtime/dependencies/downloading/verifying/processing/ready. Optional `receivedBytes` and `totalBytes` are safe nonnegative integers with receivedBytes <= totalBytes; if total bytes are unknown, omit both or use both zero and show indeterminate progress. `file` is a filename without a path, at most 100 characters.

Optional dependency fields: `activity` is environment/resolving/resolved/packageDownloading/packageDownloaded/prepared/installed; `packageName` is an alphanumeric-leading package name using letters, numbers, `_`, `.`, `-`, at most 80 characters; `elapsedSeconds` and `quietSeconds` are integers 0 to 86400. Stream known phases from the installer while it is running. Silence means no new feedback, not proof of a hang. Never fabricate percent completion or forward raw process logs containing paths or credentials.

Optional `data` is a JSON object limited to 64 KiB, depth 8 and 2,000 nodes. ME validates and copies it. Progress keeps only the newest snapshot; fast updates may coalesce. Finish with a complete result or requery, not an assumption that every progress event was delivered.

| Error | Required handling |
|---|---|
| `PLUGIN_PERMISSION_DENIED` | Check declared package/command permission, context and current authorization |
| `PLUGIN_SOURCE_CHANGED`, `PLUGIN_APPROVAL_EXPIRED` | Read fresh selection/state and prepare a new plan; do not force the old write |
| `PLUGIN_PACKAGE_MISSING`, `PLUGIN_PACKAGE_CHANGED` | Explain repair/reinstallation or reopen after upgrade; do not reset private data |
| `PLUGIN_BUSY` | Wait for existing work; do not launch duplicate writes |
| `PLUGIN_CANCELLED`, `PLUGIN_TIMEOUT` | Stop subsequent work, clean temporary resources and preserve committed data |
| `PLUGIN_REQUEST_PENDING` | Await all outstanding SDK calls before returning |
| Other codes | Show a localized actionable failure; do not expose raw stacks, paths or secrets |

Requests may be normalized to `PLUGIN_REQUEST_FAILED`. Use try/catch/finally. A process message is at most 2 MiB; large files use tokens. Each plugin runs one background command at a time, with at most four plugins running concurrently. API 1's default command timeout is 30 minutes. Do not automatically retry an unknown write outcome.

## 11. Host-managed image automation and review

Declare `automation:{command:'tag-images'}` referencing an existing command and request `media.read` and `tags.propose`. The command must handle one selected image and return a tag proposal. ME supplies selection/all-library queues, new-image watching, counters, pause/resume/stop, reviews and automatic application. Do not implement another independent host task queue or call private `pluginJob*` methods.

- New-image watching is opt-in and resumes with ME. It establishes a baseline when enabled; it does not scan all old images on startup. Disabled plugins never auto-run.
- Manual selection starts with a host choice between per-image review and automatic application. Changing a default afterward does not retroactively approve pending results; explicit host confirmation can apply existing selected results.
- `skipRecognized` defaults true for selected, whole-library and watched work. Successful zero-tag, pending-review and applied results count as recognized; failures remain retryable. Turning it off runs inference again and replaces old pending results only on success. It does not remove applied tags.
- Each manual task has separate counters. Historical pending reviews and recognition history persist separately. Mixed selections enqueue images only. Do not create overlapping manual tasks.
- Pause finishes the current image before waiting; resume continues. Stop terminates current work and retains `watchNew`, so later imports can start a new task. Turning watching off is a separate action.
- Clear resets the current queue, task identity, counts and error only; it is unavailable while running or in flight. It preserves reviews, recognition history, settings, models and written tags.
- Review displays image, original tags and individually removable candidate chips. Removing candidates never deletes original tags. Empty-candidate approval can mark the image reviewed. Host approval validates a subset of the proposal, current source/tags and registered installation identity, without rescanning the package.
- Approve-all freezes a batch, preserves candidate removals and commits as one library transaction; a conflict stops the batch. Newly produced results remain for the next review. At 1,000 pending reviews, processing pauses until reviewed.
- Automatic application is a host setting, initially off and enabled through user confirmation. Plugins still return proposals and cannot grant themselves approval. Closing this option leaves uncommitted results pending. Validate conflicts instead of overwriting manual edits.
- Closing shows appropriate choices for background continuation, paused work, stop and keeping/clearing reviews. Cancelling leaves state unchanged. Clearing reviews never deletes media or applied tags.

## 12. File dialogs and creator import

Import: UI calls `dialog.open`, passes a token to a background command, then background calls `files.resolve` with read mode. Export: background writes a complete relative file under private storage, calls `files.export`, then UI calls `dialog.save`. Tokens belong to the same plugin/user/workspace, expire after 30 minutes and are revoked on close. File limit is 128 MiB; a selection has at most 20 files and 1 to 10 extension filters. Do not send large Base64 blobs or absolute paths through UI. Storage images support verified PNG/JPEG/GIF/WebP/BMP up to 16 MiB, not SVG.

`external.open` accepts checked HTTP(S) or a restricted magnet link, not arbitrary programs/protocols. A magnet has one xt=urn:btih value of 40 hex or 32 Base32 characters, optional dn and repeated tr using HTTP/HTTPS/UDP; no xs, credentials or control characters, at most 8192 characters. A rejected/cancelled request never launches an external program. Effective trust affects confirmation, not protocol validation.

The current creator-import adapter supports X only; other toolbar platform IDs do not imply creator-import support. Creator records are `{platform:'x',creatorId?,handle?,url,name?,avatarUrl?}`. IDs are numeric strings, URL and handle must agree, optional avatarUrl is HTTPS metadata and does not itself trigger a download. Use lookup then propose in batches of at most 500. The host validates/deduplicates and returns a frozen plan. UI requests `creators.confirm`; untrusted operations display a batch confirmation. Existing records, tags and update cursors are preserved; repeat confirmation is idempotent. For more than 500, show total/current/remaining and process visible batches without dropping the tail. Agent code may propose, not self-approve. Import does not implicitly parse media, download or cloud-sync.

## 13. Activation and Agent-callable commands

API 2 optionally declares `activation:{type:'password',algorithm:'scrypt',salt,digest}`. Salt is 32 lowercase hex digits and digest 64. Derive 32 bytes with `scrypt(password, Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1})`; do not store plaintext. ME owns activation. Five failures trigger a one-minute wait. Disable/re-enable, restart and an eligible same-signing-identity upgrade retain activation; uninstall revokes it even when data is retained. A new signer cannot inherit activation. Agents cannot activate a plugin.

To expose business commands to an Agent, declare `agent` context and truthful schemas/effects/permissions. The trusted ME adapter, not plugin code or the model, constructs the caller and invokes the dispatcher. Dispatcher operations are `discover`, `invoke`, `status`, `cancel`; these are host integration interfaces, not additional iframe methods. Submission and dequeue recheck privacy, activation, enabled state and trust. Queues are serial per plugin, at most 32 waiting commands. Handle `PLUGIN_BUSY` visibly.

Agent write/delete requires effective trust; an input `confirmed:true` or `trusted:true` has no authority. Results cannot return cookies, passwords or login tokens. Return structured partial successes/failures. Date queries must state range and timezone; never claim a local list is a completed remote check. Host task history is bounded to 1,000; completed unkeyed tasks may be evicted, while keyed results are retained at least 30 minutes within the service lifetime. Idempotency does not survive all crashes: reconcile uncertain writes rather than blindly retry.

## 14. Upgrade, removal and persistence

Keep ID stable and increment the three-part version. Same-version replacement is rejected. Updates preserve enabled state, private data and valid saved inputs; API 1 controls are keyed by plugin ID/command ID/input key. Change a key when its meaning changes. Signing-identity and permission-expansion rules govern activation/trust separately from ordinary settings.

Every plugin-owned JSON format needs a schema version. Back up before migration, write a complete temporary file then atomically replace, and test upgrading old data. Do not truncate persistent files in place or treat corrupt data as a new empty library. Never write models/settings inside the versioned code directory.

ME handles installation/removal progress and recovery. Uninstall defaults to keeping private data and asks the user. It closes workspaces, disables execution, cancels tasks, detaches automation, removes registration, then cleans code and optionally private data. Cleanup failure after deregistration means uninstalled with cleanup pending; the host can retry without widening the original data choice or deleting a newer installation. Media originals, written tags and shared Python/cache are not plugin cleanup targets. Legacy compatibility-bound storage is excluded from private-data removal.

`storage:{binding:'actor-tracker'}` is reserved for an explicitly allowlisted signed legacy plugin. It is not a general API for choosing directories and must not be copied into third-party manifests. Catalog delisting does not uninstall or disable an existing local copy. Offline catalog caches may be stale; show that accurately.

## 15. Packaging, submission and publication

The archive filename prefix should match `plugin.json.id`; use `<id>-<version>.zip` as the recommended naming convention. When filling out the submission form, open the packaged `plugin.json` and read `id` and `version` separately. Do not use the display name or derive the ID by arbitrarily truncating the filename. The filename is a convenience; the manifest is the identity authority.

For example, when the manifest has `id: "example.tagger"` and `version: "1.1.4"`:

| Item | Correct value |
|---|---|
| Install archive filename | `example.tagger-1.1.4.zip` |
| Submission plugin ID | `example.tagger` |
| Submission version | `1.1.4` |
| Optional source archive filename | `example.tagger-1.1.4-source.zip` |

The submission ID includes neither the version, `.zip`, nor `-source`. An additional `source` suffix on the source archive does not change its ID: it remains `example.tagger`. New source submissions require ZIP. Local plugin installation still supports ZIP/7z; these are separate entry points.

When you select a submission ZIP, ME reads its `plugin.json` and fills the plugin ID and version automatically. A mismatch detected before submission blocks the upload. Autofill uses the manifest, not the filename. After upload, the server checks the ID and version again. Mismatched submissions are rejected with the expected values and do not enter human review. If your client does not provide autofill, enter the manifest values manually; the same server validation applies.

An installation package is a ZIP or 7z archive, not an EXE. Put manifest, entry, README, license and all runnable files directly at its root. No wrapper directory, encryption, links, traversal paths or case collisions. Installation limits are 64 MiB compressed, 512 MiB unpacked and 10,000 entries. These are separate from source submission limits; do not describe them as a fixed source-upload cap. Download large models separately with the resource rules above.

Plain JavaScript requires no compilation. If using TypeScript or a bundler, include complete original source, pinned dependencies/lockfile, build instructions and runnable output. Include all production dependencies and their licenses; never rely on ME's node_modules or globally install packages. The current publication packager selects the declared `files`, validates approved source and creates the install ZIP. It does not execute arbitrary uploaded build scripts or run npm install. Test your output on a clean machine/environment before submitting.

Submitted source is used for review. Published installation ZIPs and the signed catalog are distributed through the official plugin center. The submission ID/version must match the manifest; include complete source, README with permission purposes, dependency/network/model information, troubleshooting and data-retention behavior. Users can submit from ME after login. Review approval, queued build, running build and published are distinct states; only a verified client download/install completes publication. Users can download and install newly published plugins that use existing supported APIs without a plugin-specific ME update. Verify downloading and installing the published package.

Official certification is a separate explicit administrator action bound to reviewer, time, source digest, ID and version. Ordinary review yields community identity. A rebuild must use the exact approved source; replacing it requires review again. Keep source ZIP and distribution ZIP digests distinct and associated. Never infer official status from author names or a signature alone.

Publishers, not third-party plugin code, produce `signature.json`. Schema 2 signs UTF-8 `JSON.stringify({schemaVersion:2,purpose:'me-plugin-package',publisher:{origin,id},files})` using Ed25519; origin is official/community, ID is a UUID identifying the official certifying administrator or community submitter. `files` is a SHA-256 map sorted by JavaScript lexical key order excluding signature.json. Do not use locale-aware sorting or include the final ZIP hash inside its own signature. The signed catalog binds the same publisher, version and final ZIP digest; the host checks these against current distribution authorization at install. Legacy schema 1 is not automatic official trust. Do not invent a publisher UUID, distribute signing keys or treat local signing as official certification.

## 16. Diagnostics and startup performance

Optional `MEPlugin.request('diagnostics.report',{stage,elapsedMs,count?,bytes?})` accepts only ui.mount/ui.interactive/ui.list_rendered/ui.initialized/ui.longtask. elapsedMs is finite 0 to 3,600,000; count is an integer 0 to 10,000,000 and bytes 0 to 1 GiB. Extra fields are rejected; at most 16 reports per live session. Handle unsupported hosts without blocking the feature. Never send filenames, paths, identities, URLs, content, credentials or arbitrary log strings. A list-rendered report means plugin-declared DOM completion, not proof of pixels painted.

ME records bounded numeric host/UI stages. Host samples are process-wide aggregates for up to two minutes after the latest workspace opening; nested and concurrent stages overlap and must not be summed as total latency. Distinguish click-to-shell, bridge-ready, settings-ready, first data and full initialization. Test realistic data and idle background plugins, not just an empty fixture. Navigation latency alone does not prove a plugin starts quickly.

## 17. Unsupported capabilities and common mistakes

- API 1 has host-generated dialogs, not arbitrary HTML. API 2 explicitly supports its sandboxed workspace; neither allows host DOM injection.
- There is no generic SDK for arbitrary media deletion/renaming, raw database access, account credentials, modifying trust, approving tag reviews or activating a package.
- `storage.directory` returns a path, not a settings object. `runtime.tool` returns managed paths, not an already installed plugin environment.
- A successful download is not a completed installation; a ready environment is not a completed inference task; completed inference is not approval of pending tags.
- Do not persist ephemeral workspace tokens, share private files with other plugins or call private application imports. Add capabilities through a future reviewed SDK change, not ad hoc host patches bundled with a plugin.
- Removing a catalog entry, uninstalling, deleting private data, stopping a task and clearing reviews are different actions. Do not conflate their effects.

## 18. Required validation and delivery

### Debugging without ME source code

ME provides opt-in plugin debug capture on hosts advertising `debug-logs`. Open Plugin settings, enable Developer debug logs, reproduce, and export a redacted JSON report. It includes backend and workspace errors, relative stack locations, task identifiers and bounded stdout/stderr. Review the file before sharing with an agent. Debug defaults off and does not upload data.

See [plugin debugging and redacted logs](debugging.en-US.md) for exact limits, lifecycle, optional handled-error reporting, redaction boundaries and source-map limitations. Older hosts without this capability still expose task state/error codes and numeric performance reports; they do not provide this complete capture workflow. Do not claim every exception can be captured.
Run the applicable cases and record actual results, host/API and plugin versions. Mark a case not applicable with a reason; do not silently omit it.

| Area | Required evidence |
|---|---|
| Clean installation | Root layout, manifest, included dependencies and license accepted; initial disabled state; enable/activation and failure recovery |
| API behavior | Valid and invalid input/output; missing permission/context; mixed or empty selections; unsupported capability handled visibly |
| UI | Chinese and English, live switching without lost input, inherited/custom theme, narrow layout, keyboard focus, immediate shell and delayed/failed settings |
| Tasks | Real progress, unknown total, network timeout, pause/resume/stop/clear, repeated clicks, close/background choice and no hidden write replay |
| Reviews | Candidate deletion, approve/cancel/approve-all, auto-apply opt-in, existing pending results, source conflict, independent counters and recognized-image skipping |
| Resources | Existing model/label reuse, missing/corrupt file, manual placement, mirror checksum, dependency progress, cancellation, Unicode paths and offline readiness |
| Upgrade | Preserved enabled state/settings/data/environment; old-schema migration and backup; changed signer/expanded permissions do not inherit inappropriate grants |
| Trust | Local official-signed package is not fixed-trusted; user trust and catalog official trust follow the same declared-operation policy; no self-asserted elevation |
| Removal | Keep/remove data choices, running-task teardown, cleanup retry, preserved media/tags/shared runtime, reinstall activation behavior |
| Publication | Complete source reproducible to runnable output; reviewed source digest matches publication input; actual catalog download, verification and installation |
| Performance | Realistic library size, multiple idle plugins, no repeated full package verification, early usable UI and bounded list rendering |

Final handoff includes the complete source archive, install archive, both hashes, exact version, build commands or an explicit no-build statement, dependencies/licenses, known limitations and this completed checklist. Compatibility claims must list the ME versions actually tested. Publication status must match the plugin center and be verified by downloading and installing the published package.
