# MeshCentral-ConnectedToast — Design & Implementation Specification

## 1. Objective

Build a MeshCentral plugin named **ConnectedToast** that provides a GUI-first, per-device configuration surface for remote-session transparency.

The primary use case is:

> When an operator connects to a particular endpoint through MeshCentral, the endpoint user should be able to see that somebody connected.

The plugin must support two related capabilities:

1. **Native MeshCentral per-device consent controls**
   - Desktop notification
   - Terminal notification
   - Files notification
   - Desktop consent prompt
   - Terminal consent prompt
   - Files consent prompt
   - Desktop connection privacy bar

2. **ConnectedToast custom notifications**
   - Per-device enable/disable
   - Per-operator rules
   - Per-protocol rules
   - Custom title/message
   - Default rule plus operator-specific overrides
   - Test notification
   - Optional connect/disconnect notifications

Everything must be configurable from the **MeshCentral GUI**.

There must be **no requirement to edit JSON configuration manually** for ordinary plugin use.

---

# 2. Target repository

Implement in:

`onix-informatika/MeshCentral-ConnectedToast`

Plugin short name:

`connectedtoast`

Suggested initial version:

`0.1.0`

Suggested MeshCentral compatibility floor:

`>=1.1.53`

Do not modify `MeshCentral-AdminAutoShare`.

Do not add ConnectedToast functionality to unrelated plugins.

---

# 3. Hard architectural constraint: no MeshCentral fork

The first implementation must be a **pure MeshCentral plugin**.

Do not patch:

- `meshuser.js`
- `meshrelay.js`
- `pluginHandler.js`
- `agents/meshcore.js`
- `default.handlebars`
- any other MeshCentral core file

unless a later separately approved enhancement explicitly introduces an upstream-compatible MeshCentral extension hook.

The plugin must survive ordinary MeshCentral upgrades as much as reasonably possible.

---

# 4. Important native MeshCentral behavior

## 4.1 Native user-consent bitmask

MeshCentral currently defines these consent bits:

| Bit | Value | Meaning |
|---|---:|---|
| Desktop Notify | `1` | Notify endpoint user when desktop session begins |
| Terminal Notify | `2` | Notify endpoint user when terminal session begins |
| Files Notify | `4` | Notify endpoint user when file session begins |
| Desktop Prompt | `8` | Require endpoint approval for desktop |
| Terminal Prompt | `16` | Require endpoint approval for terminal |
| Files Prompt | `32` | Require endpoint approval for file access |
| Desktop Privacy Bar | `64` | Display connection toolbar/privacy bar during desktop sharing |

ConnectedToast must use these exact native semantics.

Do not invent an alternative consent bitmask.

---

## 4.2 Effective consent is additive

MeshCentral calculates effective consent by OR-ing:

```text
domain.userconsentflags
OR mesh.consent
OR node.consent
OR connectingUser.consent
```

This has an important UI consequence:

**A device-level setting can add a requirement, but it cannot disable an inherited requirement.**

Example:

```text
Domain requires Desktop Privacy Bar = ON
Node ConnectedToast UI says node Privacy Bar = OFF
Effective result = ON
```

The ConnectedToast GUI must make this visible.

Never present an unchecked device-level checkbox as meaning "this feature will definitely be disabled."

---

# 5. Native settings GUI

Add a section named:

## Native MeshCentral visibility & consent

For the selected device, show these checkboxes:

### Notifications
- [ ] Notify user on Desktop connection
- [ ] Notify user on Terminal connection
- [ ] Notify user on Files connection

### Approval prompts
- [ ] Require approval for Desktop connection
- [ ] Require approval for Terminal connection
- [ ] Require approval for Files connection

### Persistent visibility
- [ ] Show Desktop privacy bar while connected

These directly represent `node.consent`.

Saving this section must update the device's native MeshCentral consent setting.

Prefer using MeshCentral's existing device-change mechanism rather than bypassing normal MeshCentral auditing by mutating a node document directly.

Codex should inspect the current MeshCentral UI implementation for editing device consent and reuse the same `changenode` pathway.

---

# 6. Native-settings visibility model

For every native setting, the GUI should distinguish:

```text
Device setting
Inherited setting
Effective setting
```

Example row:

```text
Desktop Privacy Bar

Device:       OFF
Inherited:    ON — Device Group "Onix Accounting"
Effective:    ON
```

Use visual states such as:

- green: effective ON
- gray: effective OFF
- amber/info icon: ON because inherited elsewhere

At minimum show inheritance from:

- Domain
- Device group
- Device

For operator-specific preview, also include:

- MeshCentral connecting user consent

---

# 7. Effective-for-operator preview

Add:

**Preview effective consent for operator:** `[operator dropdown]`

When an operator is selected, calculate:

```text
domain consent
| device-group consent
| node consent
| selected operator consent
```

Display the final seven-bit effective result.

This makes the interaction between ConnectedToast and native MeshCentral transparent instead of hiding MeshCentral's inheritance behavior.

---

# 8. Domain-level native settings are read-only in v1

MeshCentral currently sources these values at domain level:

## Consent messages
- title
- desktop message
- terminal message
- files message
- consent timeout
- auto accept on timeout
- auto accept if no user
- desktop-specific auto accept if no user
- terminal-specific auto accept if no user
- files-specific auto accept if no user
- auto accept if workstation locked
- desktop-specific auto accept if locked
- terminal-specific auto accept if locked
- files-specific auto accept if locked
- old-style consent UI

## Notification messages
- notification title
- desktop notification text
- terminal notification text
- files notification text

## Privacy bar
- `desktopPrivacyBarText`

The ConnectedToast device GUI should show an **Inherited domain settings** expandable section containing these values when available.

They are read-only in v1.

Do not pretend they are per-device settings.

---

# 9. Critical v1 limitation

Without modifying MeshCentral core:

### Supported per-device natively
- all seven `node.consent` bits

### Supported per-device/per-operator by ConnectedToast
- extra endpoint toast
- custom toast title
- custom toast message
- protocols
- connect/disconnect
- operator matching

### Not supported per-device/per-operator natively in plugin-only v1
- custom native Desktop privacy-bar text
- custom native consent-dialog text
- native consent timeout overrides
- native auto-accept overrides
- different native prompt requirement depending on operator

The UI and README must say this explicitly.

Do not silently emulate a native consent prompt with an after-the-fact toast.

---

# 10. ConnectedToast custom notification section

Add a second card:

## Connected Toast

Fields:

### General
- `Enable ConnectedToast for this device`
- `Notify on connection`
- `Notify on disconnect`

Defaults:

```text
enabled = false
notifyOnConnect = true
notifyOnDisconnect = false
```

---

# 11. Supported protocols

For v1 expose:

### Desktop
Protocol:

```text
2
```

### Terminal
Protocols:

```text
1
6
8
9
```

These represent terminal/admin shell/PowerShell variants.

### Files
Protocol:

```text
5
```

GUI:

```text
Sessions that generate a ConnectedToast:

[x] Desktop
[ ] Terminal
[ ] Files
```

Default:

```text
Desktop = ON
Terminal = OFF
Files = OFF
```

Do not include Messenger, Web-TCP, Web-RDP, Web-VNC, etc. in v1 unless testing demonstrates a clear endpoint-notification use case.

Keep protocol classification in one helper function so additional protocol classes can be introduced later.

---

# 12. Operator rules

The plugin must support:

## Default operator rule

A rule applied when no more-specific operator override exists.

Example:

```text
Default rule
Enabled: true
Desktop: true
Terminal: false
Files: false
Title: "Onix IT"
Message: "{operator} connected to this computer."
```

## Individual operator overrides

Add a table:

| Operator | Enabled | Desktop | Terminal | Files | Custom message |
|---|---|---|---|---|---|
| Igor | ✓ | ✓ | — | — | Custom |
| Alen | ✓ | ✓ | ✓ | ✓ | Default |
| Administrator | — | — | — | — | Disabled |

An individual user rule takes precedence over the default rule.

No complicated rule engine is necessary.

Precedence:

```text
exact operator rule
    ↓
default rule
    ↓
no toast
```

---

# 13. Operator selector

The GUI must retrieve operators from the server.

Do not trust a browser-supplied arbitrary user ID.

For the selected node, the server should return eligible same-domain MeshCentral users.

Prefer operators who actually have Desktop/remote-control rights to the device.

Display:

```text
Real Name
MeshCentral username
User ID
```

Example:

```text
Igor Benić
igbenic
user//igbenic
```

Store rules by immutable MeshCentral user ID, not visible display name.

---

# 14. Operator rule states

Each operator override must support three states:

### Inherit
Use Default Rule.

### Enabled override
Use this operator-specific rule.

### Disabled override
Never generate custom ConnectedToast notifications for this operator.

This lets an administrator configure:

```text
Everyone → normal notification
Igor → stupid custom notification
Service account → no notification
```

without needing allowlist/exclusion complexity.

---

# 15. Message configuration

Each rule supports:

```text
title
connectMessage
disconnectMessage
```

Suggested defaults:

```text
Title:
MeshCentral

Connect:
{operator} connected to {device}.

Disconnect:
{operator} disconnected from {device}.
```

Maximum recommended lengths:

```text
title: 128 characters
message: 1024 characters
```

Server must enforce limits.

---

# 16. Template placeholders

Support only a small explicit allowlist.

Required:

```text
{operator}
{realname}
{device}
{protocol}
{time}
```

Optional if easily reliable from event data:

```text
{nodeid}
{sessionid}
```

Do not evaluate JavaScript.

Do not implement Handlebars, EJS, template expressions, conditions or arbitrary code.

Unknown placeholders should remain visible or produce validation errors; choose one behavior and test it.

Recommended behavior:

> Reject unknown placeholders on Save.

---

# 17. Example custom rule

The GUI may document examples like:

```text
Title:
Onix IT

Message:
👀 Igor se spojio. Serije odmah ugasiti.
```

Another:

```text
🛠️ {operator} je spojen na {device}.
```

These are examples only.

Production defaults should remain professional.

---

# 18. Preview

As the administrator edits title/message fields, show:

## Preview

```text
┌──────────────────────────────────┐
│ Onix IT                          │
│ 👀 Igor se spojio.               │
│ Serije odmah ugasiti.            │
└──────────────────────────────────┘
```

Template preview can use:

```text
operator = Igor
realname = Igor Benić
device = TEST-PC
protocol = Desktop
```

No server request should be necessary for basic preview rendering.

---

# 19. Test Toast

Provide a button:

**Send test toast**

Requirements:

- selected device must currently be online
- user must have administrative/manage permission
- test uses the currently displayed title/message
- endpoint receives an actual MeshAgent toast
- no remote desktop session is required

The UI must report:

```text
Toast sent
```

or a meaningful error such as:

```text
Device is offline
Permission denied
Agent does not support toast
Unable to route command to agent
```

---

# 20. Session-event source

Do not detect sessions by scraping UI state.

Subscribe server-side to MeshCentral `relaylog` events.

For normal MeshAgent sessions, MeshCentral already emits start events containing:

```text
action = relaylog
userid
username
protocol
nodeid
```

Classify only **start** events for connection notification and **end** events for disconnect notification.

Do not send multiple toasts because multiple relay-related events happen during the same session.

---

# 21. Session deduplication

Maintain a short-lived in-memory session map keyed by something such as:

```text
nodeid + userid + relay/session identifier
```

Purpose:

- suppress duplicated start events
- suppress duplicate disconnect events
- avoid toast storms during reconnect handshakes

Suggested expiration:

```text
5 minutes after disconnect
```

Do not persist transient session state to the database.

---

# 22. Relay event handling

Pseudo-flow:

```text
HandleEvent(event)
    ↓
event.action == "relaylog" ?
    ↓
classify START / END
    ↓
classify protocol
    ↓
node configured?
    ↓
plugin enabled?
    ↓
resolve operator rule
    ↓
protocol enabled?
    ↓
render message
    ↓
send toast to agent
```

A failure to send the toast must **never terminate or interfere with the actual remote session**.

ConnectedToast is informational.

Fail open.

---

# 23. Sending a toast to the MeshAgent

MeshAgent already supports:

```json
{
  "action": "toast",
  "title": "...",
  "msg": "..."
}
```

Use that existing command.

Do not ship a custom MeshAgent module merely to display a notification.

---

# 24. Agent routing

Implement one helper:

```text
sendToastToNode(nodeId, title, message)
```

It must hide routing details from the rest of the plugin.

Behavior:

```text
if agent connected to current MeshCentral server:
    send directly

else if multi-server routing knows where agent lives:
    route command to correct MeshCentral server

else:
    return offline/unroutable
```

Do not scatter direct `wsagents[nodeid].send(...)` calls throughout the plugin.

Keep agent routing in one module/function.

---

# 25. Multi-server requirement

The plugin should not assume:

```text
the endpoint agent is connected to the same MeshCentral process that processed the browser event
```

ConnectedToast configuration must be shared consistently between MeshCentral servers.

If the deployment uses MongoDB, plugin state must be shared.

If NeDB/local storage is used, document that multi-server operation requires shared/synchronized plugin storage or use MeshCentral's common DB abstraction.

Codex must inspect the current deployment architecture before finalizing persistence.

---

# 26. Configuration persistence

Do not store custom ConnectedToast rules inside `node.consent`.

`node.consent` is only for native MeshCentral bits.

Custom rule data belongs to plugin-owned persistence.

Recommended logical record:

```json
{
  "type": "connectedtoast-node",
  "domain": "",
  "nodeId": "node//...",
  "enabled": true,

  "notifyOnConnect": true,
  "notifyOnDisconnect": false,

  "protocols": {
    "desktop": true,
    "terminal": false,
    "files": false
  },

  "defaultRule": {
    "state": "enabled",
    "title": "MeshCentral",
    "connectMessage": "{operator} connected to {device}.",
    "disconnectMessage": "{operator} disconnected from {device}."
  },

  "operatorRules": {
    "user//igbenic": {
      "state": "enabled",
      "title": "Onix IT",
      "connectMessage": "👀 Igor se spojio. Serije odmah ugasiti.",
      "disconnectMessage": ""
    }
  },

  "updatedAt": 0,
  "updatedBy": "user//..."
}
```

Use a deterministic node key.

Exactly one active configuration record per node.

---

# 27. Persistence implementation preference

Prefer the simplest storage mechanism that:

- works with the current MeshCentral DB
- supports MongoDB if deployed
- survives restart
- works cleanly with multiple MeshCentral instances
- does not require editing MeshCentral schemas

Inspect existing Onix plugins before choosing.

`MeshCentral-RoutePlus` contains a working plugin database abstraction and may be used as a structural reference.

Do not blindly copy RoutePlus DB code if MeshCentral's current core DB can safely hold plugin-owned records more simply.

---

# 28. Cleanup

When a node is deleted:

- remove its ConnectedToast configuration
- remove stale session state

Subscribe to node deletion events where possible.

Also provide startup cleanup for configurations whose nodes no longer exist.

Cleanup must never delete unrelated plugin or MeshCentral data.

---

# 29. Device-page GUI integration

ConnectedToast must be discoverable from the individual MeshCentral device page.

Preferred UX:

```text
Device
 ├─ General
 ├─ Desktop
 ├─ Terminal
 ├─ Files
 ├─ ...
 └─ Connected Toast
```

If the active MeshCentral plugin API cleanly supports custom device panels/tabs, use that.

If not, use the existing plugin frontend hook pattern to inject a:

**Connected Toast**

button/link into the device page and open a plugin-owned settings panel/modal.

Do not edit MeshCentral Handlebars files directly.

---

# 30. UI lifecycle

On device page load/change:

```text
onDeviceRefreshEnd
    ↓
detect currentNode
    ↓
ensure ConnectedToast control exists once
    ↓
request configuration
```

Avoid duplicate controls when MeshCentral refreshes/re-renders the page.

When navigating away, plugin UI state must clean up normally.

---

# 31. Browser/server plugin protocol

Follow the existing MeshCentral plugin WebSocket pattern.

Browser request:

```json
{
  "action": "plugin",
  "plugin": "connectedtoast",
  "pluginaction": "getNodeConfig",
  "nodeid": "node//..."
}
```

Recommended server actions:

```text
getNodeConfig
saveNodeConfig
getOperators
testToast
resetNodeConfig
```

Recommended browser response methods:

```text
setNodeConfig
setOperators
saveResult
testToastResult
connectedToastError
```

Export the required frontend callback methods through the normal plugin export mechanism.

---

# 32. Server-side authorization

Every plugin action must be authorized server-side.

Never rely on:

- hidden buttons
- disabled form fields
- browser-provided user info
- browser-provided domain
- browser claims about permissions

Validate:

1. requesting MeshCentral user is authenticated
2. node exists
3. node belongs to same allowed domain
4. requesting user has sufficient rights
5. target operator IDs belong to the correct domain
6. target node is visible/manageable by requesting user

Suggested requirement for changing configuration:

```text
MESHRIGHT_MANAGECOMPUTERS
```

or full site admin.

Use the closest native MeshCentral authorization semantics.

---

# 33. Viewing vs editing permissions

Suggested:

### Read configuration
Users with device access may view current behavior.

### Edit configuration
Only users with Manage Computers or administrative rights.

### Send test toast
Same permission as Edit.

If exposing configuration to ordinary users creates unnecessary complexity, v1 may restrict the entire panel to administrators/manage-computer users.

Prefer simple and secure.

---

# 34. Operator information privacy

`getOperators` must not expose unrelated cross-domain users.

Return only fields needed by the GUI:

```json
{
  "id": "user//...",
  "name": "...",
  "realname": "..."
}
```

Do not send:

- password metadata
- tokens
- authentication details
- email unless needed
- phone
- unrelated user object fields

---

# 35. Native consent save behavior

When saving native consent checkboxes:

1. read current node consent
2. encode selected seven bits
3. use normal MeshCentral device mutation semantics
4. ensure normal `changenode` audit/event behavior occurs
5. refresh node state
6. display actual saved value

Do not write native consent into the ConnectedToast plugin DB as the authoritative copy.

The node is authoritative.

---

# 36. Native consent encoding helper

Implement and test:

```text
decodeConsentBits(number)
encodeConsentBits(object)
```

Example:

```text
Desktop Notify      true  = 1
Desktop Prompt      true  = 8
Privacy Bar         true  = 64

Total:
1 + 8 + 64 = 73
```

Do not scatter literal bit arithmetic through UI/server code.

Use named constants.

---

# 37. Inherited native configuration

The server response for `getNodeConfig` should include:

```json
{
  "native": {
    "nodeConsent": 64,
    "domainConsent": 0,
    "meshConsent": 0
  }
}
```

For operator preview, optionally calculate:

```json
{
  "operatorConsent": 1,
  "effectiveConsent": 65
}
```

The browser should not have to reverse-engineer MeshCentral's entire object graph.

---

# 38. Read-only domain defaults response

Also return normalized inherited settings:

```json
{
  "domainDefaults": {
    "desktopPrivacyBarText": "...",
    "consentMessages": {},
    "notificationMessages": {}
  }
}
```

Do not expose the entire MeshCentral domain configuration object.

Whitelisted fields only.

---

# 39. Custom-toast independence

Custom ConnectedToast notifications are separate from native:

```text
Desktop Notify bit
```

Possible configuration:

```text
Native Desktop Notify = OFF
ConnectedToast custom Desktop toast = ON
```

That should still result in the ConnectedToast toast.

Likewise:

```text
Native Desktop Notify = ON
ConnectedToast custom toast = ON
```

may result in two user-visible notifications.

The GUI must warn about this possibility:

> Both native Desktop Notification and ConnectedToast are enabled; the endpoint may receive two notifications.

---

# 40. Recommended normal configuration

For the original use case, recommend:

```text
Native Desktop Privacy Bar: ON
Native Desktop Notify: OFF

ConnectedToast:
    ON
    Desktop: ON
    Default professional message
    Optional per-operator custom messages
```

This gives:

- persistent visible session indicator
- one customizable connection toast
- no duplicate stock notification

---

# 41. UX: status summary

At the top of the panel show:

```text
Desktop transparency

Privacy bar:       ON
Connection toast:  ON
Approval prompt:   OFF
```

For the selected operator:

```text
Operator: Igor
Effective:
✓ Privacy bar
✓ ConnectedToast
✗ Approval prompt
```

This should let an administrator understand the endpoint experience without mentally decoding bitfields.

---

# 42. Reset behavior

Provide:

**Reset ConnectedToast settings**

This must:

- delete plugin-owned ConnectedToast config for the node
- NOT clear `node.consent`

Native MeshCentral consent settings are separate and must not be unexpectedly destroyed.

If desired, provide a separately labeled:

**Clear device-native consent settings**

with explicit confirmation.

Do not combine these actions.

---

# 43. Validation

Server must validate:

```text
boolean fields
allowed protocol names
allowed rule states
operator IDs
title length
message length
placeholder names
node/domain ownership
```

Strip or reject unexpected fields.

Do not persist arbitrary client JSON.

---

# 44. HTML/script safety

Messages may contain ordinary Unicode and emoji.

They must not become executable HTML.

Treat title/message as plain text at every layer.

Never inject them using unsanitized `innerHTML`.

Never permit:

```html
<script>
<img onerror=...>
```

to execute in the administration UI.

---

# 45. Logging

Use plugin-prefixed logs:

```text
PLUGIN: ConnectedToast:
```

Log:

- startup
- config save
- config delete
- test toast
- session toast send success/failure
- stale configuration cleanup

Do not excessively log every relay packet.

One log entry per toast attempt is sufficient at debug verbosity.

---

# 46. Auditability

Configuration changes should capture:

```text
updatedAt
updatedBy
```

Where practical, also dispatch a MeshCentral event describing:

```text
ConnectedToast settings changed for DEVICE
```

Do not include custom message text in audit logs unless necessary.

---

# 47. Fail-open requirements

ConnectedToast must never:

- break remote Desktop
- reject Terminal
- interrupt Files
- disconnect an agent
- prevent MeshCentral startup

because its own DB/config/toast logic failed.

Errors should be logged and ignored from the remote-session perspective.

Native consent prompts, when enabled, remain MeshCentral's responsibility.

---

# 48. Offline behavior

When endpoint is offline:

- config remains editable
- Test Toast disabled or returns "Device offline"
- native `node.consent` remains configurable
- no ConnectedToast is attempted

When endpoint reconnects, no special synchronization is required because custom toast rules are server-side.

---

# 49. Suggested repository structure

```text
MeshCentral-ConnectedToast/
├── README.md
├── config.json
├── changelog.md
├── connectedtoast.js
├── db.js                    # only if dedicated DB abstraction is needed
├── lib/
│   ├── consent.js
│   ├── rules.js
│   ├── templates.js
│   ├── protocols.js
│   └── agent-routing.js
├── views/
│   └── device.handlebars    # if plugin panel route is used
└── test/
    ├── consent.test.js
    ├── rules.test.js
    ├── templates.test.js
    ├── protocols.test.js
    └── connectedtoast.test.js
```

Do not create unnecessary layers if the final implementation is small.

The logical boundaries above are more important than exact filenames.

---

# 50. `connectedtoast.js` responsibilities

Main plugin file should own:

- plugin initialization
- MeshCentral references
- event subscriptions
- plugin browser/server actions
- authorization orchestration
- session-event orchestration
- frontend exports
- startup/shutdown lifecycle

It should not contain hundreds of lines of:

- template parsing
- DB code
- bitmask math
- protocol mapping

Split those if they grow beyond trivial helpers.

---

# 51. Configuration metadata

Create normal MeshCentral plugin metadata in `config.json`.

Suggested:

```json
{
  "name": "Connected Toast",
  "shortName": "connectedtoast",
  "version": "0.1.0",
  "description": "Per-device MeshCentral remote-session visibility and custom endpoint connection notifications.",
  "hasAdminPanel": false,
  "meshCentralCompat": ">=1.1.53"
}
```

Populate repository URLs consistently with the actual GitHub repository.

---

# 52. Installation README

Document both installation modes used by the existing Onix plugins:

### Local/manual
Copy to:

```text
meshcentral-data/plugins/connectedtoast
```

and include:

```json
"plugins": {
  "enabled": true,
  "list": ["connectedtoast"]
}
```

### Plugin catalog
Use ConnectedToast's `config.json` URL.

Document whether a MeshCentral restart is required.

---

# 53. Test plan — unit

Required unit tests:

## Consent
- encode all bits individually
- decode all bits individually
- combinations
- zero
- `127`
- preserve no unknown bits unless intentionally supported

## Rule resolution
- exact operator wins
- disabled exact operator wins over enabled default
- inherited operator uses default
- disabled plugin produces no toast
- disabled protocol produces no toast

## Templates
- valid placeholders
- Unicode
- emoji
- unknown placeholder rejected
- max-length enforcement
- no code evaluation

## Protocols
- `2` → Desktop
- `1/6/8/9` → Terminal
- `5` → Files
- unsupported protocols ignored

---

# 54. Test plan — event handling

Simulate relay start:

```text
user Igor
node PC1
protocol 2
```

Expected:

```text
one Desktop connect toast
```

Repeat same event:

```text
no duplicate toast
```

Disconnect:

```text
disconnect toast only if enabled
```

Different operator:

```text
correct override selected
```

Disabled operator:

```text
no custom toast
```

---

# 55. Test plan — native consent

Given:

```text
domain = 1
mesh = 8
node = 64
user = 2
```

Effective:

```text
75
```

Verify GUI accurately reports:

```text
Desktop Notify       domain
Terminal Notify      operator
Desktop Prompt       mesh
Privacy Bar          node
```

Unchecking the node's Privacy Bar must not falsely show another inherited bit as disabled.

---

# 56. Test plan — permissions

Verify:

- ordinary unauthorized user cannot save settings
- user from another domain cannot access node config
- fake operator ID rejected
- fake node ID rejected
- user lacking Manage Computers cannot test toast
- browser cannot request toast to arbitrary node outside rights

---

# 57. Test plan — live manual

Use at least two MeshCentral operators:

```text
Igor
Alen
```

Configure:

```text
Default:
"IT support connected."

Igor:
"👀 Igor se spojio. Serije odmah ugasiti."

Alen:
inherit default
```

Connect from Igor:

Expected:

```text
custom Igor message
```

Connect from Alen:

Expected:

```text
professional default
```

Confirm Desktop Privacy Bar behavior separately.

---

# 58. Test plan — endpoint OS

At minimum test:

- Windows 10/11

If your active fleet includes them, also verify:

- macOS
- Linux desktop

If MeshAgent toast behavior differs by OS, document it rather than adding OS-specific hacks immediately.

---

# 59. Test plan — coexistence

Verify plugin alongside:

- AdminAutoShare
- RoutePlus
- existing MeshCentral native User Consent settings

ConnectedToast must not modify their data or handlers.

---

# 60. Acceptance criteria

Version `0.1.0` is complete when:

1. Plugin installs without MeshCentral core modifications.
2. Individual device page exposes ConnectedToast GUI.
3. All seven native node consent bits are editable.
4. Effective inherited consent is clearly displayed.
5. Custom ConnectedToast can be enabled per device.
6. Default custom rule works.
7. Individual operator override works.
8. Individual operator disable works.
9. Desktop connection event generates exactly one toast.
10. Terminal/Files behave according to protocol checkboxes.
11. Test Toast works.
12. Custom Unicode/emoji text works.
13. Unauthorized configuration writes are rejected.
14. Offline node handling is clean.
15. MeshCentral remote sessions still work if ConnectedToast throws/fails.
16. Configuration survives MeshCentral restart.
17. README clearly documents native-vs-plugin limitations.
18. No MeshCentral fork/core patch is required.

---

# 61. Explicit non-goals for v0.1.0

Do not implement:

- arbitrary JavaScript templates
- schedules
- geofencing
- IP-based rules
- SMS/email notifications
- Slack notifications
- screenshots
- activity monitoring
- logging what the endpoint user is doing
- clipboard monitoring
- keystroke monitoring
- silent surveillance features
- automatic session blocking based on custom rules
- per-operator native consent prompts
- per-operator native privacy-bar text
- MeshAgent fork

This plugin is about **transparency**, not monitoring.

---

# 62. Future v0.2 possibility: richer native overrides

If operator-specific native behavior becomes important, the clean future solution is a tiny upstream MeshCentral plugin hook inserted after MeshCentral has assembled:

```text
command.consent
command.soptions
command.privacybartext
```

but before the command is sent to the agent.

Conceptually:

```js
pluginHandler.callHook(
    "onRemoteSessionCommand",
    context,
    command
);
```

Context would include:

```text
domain
mesh
node
user
protocol
```

ConnectedToast could then alter:

- consent flags
- privacy-bar text
- consent title/message
- notification title/message
- timeout/autoaccept options

per `(node, operator)` pair.

This should be pursued as an upstream-compatible extension, not as a monkey patch.

Do **not** include it in v0.1.0.

---

# 63. Key design philosophy

The administration experience should answer one question immediately:

> **What will the person sitting at this computer see when this particular MeshCentral operator connects?**

The administrator should never need to know that:

```text
64 = privacy bar
```

or manually combine inheritance bitmasks.

The GUI should translate MeshCentral's low-level behavior into:

```text
Igor connects:
✓ Persistent privacy bar
✓ Custom toast
✗ Approval required

Alen connects:
✓ Persistent privacy bar
✓ Standard toast
✗ Approval required
```

That is the core product value.

---

# 64. Codex startup instructions

Before writing code:

1. Read this specification completely.
2. Inspect `onix-informatika/MeshCentral-ConnectedToast`.
3. Read the repository's `AGENTS.md` if one exists.
4. Inspect current `onix-informatika/MeshCentral` source for:
   - plugin loading
   - `node.consent`
   - `routeCommandToNode`
   - `relaylog`
   - MeshAgent `toast`
   - current device-page consent editor
5. Inspect:
   - `MeshCentral-AdminAutoShare`
   - `MeshCentral-RoutePlus`
6. Follow existing Onix plugin conventions where sensible.
7. Confirm exact GUI hook available in the deployed MeshCentral version.
8. Confirm persistence strategy works with the actual MeshCentral deployment database.
9. Write tests before implementation for consent bits, rule resolution, templates and protocol classification.
10. Do not modify MeshCentral core merely because plugin integration is inconvenient.

If a required capability turns out to be impossible through the current plugin API, stop and document the missing hook rather than silently patching MeshCentral.