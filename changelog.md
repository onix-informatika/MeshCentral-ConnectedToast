# Changelog

## 0.1.1, 2026-08-21

- Moved Save settings, Send test toast, Reset Connected Toast, and status feedback to a sticky action bar at the top of the device tab.
- Added an explicit reminder that edits remain local until Save settings is pressed.
- Added a browser regression test that keeps the primary save action ahead of the long settings sections.

## 0.1.0, 2026-08-21

- Added the per-device Connected Toast plugin tab.
- Added editing and effective-source preview for all seven native MeshCentral consent bits through the normal device-change pathway.
- Added read-only normalized domain consent, notification, auto-accept, timeout, and privacy-bar defaults.
- Added per-device custom connect and disconnect toasts for Desktop, Terminal, and Files sessions.
- Added default, inherited, enabled, and disabled per-operator rules with safe plain-text templates.
- Added online Test Toast, local and peer agent routing, relay deduplication, shared MeshCentral DB persistence, stale cleanup, authorization, audit events, and fail-open handling.
- Added automated tests for consent, protocols, templates, rules, persistence, sessions, routing, relay handling, server authorization, plugin lifecycle, and browser UI behavior.
