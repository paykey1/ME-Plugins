# Compatibility and update requirements

## Choosing a target version

ME 0.26.0 is released. Record the exact ME version, plugin API number and plugin version used for development and testing, and check that ME version's release notes. A documentation update alone does not establish support in older versions.

| Plugin API | Intended use |
|---|---|
| API 1 | Host-generated command forms and optional image jobs |
| API 2 | Custom sandboxed workspaces, activation and Agent contexts |

API 2 does not replace API 1. A host without API 2 support rejects such manifests. Plugin API numbers and ME application versions are independent. Do not use an API number as an application version or add an unspecified minimum-host-version manifest field.

## Compatibility requirements

- List the ME versions actually tested in the plugin documentation. Confirm target-version support before using a new capability.
- Explain missing required capabilities clearly. An unavailable optional capability must not block unrelated functionality.
- Inherit the ME theme unless colors are explicitly specified, and scope overrides to the plugin. Language changes must preserve input, selections and running tasks.
- Use host storage and runtime APIs. Do not depend on private installation files, internal modules or development-machine paths.
- Verify both local import and plugin-center installation. Publisher identity and installation channel are separate concepts.

## Updating a plugin

Keep the plugin ID unchanged and increment its three-part version. Updates should retain enabled state, settings, models and recognition environments. Validate plugin data migrations, back up before migration, and handle failures and existing pending tasks.

Explicit user trust is inherited only for the same identity without expanded permissions, effects or contexts, or added commands. Test authorization when signatures or permissions change; do not assume existing authorization covers new capabilities.

Users choose whether to retain private plugin data on uninstall. Never remove user media, applied tags or shared runtimes. Allow retrying failed cleanup.

## Submission and publication

The submission ID and version must match the manifest inside the source ZIP. Review approval, queued build, running build and published are distinct states. Download and install the published package from the official plugin center before announcing that it is available.

See the [developer guide](plugin-development-guide.en-US.md) for the complete API contract, examples and validation checklist.

New selection-dialog, directory-grant and FFmpeg interfaces require host `ready().features` checks; do not infer availability from “0.26+”. See [feature detection and example](selection-workspace.en-US.md).

Unified plugin diagnostics require `debug-logs` in `ready().features`. Older hosts may only expose error codes. Detection must not block the plugin's main operation. See [debug capture, export and limitations](debugging.en-US.md); original task failure codes and `diagnostics.report` remain compatible.

See [managed runtimes and controlled tasks](runtime-reuse.en-US.md) for runtime-catalog/runtime-execute feature detection. A discovered component is not an unrestricted execution or account-access grant; direct runtime.tool spawning remains outside coordinated admission.
