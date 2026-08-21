"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDefaultConfig } = require("../lib/config");
const { createSessionTracker } = require("../lib/sessions");
const { createRelayHandler } = require("../lib/relay-handler");

function event(msgid = 15, overrides = {}) {
    return {
        etype: "relay",
        action: "relaylog",
        msgid,
        protocol: msgid === 16 || msgid === 12 ? 5 : (msgid === 14 || msgid === 10 ? 1 : 2),
        nodeid: "node//pc1",
        userid: "user//igor",
        username: "igor",
        msgArgs: ["relay-1"],
        ...overrides
    };
}

function fixture() {
    const config = createDefaultConfig("node//pc1", "");
    config.enabled = true;
    const sent = [];
    const logs = [];
    const dependencies = {
        store: { getNodeConfig: async () => config },
        getNode: async () => ({ _id: "node//pc1", name: "TEST-PC" }),
        getUser: (id) => ({ _id: id, name: id.split("/").pop(), realname: id === "user//igor" ? "Igor Benić" : "Alen" }),
        router: { sendToastToNode: async (...args) => { sent.push(args); return { ok: true, code: "sent-local" }; } },
        tracker: createSessionTracker({ now: () => Date.parse("2026-08-21T10:00:00.000Z") }),
        now: () => Date.parse("2026-08-21T10:00:00.000Z"),
        log: (...args) => logs.push(args)
    };
    return { config, sent, logs, handler: createRelayHandler(dependencies), dependencies };
}

test("Desktop start renders the default rule and sends exactly one toast", async () => {
    const { handler, sent } = fixture();
    assert.equal((await handler.handle(event())).code, "sent-local");
    assert.deepEqual(sent, [[
        "node//pc1",
        "MeshCentral",
        "igor connected to TEST-PC.",
        { id: "user//igor", name: "igor" }
    ]]);
    assert.equal((await handler.handle(event())).code, "duplicate");
    assert.equal(sent.length, 1);
});

test("exact operator override renders Unicode and all event context", async () => {
    const { handler, config, sent } = fixture();
    config.operatorRules["user//igor"] = {
        state: "enabled",
        protocols: { desktop: true, terminal: true, files: true },
        title: "Onix IT, {protocol}",
        connectMessage: "👀 {realname} on {device}, {nodeid}, {sessionid}, {time}",
        disconnectMessage: "bye"
    };
    await handler.handle(event());
    assert.equal(sent[0][1], "Onix IT, Desktop");
    assert.equal(sent[0][2], "👀 Igor Benić on TEST-PC, node//pc1, relay-1, 2026-08-21T10:00:00.000Z");
});

test("disabled operator, plugin, and protocols produce no toast", async () => {
    const first = fixture();
    first.config.operatorRules["user//igor"] = { state: "disabled" };
    assert.equal((await first.handler.handle(event())).code, "rule-disabled");
    assert.equal(first.sent.length, 0);

    const second = fixture();
    second.config.enabled = false;
    assert.equal((await second.handler.handle(event())).code, "disabled");

    const third = fixture();
    assert.equal((await third.handler.handle(event(14))).code, "rule-disabled");
});

test("disconnect sends only when enabled and suppresses duplicates", async () => {
    const disabled = fixture();
    assert.equal((await disabled.handler.handle(event(11))).code, "phase-disabled");

    const enabled = fixture();
    enabled.config.notifyOnDisconnect = true;
    assert.equal((await enabled.handler.handle(event(11))).code, "sent-local");
    assert.equal(enabled.sent[0][2], "igor disconnected from TEST-PC.");
    assert.equal((await enabled.handler.handle(event(11))).code, "duplicate");
});

test("different operator uses its own override", async () => {
    const { handler, config, sent } = fixture();
    config.operatorRules["user//alen"] = {
        state: "enabled",
        protocols: { desktop: true, terminal: false, files: false },
        title: "Alen",
        connectMessage: "{realname} connected.",
        disconnectMessage: ""
    };
    await handler.handle(event(15, { userid: "user//alen", username: "alen", msgArgs: ["relay-2"] }));
    assert.deepEqual(sent[0].slice(1, 3), ["Alen", "Alen connected."]);
});

test("missing config and unsupported event are cleanly ignored", async () => {
    const first = fixture();
    first.dependencies.store.getNodeConfig = async () => null;
    assert.equal((await first.handler.handle(event())).code, "not-configured");
    assert.equal((await first.handler.handle({ action: "relaylog", msgid: 13 })).code, "ignored");
});

test("store, node, template, and router failures never reject the event handler", async () => {
    const storeFailure = fixture();
    storeFailure.dependencies.store.getNodeConfig = async () => { throw new Error("DB down"); };
    assert.equal((await storeFailure.handler.handle(event())).code, "error");

    const nodeFailure = fixture();
    nodeFailure.dependencies.getNode = async () => { throw new Error("node read failed"); };
    assert.equal((await nodeFailure.handler.handle(event())).code, "error");

    const routerFailure = fixture();
    routerFailure.dependencies.router.sendToastToNode = async () => { throw new Error("route failed"); };
    assert.equal((await routerFailure.handler.handle(event())).code, "error");
});
