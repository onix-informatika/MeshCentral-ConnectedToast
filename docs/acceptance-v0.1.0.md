# ConnectedToast v0.1.0 acceptance

This document maps the design specification's acceptance criteria to reproducible evidence. Automated checks prove repository behavior and compatibility contracts. The live section must be completed against the deployed MeshCentral instance and real endpoints before production acceptance.

## Automated and source-backed evidence

| # | Acceptance criterion | Evidence |
|---:|---|---|
| 1 | Installs without core modifications | The repository contains only plugin files. `connectedtoast.js` uses the normal plugin factory, lifecycle, event dispatch, server action, and frontend export contracts. `config.json` supplies catalog metadata. |
| 2 | Device page exposes Connected Toast GUI | `onDeviceRefreshEnd` registers `connectedtoast-panel` through `registerPluginTab`. Browser tests verify registration, complete static ID parsing, request flow, stale-response protection, and independently serializable frontend exports. |
| 3 | Seven native consent bits are editable | Consent unit tests verify the exact `1, 2, 4, 8, 16, 32, 64` bit values. Browser tests verify seven real checkbox inputs and the native `changedevice` request with value `73`. |
| 4 | Effective inherited consent is displayed | Consent tests verify domain, group, node, and operator OR behavior and sources. Browser tests verify Device, Inherited, Effective columns, operator consent, unsaved native edits, and Desktop status summary. |
| 5 | Custom toast can be enabled per device | Configuration defaults and strict save tests cover per-device enablement. Browser tests verify form collection and server persistence. |
| 6 | Default rule works | Rule and relay-handler tests verify exact default selection, protocol gates, rendering, and one routed toast. |
| 7 | Operator override works | Rule, configuration, browser, server, and relay-handler tests cover immutable operator IDs, draft switching, precedence, Unicode, and override rendering. |
| 8 | Operator disable works | Rule and relay-handler tests verify that an exact disabled override wins over an enabled default. |
| 9 | Desktop start produces one toast | Session and relay-handler tests use relay message `15`, protocol `2`, and a duplicate start to prove exactly one send attempt. |
| 10 | Terminal and Files follow checkboxes | Protocol tests cover Terminal `1, 6, 8, 9` and Files `5`; rule and relay tests cover global and resolved-rule gating. |
| 11 | Test Toast works | Browser and server tests verify online/edit checks, one raw-template request, one authoritative render, local/peer routing, and meaningful results. Live endpoint display remains a manual check. |
| 12 | Unicode and emoji work | Template, configuration, and relay tests preserve Unicode, emoji, and HTML-looking text as inert plain strings. |
| 13 | Unauthorized writes are rejected | Server tests cover unauthenticated, invisible, cross-domain, missing-node, no-Manage-Computers, fake-operator, arbitrary-user, and unknown-action cases. |
| 14 | Offline handling is clean | Browser, server, routing, and relay tests verify editable config, blocked or offline Test Toast, and contained routing failures. |
| 15 | Plugin failures do not affect sessions | Plugin lifecycle and relay tests inject startup, DB, node, template, router, deletion, and server-action failures and verify contained fail-open behavior. |
| 16 | Configuration survives restart | DB tests save with one store instance and read with a new instance over the same MeshCentral common DB. Deterministic upsert and shared-DB cleanup are also covered. |
| 17 | README documents limitations | README documents additive consent, native/custom independence, duplicate warnings, plugin-only limitations, protocols, security, storage, multi-server behavior, offline behavior, installation, manual validation, and non-goals. |
| 18 | No core patch is required | Routing, relay IDs, `changedevice`, plugin tab registration, browser responses, agent toast support, and shared DB calls were checked in the official MeshCentral 1.1.53 source and the local 1.1.59 source. No core source is copied or modified. |

Run the complete automated gate:

```sh
npm test
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

## Required live Windows validation

Record the MeshCentral version, plugin commit, device ID, Windows version, MeshAgent version, operators, time, and result for every step.

1. Install the plugin through the catalog or local plugin directory and restart MeshCentral.
2. Open one online Windows 10 or 11 device and confirm there is exactly one **Connected Toast** tab.
3. Toggle each native device checkbox, save, reload the page, and verify the persisted device, inherited, and effective values.
4. Set Domain `1`, Device Group `8`, Device `64`, and Igor user consent `2`; verify the selected-operator effective value is `75` with the correct source on each row.
5. Configure the default connect message as `IT support connected.`
6. Configure Igor's enabled Desktop override as `👀 Igor se spojio. Serije odmah ugasiti.`
7. Leave Alen on `Inherit` and configure a service account as `Disabled`.
8. Send Test Toast and verify the endpoint shows the exact title and rendered message once.
9. Start Desktop as Igor twice within the same relay session and verify exactly one Igor override toast.
10. End the session with disconnect disabled, then enabled, and verify the configured behavior.
11. Start Desktop as Alen and verify the default message. Start as the disabled service account and verify no custom toast.
12. Enable Terminal and Files one at a time and verify their supported relay sessions. Verify disabled protocols produce no custom toast.
13. Confirm the native Desktop privacy bar separately from custom toasts.
14. Enable both native Desktop Notify and ConnectedToast and confirm the documented duplicate-notification warning matches endpoint behavior, then restore the recommended configuration.
15. Take the device offline, confirm settings remain editable and Test Toast reports offline, then reconnect it.
16. Restart MeshCentral and verify all custom rules remain present.
17. Repeat a failed-send scenario and verify Desktop, Terminal, and Files sessions still function.
18. Verify coexistence with AdminAutoShare, RoutePlus, and existing native User Consent settings.

If macOS or Linux endpoints are in the active fleet, record their MeshAgent toast behavior separately. Do not add OS-specific v0.1.0 workarounds without a demonstrated need.
