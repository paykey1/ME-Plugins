# Plugin debugging and redacted logs

Developing, installing and debugging a plugin does not require ME source code. Supporting ME versions provide **Developer debug logs** in plugin settings. Workspaces can detect support using `(await MEPlugin.ready()).features?.includes('debug-logs')`. Updated documentation does not add this capability to an older installed ME release.

## User workflow

1. Open the plugin center, select the plugin's **Plugin settings**, and expand **Developer debug logs**.
2. Select **Enable debug**, then repeat the operation. Start background tasks again after enabling; earlier records cannot be recovered.
3. Use **Refresh** to inspect retained and dropped counts. Select **Export redacted logs** and choose a JSON destination.
4. Review the file before giving it, the plugin source, reproduction steps and expected result to a developer or AI. Do not provide account credentials.

Debug is off by default, with up to 4 plugins enabled simultaneously. Each plugin retains records in local memory for at most 30 minutes, up to 500 records and approximately 1 MiB. Older records are evicted when full; adjacent duplicates increase the dropped count. Expired sessions are cleared on subsequent access; restarting ME does not preserve them. Logs are never automatically uploaded to plugin authors, the catalog or an AI service.

**Clear logs** keeps debug enabled but fences off writes from existing background tasks; start a new task to reproduce. **Stop debug and clear** disables capture and deletes records. Closing a plugin window preserves collected records and background capture; a closed workspace cannot report. Disabling the plugin cancels execution and closes workspaces, but collected records remain exportable until the debug session expires. Uninstalling and quitting ME clear records. Privacy lock blocks capture, management and export.

## Collected information

- Background command start, completion and failure. API 2 uses the same task identifier as `status(taskId)`; legacy API commands receive a separate correlation identifier.
- Captured backend exceptions with up to 4 levels of `cause`, unhandled Promise rejections and uncaught exceptions.
- Background process stdout and stderr, including ordinary `console.log/warn/error`. Complete lines are collected; lines exceeding 8192 characters are discarded rather than exporting truncated credential fragments.
- Uncaught workspace JavaScript errors and unhandled Promise rejections. Plugins can also report handled UI errors explicitly.

Records include time, plugin identity and version, event, level, error code when available, redacted message and `frames`. Background records also include command and correlation identifier. Each frame has a plugin-relative `file`, `line`, `column` (possibly null) and function name. Exports have `schemaVersion:1`, host and runtime versions, dropped count, and records for the selected plugin only.

Command inputs, results, media contents, selections and account data are not automatically recorded. Stacks retain plugin-package locations only; host and other absolute paths are removed. Entire URLs are hidden, and common tokens, Cookie, Authorization, passwords, email addresses and long opaque values are filtered. Complex or multiline credential-bearing messages may be hidden entirely.

## Developer API

Backend commands need no new permission or API call for automatic capture. Throw ordinary `Error` objects. For handled errors that will not be rethrown, use `console.error(error)` without printing complete request objects, response bodies or user data. Debug does not change existing failure codes or authorization policy.

Handled workspace errors can use this optional interface:

```js
const context = await MEPlugin.ready();
if (context.features?.includes('debug-logs')) {
  try {
    await MEPlugin.request('diagnostics.log', {
      level: 'error',
      message: String(error.message || 'Operation failed').slice(0, 8192),
      stack: String(error.stack || '').slice(0, 16384)
    });
  } catch {
    // Diagnostic failures must not replace the original operation outcome.
  }
}
```

Here `error` is the exception caught by the plugin. `message` is required; `stack`, `code` and `level` are optional. Levels are `info`, `warn` and `error`. Maximum lengths are 8192 characters for message, 16384 for stack and 80 for code. Extra fields are rejected. The result is `{recorded:true}` or `{recorded:false}`; disabled capture or rate limits can return false. Each workspace permits 60 explicit reports per minute; automatic error capture has a separate limit of 30 sends per minute. No new permission is required, but the workspace must be live and visible. Plugins cannot enable debug, read other plugins' records or initiate export. ME's own UI owns those controls.

`diagnostics.report` remains the numeric-only performance interface and does not accept text logs.

## Limits and validation

This is not operating-system monitoring. It cannot guarantee capture of native crashes, plugin-owned log files, disconnected child-process output or swallowed errors. Direct system-process execution remains within the trusted-native boundary.

Locations refer to files in the installed package. Minified or bundled code may occupy one line. ME does not resolve source maps or attach source code to exports. Developers should supply matching source and maps, or reproduce using a development build that preserves line information.

Automatic redaction cannot identify every custom secret or private fact in natural language. Developers must still avoid sensitive logging, and users should review exports before sharing. Logs are diagnostic evidence, not proof that a feature passed its tests.

Before delivery, verify: debug off retains nothing; backend and workspace failures have relative locations; both UI languages work; exports exclude test credentials and user paths; cancelling export writes nothing; clearing prevents late task writeback; close, disable, uninstall and quit match the lifecycle above; frequent and oversized output cannot grow memory without bounds.
