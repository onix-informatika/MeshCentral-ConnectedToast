# ConnectedToast v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure MeshCentral plugin that exposes per-device native consent controls and per-operator custom connection toasts from the device GUI.

**Architecture:** The plugin uses MeshCentral's existing device plugin tab hook and browser plugin protocol, stores deterministic `connectedtoast-node` records through MeshCentral's common DB abstraction, listens to local `relaylog` events, and routes the existing MeshAgent `toast` command locally or through peer routing. Small CommonJS modules own consent math, protocols, templates, rules, persistence, session tracking, authorization, routing, and browser UI so each boundary is testable without patching MeshCentral.

**Tech Stack:** Node.js CommonJS, Node built-in test runner, MeshCentral plugin API compatible with 1.1.53 and the inspected Onix MeshCentral 1.1.59 fork, PostgreSQL-backed MeshCentral DB abstraction.

**Spec:** The repository file matching `*Design & Implementation Specification.md`, supplied by the user.

## Global Constraints

- Plugin short name is `connectedtoast`, version is `0.1.0`, compatibility is `>=1.1.53`.
- Do not modify MeshCentral core or any unrelated plugin.
- Native consent remains authoritative in `node.consent`, with bits `1, 2, 4, 8, 16, 32, 64`.
- Custom configuration is plugin-owned and uses exactly one deterministic record per node.
- Browser data is untrusted. Authentication, domain, node visibility, manage rights, operator IDs, limits, placeholders, and allowed fields are checked server-side.
- Title is at most 128 characters, messages are at most 1024 characters, and only `{operator}`, `{realname}`, `{device}`, `{protocol}`, `{time}`, `{nodeid}`, and `{sessionid}` are accepted.
- Supported relay protocols are Desktop `2`, Terminal `1/6/8/9`, and Files `5`.
- Relay handling is informational and fail-open. A plugin failure must never affect the remote session.
- Dynamic title/message text is plain text and is never inserted with unsanitized `innerHTML`.
- Current Onix deployment uses one MeshCentral replica and the common PostgreSQL database. The persistence adapter must remain valid for shared-DB multi-server deployments.

---

### Task 1: Repository test harness, consent bits, and protocol classification

**Files:**
- Create: `package.json`
- Create: `lib/consent.js`
- Create: `lib/protocols.js`
- Create: `test/consent.test.js`
- Create: `test/protocols.test.js`

**Interfaces:**
- Produces: `CONSENT_BITS`, `encodeConsentBits(flags)`, `decodeConsentBits(value)`, `effectiveConsent(sources)`, `consentSources(sources)`.
- Produces: `classifyProtocol(value)` returning `desktop`, `terminal`, `files`, or `null`, and `protocolLabel(value)`.

- [x] **Step 1: Add the Node test harness and failing consent tests**

```json
{
  "name": "meshcentral-connectedtoast",
  "version": "0.1.0",
  "private": true,
  "scripts": { "test": "node --test" },
  "engines": { "node": ">=18" }
}
```

The tests must hand-check every bit, `0`, `127`, combinations including `73`, reject non-integers, mask unknown bits, calculate `1 | 8 | 64 | 2 = 75`, and identify the source labels for every active bit.

- [x] **Step 2: Run consent tests and confirm RED**

Run: `node --test test/consent.test.js`

Expected: FAIL because `lib/consent.js` does not exist.

- [x] **Step 3: Implement named consent constants and pure encoding helpers**

```js
const CONSENT_MASK = 0x7F;
function encodeConsentBits(flags) { /* sum only named true flags */ }
function decodeConsentBits(value) { /* return all seven named booleans */ }
function effectiveConsent(sources) { /* OR normalized source values */ }
function consentSources(sources) { /* return active source names per bit */ }
```

Invalid numbers throw `TypeError`; values are masked with `0x7F`, so unknown bits are not preserved.

- [x] **Step 4: Run consent tests and confirm GREEN**

Run: `node --test test/consent.test.js`

Expected: all consent tests PASS.

- [x] **Step 5: Add failing table-driven protocol tests**

Use literal cases: `2 -> desktop`, `1/6/8/9 -> terminal`, `5 -> files`, and `0/3/4/10/14/200/201/undefined -> null`.

- [x] **Step 6: Run protocol tests and confirm RED**

Run: `node --test test/protocols.test.js`

Expected: FAIL because `lib/protocols.js` does not exist.

- [x] **Step 7: Implement the single protocol classifier and labels**

Normalize numeric strings, accept only finite integers, and keep all protocol sets in this module.

- [x] **Step 8: Run both test files and confirm GREEN**

Run: `node --test test/consent.test.js test/protocols.test.js`

Expected: all tests PASS.

### Task 2: Safe templates, validated configuration, and rule precedence

**Files:**
- Create: `lib/templates.js`
- Create: `lib/rules.js`
- Create: `lib/config.js`
- Create: `test/templates.test.js`
- Create: `test/rules.test.js`
- Create: `test/config.test.js`

**Interfaces:**
- Produces: `validateTemplate(text, maxLength, fieldName)` and `renderTemplate(text, context)`.
- Produces: `createDefaultConfig(nodeId, domain)`, `validateNodeConfig(input, context)`, and `sanitizeNodeConfig(input, context)`.
- Produces: `resolveRule(config, operatorId, protocolClass)` returning `{ rule, source }` or `null`.

- [x] **Step 1: Add failing template behavior tests**

Cover all seven allowed placeholders, repeated placeholders, Unicode and emoji, unknown placeholder rejection, title/message maximums, literal `<script>` preservation as plain text, and strings such as `${process.exit()}` remaining inert text.

- [x] **Step 2: Run template tests and confirm RED**

Run: `node --test test/templates.test.js`

Expected: FAIL because the template module is missing.

- [x] **Step 3: Implement allowlist validation and literal replacement**

Use one brace-token regular expression, reject tokens not in the fixed `Set`, and replace values with `String(context[name] ?? '')`. Do not use `eval`, `Function`, a template engine, or HTML rendering.

- [x] **Step 4: Run template tests and confirm GREEN**

Run: `node --test test/templates.test.js`

Expected: all template tests PASS.

- [x] **Step 5: Add failing rule and configuration tests**

Cover exact enabled override, exact disabled override, inherit using default, disabled default, plugin disabled, global protocol disabled, rule protocol disabled, stripped unexpected fields, invalid booleans/states/protocol names, cross-domain operator ID rejection, limits, placeholder errors, and default values from the spec.

- [x] **Step 6: Run rule/config tests and confirm RED**

Run: `node --test test/rules.test.js test/config.test.js`

Expected: FAIL because rule and config modules are missing.

- [x] **Step 7: Implement the strict configuration schema and rule resolution**

Each enabled rule has `state`, `protocols`, `title`, `connectMessage`, and `disconnectMessage`. Top-level protocols and resolved-rule protocols are both required for a toast. Operator rules accept `inherit`, `enabled`, or `disabled`; the default rule accepts `enabled` or `disabled`. The validator constructs a fresh object and never copies arbitrary client properties.

- [x] **Step 8: Run task tests and confirm GREEN**

Run: `node --test test/templates.test.js test/rules.test.js test/config.test.js`

Expected: all tests PASS.

### Task 3: MeshCentral common DB persistence and cleanup

**Files:**
- Create: `db.js`
- Create: `test/db.test.js`

**Interfaces:**
- Produces: `CreateStore(meshServer)` with `getNodeConfig(nodeId)`, `saveNodeConfig(config)`, `deleteNodeConfig(nodeId)`, `listNodeConfigs()`, and `cleanupStaleConfigs(nodeExists)`.
- Deterministic key: `connectedtoast-node//<domain>/<node-guid>` derived only from a validated `node/<domain>/<guid>` ID.

- [x] **Step 1: Add failing persistence contract tests using a callback-style in-memory core DB fake**

Verify deterministic upsert, exactly one record per node, type/domain/nodeId fields, read after save, isolated delete, list by `connectedtoast-node`, startup cleanup deleting only missing-node ConnectedToast records, and error propagation.

- [x] **Step 2: Run persistence tests and confirm RED**

Run: `node --test test/db.test.js`

Expected: FAIL because `db.js` does not exist.

- [x] **Step 3: Implement the thin Promise adapter over `meshServer.db`**

Use only core `Get`, `Set`, `Remove`, and `GetAllType`. Do not open a second PostgreSQL/Mongo/NeDB connection. Keep transient session state out of the DB.

- [x] **Step 4: Run persistence tests and confirm GREEN**

Run: `node --test test/db.test.js`

Expected: all persistence tests PASS.

### Task 4: Relay classification, deduplication, rule rendering, and agent routing

**Files:**
- Create: `lib/sessions.js`
- Create: `lib/agent-routing.js`
- Create: `lib/relay-handler.js`
- Create: `test/sessions.test.js`
- Create: `test/agent-routing.test.js`
- Create: `test/relay-handler.test.js`

**Interfaces:**
- Produces: `classifyRelayEvent(event)` returning `{ phase, protocolClass, protocolLabel, sessionId, key }` or `null`.
- Produces: `createSessionTracker({ now, disconnectedTtlMs })` with `accept(eventInfo)`, `removeNode(nodeId)`, and `prune()`.
- Produces: `createAgentRouter(meshServer).sendToastToNode(nodeId, title, message, actor)` returning `{ ok, code }`.
- Produces: `createRelayHandler(dependencies).handle(event)` that always resolves and never throws into MeshCentral dispatch.

- [x] **Step 1: Add failing session classification and dedup tests**

Use MeshCentral message IDs `14/15/16` for start and `10/11/12` for end. Use `msgArgs[0]` as the relay ID. Assert one start, no duplicate start, one optional end, no duplicate end, a different operator/session remains independent, unsupported relay IDs are ignored, and ended entries expire after five minutes.

- [x] **Step 2: Run session tests and confirm RED**

Run: `node --test test/sessions.test.js`

Expected: FAIL because the session module is missing.

- [x] **Step 3: Implement relay classification and the in-memory tracker**

The key is `nodeid + userid + relayId`. If a relay ID is absent, include protocol as a conservative fallback. Active entries are pruned after a bounded stale period; ended entries expire after `300000` ms.

- [x] **Step 4: Run session tests and confirm GREEN**

Run: `node --test test/sessions.test.js`

Expected: all session tests PASS.

- [x] **Step 5: Add failing agent routing tests**

Cover direct `wsagents[nodeId].send`, peer `GetRoutingServerIdNotSelf(nodeId, 1)` plus `DispatchMessageSingleServer({ action: 'agentCommand', ... })`, offline, send exception, invalid text, and one central send call.

- [x] **Step 6: Run routing tests and confirm RED, then implement and confirm GREEN**

Run before and after implementation: `node --test test/agent-routing.test.js`

Expected before: missing module. Expected after: all routing tests PASS.

- [x] **Step 7: Add failing end-to-end relay handler tests**

Use real config, template, rule, protocol, and session modules with fake store/node/user/router boundaries. Assert correct default and override messages, disabled operator, protocol gating, connect/disconnect flags, duplicate suppression, node name and real name interpolation, missing config, offline agent, store failure, template failure, and router failure all leave the handler resolved.

- [x] **Step 8: Run relay handler tests and confirm RED, then implement and confirm GREEN**

Run before and after implementation: `node --test test/relay-handler.test.js`

Expected before: missing module. Expected after: all relay handler tests PASS with no unhandled rejection.

### Task 5: Authorized MeshCentral server plugin actions and lifecycle

**Files:**
- Create: `lib/server-api.js`
- Create: `connectedtoast.js`
- Create: `test/server-api.test.js`
- Create: `test/connectedtoast.test.js`

**Interfaces:**
- Produces server actions: `getNodeConfig`, `saveNodeConfig`, `getOperators`, `testToast`, and `resetNodeConfig`.
- Produces browser methods: `setNodeConfig`, `setOperators`, `saveResult`, `testToastResult`, and `connectedToastError`.
- `connectedtoast.js` exports `module.exports.connectedtoast = function (parent)` with `server_startup`, `serveraction`, `HandleEvent`, and frontend exports.

- [x] **Step 1: Add failing authorization and response tests**

Build complete fake MeshCentral user, domain, mesh, node, users map, rights calculation, DB, websocket, and router objects. Cover authenticated same-domain read, invisible node, cross-domain node, fake node, edit without `MESHRIGHT_MANAGECOMPUTERS`, test without edit rights, same-domain operator validation, fake operator rejection, minimal operator response fields, and meaningful action errors.

- [x] **Step 2: Run server API tests and confirm RED**

Run: `node --test test/server-api.test.js`

Expected: FAIL because `lib/server-api.js` does not exist.

- [x] **Step 3: Implement server-side node and permission resolution**

Use `session.user`, `session.domain`, `meshServer.db.Get`, and `webserver.GetNodeRights`. Read requires nonzero node rights. Save/reset/test require bit `0x00000004`. Every response is sent only on `session.ws`; no browser-supplied user or domain is trusted.

- [x] **Step 4: Implement normalized native/domain/operator response data**

Return node, mesh, domain, and operator consent values, effective values, online state, `canEdit`, whitelisted consent/notification/privacy-bar defaults, sanitized custom config, and same-domain operators sorted with remote-control-capable users first. Return only `id`, `name`, `realname`, `consent`, and `effectiveConsent` for operator preview.

- [x] **Step 5: Run server API tests and confirm GREEN**

Run: `node --test test/server-api.test.js`

Expected: all server API tests PASS.

- [x] **Step 6: Add failing lifecycle/event orchestration tests**

Verify startup registers `['*']`, starts stale-config cleanup without blocking startup, processes only local-source relay events so peer-bus copies cannot duplicate toasts, deletes config and session state on local `removenode`, dispatches an audit event without custom message text after save/reset, and logs failures without throwing.

- [x] **Step 7: Run plugin integration tests and confirm RED**

Run: `node --test test/connectedtoast.test.js`

Expected: FAIL because `connectedtoast.js` is missing.

- [x] **Step 8: Implement the plugin factory and lifecycle, then confirm GREEN**

Run: `node --test test/connectedtoast.test.js test/server-api.test.js`

Expected: all integration tests PASS.

### Task 6: Device-page tab and complete GUI behavior

**Files:**
- Create: `lib/browser-ui.js`
- Create: `test/browser-ui.test.js`
- Modify: `connectedtoast.js`

**Interfaces:**
- Produces serializable frontend methods `onDeviceRefreshEnd`, `requestNodeConfig`, `setNodeConfig`, `setOperators`, `renderPanel`, `renderNativeRows`, `renderStatusSummary`, `renderRuleEditor`, `renderPreview`, `collectConfig`, `save`, `sendTestToast`, `reset`, `saveResult`, `testToastResult`, and `connectedToastError`.
- Every exported function calls sibling functions through `pluginHandler.connectedtoast` so MeshCentral's `Function#toString` export mechanism preserves behavior without closures.

- [x] **Step 1: Add failing browser behavior tests with a minimal DOM and WebSocket fake**

Verify one `connectedtoast-panel` tab after repeated refreshes, request payloads use the current node, operator options are created with `textContent`, preview uses `textContent`, save sends core `{ action: 'changedevice', nodeid, consent }` plus sanitized plugin config, reset never sends native consent, offline test is blocked, and callback methods display success/error state.

- [x] **Step 2: Run browser tests and confirm RED**

Run: `node --test test/browser-ui.test.js`

Expected: FAIL because the browser UI module is missing.

- [x] **Step 3: Implement the static panel skeleton and refresh lifecycle**

Register the normal MeshCentral plugin tab through `pluginHandler.registerPluginTab({ tabId: 'connectedtoast-panel', tabTitle: 'Connected Toast' })`, fill only static markup with `innerHTML`, then request config. Repeated refreshes replace tab contents but never create duplicate controls.

- [x] **Step 4: Implement native consent, inheritance, operator preview, and status rendering**

Render seven device checkboxes, domain/mesh/node/operator source badges, effective ON/OFF state, the selected operator's effective mask, read-only domain defaults, Desktop transparency summary, and the duplicate native/custom notification warning.

- [x] **Step 5: Implement custom config, rule table/editor, plain-text preview, test, save, and reset**

Expose top-level enable/connect/disconnect/protocols, default rule, operator override states, per-rule protocols/title/connect/disconnect fields, live placeholder preview, test toast, reset confirmation, permission-disabled controls, online state, and v1 limitation text. Dynamic text uses `.textContent` or form `.value` only.

- [x] **Step 6: Run browser tests and confirm GREEN**

Run: `node --test test/browser-ui.test.js`

Expected: all browser behavior tests PASS.

- [x] **Step 7: Run the full automated suite**

Run: `npm test`

Expected: all tests PASS with no warnings or unhandled rejections.

### Task 7: Plugin metadata, documentation, and release content

**Files:**
- Modify: `README.md`
- Create: `config.json`
- Create: `changelog.md`

**Interfaces:**
- Produces valid MeshCentral catalog metadata and complete operator/install documentation.

- [x] **Step 1: Write valid `config.json` metadata**

Include name, short name, version, author, description, `hasAdminPanel: false`, homepage, changelog/config/download URLs, Git repository, version history URL, and `meshCentralCompat: ">=1.1.53"` for `onix-informatika/MeshCentral-ConnectedToast`.

- [x] **Step 2: Replace the placeholder README with installation and behavior documentation**

Document manual folder placement, local plugin list, catalog URL, restart requirement, GUI path, defaults, protocols, rule precedence, placeholders/limits, native versus custom independence, duplicate-notification warning, current PostgreSQL/shared-DB persistence, multi-server routing, offline behavior, security model, test toast semantics, endpoint OS caveat, and every plugin-only v1 limitation/non-goal from the spec.

- [x] **Step 3: Add the `0.1.0` changelog**

List native consent UI, inheritance preview, custom rule support, test toast, relay dedup, common DB persistence, authorization, cleanup, and fail-open behavior.

- [x] **Step 4: Validate metadata and prose constraints**

Run: `node -e "JSON.parse(require('fs').readFileSync('config.json', 'utf8')); console.log('config ok')"`

Run: `rg -n 'unfinished-marker|implement-later-marker|\u2014' README.md config.json changelog.md lib connectedtoast.js test`

Expected: JSON prints `config ok`; search has no matches.

### Task 8: Acceptance verification and handoff

**Files:**
- Modify only files needed to fix verification findings.

**Interfaces:**
- Produces evidence for automated acceptance criteria and a precise list of live/manual items not provable locally.

- [x] **Step 1: Run fresh complete automated verification**

Run: `npm test`

Expected: zero failures.

Run: `node --check connectedtoast.js && for f in db.js lib/*.js test/*.js; do node --check "$f"; done`

Expected: every file parses successfully.

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 2: Re-read all 18 acceptance criteria and map each to evidence**

Automated evidence must cover pure-plugin install shape, tab hook, seven native bits, inherited consent, per-device config, default/override/disabled rules, one Desktop toast, protocol gates, actual toast command, Unicode, permissions, offline handling, fail-open behavior, persistence calls, documentation, and no core patch.

- [x] **Step 3: Record the honest live verification boundary**

Do not claim endpoint delivery, Windows/macOS/Linux appearance, restart persistence in the deployed cluster, or coexistence in production unless those live tests were actually run. Report them as remaining deployment acceptance checks while distinguishing them from locally verified implementation.

- [ ] **Step 4: Review the complete diff and finish the branch workflow**

Run: `git status --short`, `git diff --stat`, and `git diff -- . ':(exclude)*Design & Implementation Specification.md'`.

Then invoke `superpowers:finishing-a-development-branch`. If committing is selected, every commit message must be in Croatian.
