"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { classifyRelayEvent, createSessionTracker } = require("../lib/sessions");

function relay(msgid, protocol, overrides = {}) {
    return {
        etype: "relay",
        action: "relaylog",
        msgid,
        protocol,
        nodeid: "node//pc1",
        userid: "user//igor",
        username: "igor",
        msgArgs: ["relay-1"],
        ...overrides
    };
}

const PHASE_CASES = [
    [14, 1, "start", "terminal"],
    [15, 2, "start", "desktop"],
    [16, 5, "start", "files"],
    [10, 9, "end", "terminal"],
    [11, 2, "end", "desktop"],
    [12, 5, "end", "files"]
];

for (const [msgid, protocol, phase, protocolClass] of PHASE_CASES) {
    test(`relay message ${msgid} classifies as ${phase} ${protocolClass}`, () => {
        const result = classifyRelayEvent(relay(msgid, protocol));
        assert.equal(result.phase, phase);
        assert.equal(result.protocolClass, protocolClass);
        assert.equal(result.sessionId, "relay-1");
        assert.equal(result.key, "node//pc1\u0000user//igor\u0000relay-1");
    });
}

test("unsupported, malformed, and mismatched relay events are ignored", () => {
    assert.equal(classifyRelayEvent(relay(13, 2)), null);
    assert.equal(classifyRelayEvent(relay(15, 200)), null);
    assert.equal(classifyRelayEvent(relay(15, 1)), null);
    assert.equal(classifyRelayEvent({ action: "other" }), null);
    assert.equal(classifyRelayEvent(relay(15, 2, { nodeid: null })), null);
    assert.equal(classifyRelayEvent(relay(15, 2, { userid: null })), null);
});

test("session ID falls back conservatively when relay ID is absent", () => {
    const result = classifyRelayEvent(relay(15, 2, { msgArgs: [] }));
    assert.equal(result.sessionId, "desktop");
    assert.equal(result.key, "node//pc1\u0000user//igor\u0000desktop");
});

test("tracker accepts one start and one end, suppressing duplicates", () => {
    let now = 1_000;
    const tracker = createSessionTracker({ now: () => now });
    const start = classifyRelayEvent(relay(15, 2));
    const end = classifyRelayEvent(relay(11, 2));
    assert.equal(tracker.accept(start), true);
    assert.equal(tracker.accept(start), false);
    assert.equal(tracker.accept(end), true);
    assert.equal(tracker.accept(end), false);
});

test("different operator and session IDs remain independent", () => {
    const tracker = createSessionTracker({ now: () => 1_000 });
    assert.equal(tracker.accept(classifyRelayEvent(relay(15, 2))), true);
    assert.equal(tracker.accept(classifyRelayEvent(relay(15, 2, { userid: "user//alen" }))), true);
    assert.equal(tracker.accept(classifyRelayEvent(relay(15, 2, { msgArgs: ["relay-2"] }))), true);
});

test("ended entries expire five minutes after disconnect", () => {
    let now = 1_000;
    const tracker = createSessionTracker({ now: () => now, disconnectedTtlMs: 300_000 });
    const start = classifyRelayEvent(relay(15, 2));
    const end = classifyRelayEvent(relay(11, 2));
    tracker.accept(start);
    tracker.accept(end);
    now += 299_999;
    assert.equal(tracker.accept(start), false);
    now += 2;
    assert.equal(tracker.accept(start), true);
});

test("removeNode clears only sessions for the deleted node", () => {
    const tracker = createSessionTracker({ now: () => 1_000 });
    const first = classifyRelayEvent(relay(15, 2));
    const second = classifyRelayEvent(relay(15, 2, { nodeid: "node//pc2" }));
    tracker.accept(first);
    tracker.accept(second);
    assert.equal(tracker.removeNode("node//pc1"), 1);
    assert.equal(tracker.accept(first), true);
    assert.equal(tracker.accept(second), false);
});
