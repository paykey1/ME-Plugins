# Compatibility and changes

Documentation revision: 2026-10-12.

## Availability

| Target | Status |
|---|---|
| Released ME versions | Check the release notes for your version; this guide does not claim that every released version supports these APIs |
| ME 1.0.0 development preview | API 1 and API 2 capabilities in this guide have been tested; this is not a stable release announcement |
| Revised server-side official certification | Client contract implemented; revised production workflow not yet deployed |

API 1 supports host-generated command forms and optional image automation. API 2 additionally supports sandboxed workspaces, activation and Agent contexts. API 2 does not replace API 1; a host lacking API 2 rejects such manifests. Do not change ME's application version to the plugin API version.

## Changes in this revision

- Separate Chinese and English guides replace mixed-language explanations. Each contains complete API 1 and API 2 examples and validation requirements.
- Full package verification is an installation/upgrade boundary. Routine opening, commands, resources and idle polling avoid full content scans while retaining live authorization and path checks.
- Publisher identity is independent of installation channel. A locally imported official-signed archive has no fixed official trust. Explicit user trust gives the same declared-operation policy; upgrades preserve it only for the same identity without expanded permissions/effects/contexts or added commands.
- Host-managed image jobs document independent task counts, recognized-result skipping, review chips, approve-all, automatic application and distinct stop/clear/watching behavior.
- Updates retain enabled state, settings, models and environments. Uninstallation offers private-data retention and recoverable cleanup.
- UI guidance requires early rendering, accurate progress, theme inheritance unless explicitly overridden, and live language changes without lost state.

## Updating a plugin

Keep its ID, increment its three-part version and preserve storage. Test migration from the prior data schema, signature/trust changes and existing pending tasks. Do not treat a new documentation revision as automatic compatibility with every ME build. Review the current guide before adding capabilities; do not silently ignore unsupported host features or invent a minimum-host manifest field.

Canonical tutorials: [English](plugin-development-guide.en-US.md) and [Chinese](plugin-development-guide.zh-CN.md). Published documentation is the reference; historical reports and copied older guides may contain superseded behavior.
