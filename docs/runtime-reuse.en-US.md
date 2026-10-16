# Reusing ME-managed runtimes and controlled tasks

Prefer host-managed environments instead of bundling duplicate tools. Being distributed with ME, being installed and ready, and being exposed to plugins are separate conditions. Query actual status rather than guessing paths or versions.

## Capability and status queries

Check `features` from workspace `MEPlugin.ready()`: `runtime-catalog` enables backend queries; `runtime-execute` means a shared coordinator has been injected. On older hosts, missing features require a compatibility message, not an automatic replacement installation. All APIs below use backend `sdk.request` and require `runtime.tools`, including the API 2 command's own permissions.

```js
const { runtimes } = await sdk.request('runtime.catalog', {});
const tool = await sdk.request('runtime.inspect', { id: 'ffmpeg', minVersion: '7.0' });
if (tool.state !== 'ready' || tool.compatible !== true) {
  throw Object.assign(new Error(tool.reason || 'Runtime unavailable'), {
    code: 'PLUGIN_TOOL_UNAVAILABLE'
  });
}
```

catalog returns `{schemaVersion:1,runtimes:[...]}`; inspect returns one descriptor. Fields are `id`, `kind`, `access`, `state`, `busy`, `version`, `capabilities` and `reason`. No absolute paths, credentials or account state are returned. Optional `minVersion` adds `requiredVersion` and `compatible`; minimum versions support up to four numeric components, not semver range expressions. Unknown versions are null. Unprovable compatibility returns `incompatible / VERSION_UNVERIFIED` rather than assuming success.

States are ready, missing, broken, incompatible, busy and unavailable. unavailable / HOST_PROVIDER_UNAVAILABLE means the host has not provided an adapter, not that the component is necessarily absent. A separate busy flag can coexist with broken/missing. Queries never download, repair or update components. Tool probes have timeouts and a cache invalidated by file stamps; they do not repeatedly hash entire environments.

| Stable ID | Kind | Reuse and current boundary |
|---|---|---|
| uv | Tool | Existing runtime.tool path; use private plugin environments, never mutate ME environments |
| 7z | Tool | Existing path API; controlled archive operations are not exposed here |
| aria2 | Tool | Status query; prefer host download services, no generic execution operation yet |
| python | Interpreter | Status depends on a host adapter; install extra dependencies in a private venv, never pip into a host .venv |
| ffmpeg | Tool | Controlled version and basic transcode; codec availability depends on the actual build |
| ffprobe | Tool | Controlled version and probe; do not assume the same build as FFmpeg |
| gallery-dl, yt-dlp, f2, baidu-netdisk | Environments | Adapter-dependent status; accounts, proxies and sessions use controlled service APIs, never Cookie or internal database access |
| voice-asr, voice-tts, voice-wake | Services | Adapter-dependent status; query availability does not expose arbitrary model calls |
| node | Interpreter | Backend plugins already run in the host runtime; no additional Node distribution or access to host process internals |

`access` is managed-task, private-env, service-only, path-compat or host-runner. It describes the integration route, not an unrestricted execution grant. Do not fill unsupported capabilities by guessing private paths or importing application modules.

## Controlled execution

`runtime.execute` accepts a structured object, not a shell, arbitrary executable, free-form arguments, caller-selected priority or environment variables. It waits within the current plugin task and uses the coordinator injected by ME. Plugins must not instantiate a separate global coordinator.

```js
const version = await sdk.request('runtime.execute', {
  id: 'ffmpeg', operation: 'version', timeoutMs: 10000
});
// version: {taskId, exitCode:0, versionText}

const info = await sdk.request('runtime.execute', {
  id: 'ffprobe', operation: 'probe', assetId: selectedAssetId
});
// info: {taskId, exitCode:0, media:{format,streams}}

const output = await sdk.request('runtime.execute', {
  id: 'ffmpeg', operation: 'transcode', assetId: selectedAssetId,
  directoryToken, name: 'converted.mp3', format: 'mp3'
});
// output: {taskId, exitCode:0, name, size}
```

assetId must belong to the host-bound selection. probe/transcode also require `media.read`. transcode requires an API 2 command with a write effect and `ui.dialogs` in both manifest and command permissions. directoryToken comes from live workspace `dialog.directory`, following system selection and explicit write authorization. Absolute output paths are not accepted.

Basic formats are currently mp4 (H.264/AAC), mp3, wav, png (first frame) and webp (first frame). name must be a safe single filename with the matching extension. Unsupported input, codec or container fails visibly. Custom filters, arbitrary encoding flags, overwrites and automatic media-library import are not supported by this interface. Existing runtime.tool compatibility paths remain available.

Each task uses a separate temporary subdirectory within the authorized output directory. An exclusive hard link publishes the completed file, followed by temporary cleanup. Existing targets are never overwritten; the target has a host-generated conflict key. Filesystems without hard-link support return PLUGIN_OUTPUT_COMMIT_FAILED instead of falling back to unsafe replacement. Selection, file stamps, plugin state and directory grants are rechecked after queuing and before publication. Source changes prevent publication. Expired grants or closed workspaces also fail; keep the workspace open or cancel the task.

timeoutMs defaults to 120000, accepts 1000 through 1800000, and starts at process launch. Combined stdout/stderr is limited to 256 KiB; overflow terminates the process with PLUGIN_RUNTIME_OUTPUT_LIMIT. probe returns basic format/stream properties without filenames or arbitrary metadata tags. Use ME debug logs for failure details.

## Scheduling, progress and cancellation

Keep using the outer taskId from `MEPlugin.invoke` with status/cancel. The taskId returned by execute is a child-operation correlation identifier, not an outer task identifier. During execution, status.progress.runtime contains `{taskId,state,id,coordinatorId}` with queued/running/finished/cancelled states. done/total are unknown; do not display a fabricated percentage. The outer task outcome is authoritative.

Plugin operations use fixed background priority; the host controls playback and interaction priority. Acquisition order is compute/conflict admission, then disk, execution, process close and temporary cleanup, then release. Cancelling the outer task propagates to its owned process tree. Conflicting work cannot start before cleanup settles. The initial runtime-revision key is exclusive and can serialize operations. It is not a shared-read/exclusive-write upgrade lock and does not replace runtime-manager upgrade protection.

This API does not guarantee that every ME workflow has joined the coordinator. It cannot preempt arbitrary running processes, does not provide weighted GPU budgets, and cannot promise an entirely stall-free operating system. Trusted-native plugins spawning through existing runtime.tool paths bypass this scheduling contract. Private Python dependency management, other controlled tools and service calls need explicit future capabilities; this page does not imply they are already implemented.

Validation must cover missing/broken/unknown versions, offline use, Unicode and spaced paths, old APIs, actual managed-tool execution, no overwrite, source changes, queued/running cancellation and zero leases after cleanup. Development-tree success does not replace installed-package validation. Playback and UI performance require separate measured workloads.
