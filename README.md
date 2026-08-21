# MeshCentral ConnectedToast

ConnectedToast is a pure MeshCentral plugin for per-device remote-session transparency. It adds a **Connected Toast** tab to each device page, exposes the seven native MeshCentral consent bits, and can send a custom plain-text MeshAgent toast when an operator starts or ends a supported relay session.

Version 0.1.2 requires MeshCentral 1.1.53 or newer and does not patch MeshCentral core or MeshAgent.

## What the device tab configures

The first section edits the selected device's native `node.consent` bitmask through MeshCentral's normal `changedevice` browser action:

| Setting | Bit |
|---|---:|
| Notify user on Desktop connection | 1 |
| Notify user on Terminal connection | 2 |
| Notify user on Files connection | 4 |
| Require approval for Desktop connection | 8 |
| Require approval for Terminal connection | 16 |
| Require approval for Files connection | 32 |
| Show Desktop privacy bar while connected | 64 |

Native consent is additive. MeshCentral calculates the effective value from domain, device group, device, and connecting-user consent. Clearing a device checkbox cannot clear an inherited requirement. The tab therefore shows device, inherited, and effective state for every bit, and recalculates the display for the selected operator.

The inherited domain message, consent, timeout, auto-accept, notification, and privacy-bar fields are displayed read-only. They are not per-device values.

Use the sticky **Save settings** action at the top of the tab to persist both ConnectedToast rules and the selected device's native consent bits. Until that action reports success, edits exist only in the current browser tab.

The second section stores ConnectedToast rules independently from native consent. Defaults are:

| Field | Default |
|---|---|
| Enabled | Off |
| Notify on connection | On |
| Notify on disconnect | Off |
| Desktop sessions | On |
| Terminal sessions | Off |
| Files sessions | Off |
| Title | `MeshCentral` |
| Connect message | `{operator} connected to {device}.` |
| Disconnect message | `{operator} disconnected from {device}.` |

## Protocols and rules

ConnectedToast recognizes only these MeshCentral relay protocols in v0.1.0:

- Desktop: `2`
- Terminal: `1`, `6`, `8`, `9`
- Files: `5`

Both the global protocol checkbox and the resolved rule protocol checkbox must be enabled. Rule precedence is:

```text
exact operator override
default rule
no toast
```

An operator override can be `Inherit`, `Enabled`, or `Disabled`. Rules are keyed by immutable same-domain MeshCentral user ID. The server returns only operator ID, username, real name, consent, and calculated effective consent. Operators with remote rights sort first.

Supported placeholders are `{operator}`, `{realname}`, `{device}`, `{protocol}`, `{time}`, `{nodeid}`, and `{sessionid}`. Titles are limited to 128 characters and messages to 1024 characters. Unknown placeholders are rejected on save. Text, Unicode, emoji, and HTML-looking strings remain plain text and are never evaluated.

## Native and custom behavior

ConnectedToast is independent from MeshCentral's native Desktop Notify bit. If both are enabled, the endpoint can receive two notifications. A practical configuration for one customizable notice plus persistent visibility is:

```text
Native Desktop Privacy Bar: ON
Native Desktop Notify: OFF

ConnectedToast:
  Enabled: ON
  Desktop: ON
  Default professional message: configured
```

Plugin-only v0.1.0 cannot provide per-device or per-operator native privacy-bar text, consent-dialog text, consent timeout, auto-accept behavior, or operator-specific native prompts. It does not emulate consent with an after-the-fact toast. Native prompts remain MeshCentral's responsibility.

## Test Toast and offline devices

**Send test toast** sends the currently previewed Desktop title and message to an online endpoint through the existing MeshAgent `toast` command. It requires Manage Computers permission. A remote session is not required.

Configuration and native consent remain editable while the endpoint is offline. Test Toast is disabled and reports `Device is offline`. No later synchronization is needed because custom rules are server-side.

## Installation

### Local or manual

1. Copy this repository's files to `meshcentral-data/plugins/connectedtoast`.
2. Enable the plugin in MeshCentral configuration, keeping any other plugin names already present:

```json
{
  "plugins": {
    "enabled": true,
    "list": ["connectedtoast"]
  }
}
```

3. Restart MeshCentral after installation or an update.
4. Open a device and select the **Connected Toast** tab.

No `npm install` or build step is required by the plugin.

### MeshCentral plugin catalog

Add this URL in MeshCentral's plugin dialog:

```text
https://raw.githubusercontent.com/onix-informatika/MeshCentral-ConnectedToast/master/config.json
```

Restart MeshCentral after the plugin is installed or updated.

## Storage, multi-server routing, and cleanup

Custom configuration is saved as exactly one deterministic `connectedtoast-node` record per node through MeshCentral's common `Get`, `Set`, `Remove`, and `GetAllType` database abstraction. It survives restart and uses the same shared database as MeshCentral, including MongoDB or PostgreSQL-backed deployments. The plugin does not create a second database connection.

Transient relay deduplication stays in memory and expires five minutes after disconnect. Node deletion removes only that node's ConnectedToast record and transient entries. Startup cleanup removes stale ConnectedToast records whose nodes no longer exist.

Toast routing uses the local agent socket when available and MeshCentral's peer `agentCommand` route when the agent is connected to another server. If no route exists, the result is offline. A peer-bus copy of a relay event is ignored so a multi-server deployment does not generate duplicate toasts.

## Permissions, audit, and failure behavior

- Users with device access can read configuration.
- Manage Computers permission is required to save, reset, or send a test toast.
- Domain, node existence, visibility, permissions, operator IDs, rule fields, lengths, and placeholders are validated server-side.
- Native consent changes use MeshCentral's native `changedevice` audit/event path.
- Plugin rule changes store authoritative `updatedAt` and `updatedBy`, and dispatch a MeshCentral configuration event without custom message text.
- Logs are prefixed with `ConnectedToast` and include startup, cleanup, config changes, test attempts, and one result per toast attempt.
- Relay handling is fail-open. Plugin storage, template, and routing errors are logged and cannot interrupt Desktop, Terminal, or Files sessions.

**Reset ConnectedToast settings** deletes only plugin-owned rules. It never clears native `node.consent`.

## Verification

Run the automated suite with:

```sh
npm test
```

Before production rollout, validate on Windows 10 or 11 with at least two operators, one exact override and one inherited default. Separately confirm the native privacy bar, connect and optional disconnect behavior, Terminal and Files gating, Test Toast, offline behavior, restart persistence, and coexistence with AdminAutoShare, RoutePlus, and existing native User Consent settings. Document observed macOS or Linux MeshAgent toast differences instead of adding OS-specific hacks to v0.1.0.

Use the full [v0.1.0 acceptance matrix](docs/acceptance-v0.1.0.md) to record repository evidence and the required live Windows results.

## Non-goals for v0.1.0

ConnectedToast does not implement arbitrary JavaScript templates, schedules, geofencing, IP rules, email, SMS, Slack, screenshots, endpoint activity monitoring, clipboard or keystroke monitoring, automatic session blocking, operator-specific native prompts, native message overrides, or a MeshAgent fork. The plugin is for transparency, not monitoring.

## License

Apache-2.0
