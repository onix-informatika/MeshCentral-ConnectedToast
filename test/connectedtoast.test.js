"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createPlugin } = require("../connectedtoast");

function fixture() {
    const dispatches = [];
    const logs = [];
    const meshServer = {
        db: {
            Get(id, callback) { callback(null, id === "node//existing" ? [{ _id: id }] : []); }
        },
        webserver: { users: {}, wsagents: {} },
        AddEventDispatch(ids, target) { dispatches.push({ ids, target }); },
        debug(...args) { logs.push(args); }
    };
    const deleted = [];
    const relayEvents = [];
    const serverActions = [];
    const removedSessions = [];
    const cleaned = [];
    const store = {
        async cleanupStaleConfigs(nodeExists) {
            cleaned.push(await nodeExists("node//existing"));
            cleaned.push(await nodeExists("node//missing"));
            return ["node//missing"];
        },
        async deleteNodeConfig(nodeId) { deleted.push(nodeId); }
    };
    const relayHandler = { async handle(event) { relayEvents.push(event); return { ok: true }; } };
    const tracker = { removeNode(nodeId) { removedSessions.push(nodeId); } };
    const serverApi = { async handle(command, session) { serverActions.push({ command, session }); } };
    const parent = { parent: meshServer };
    const plugin = createPlugin(parent, { store, relayHandler, tracker, serverApi });
    return { plugin, meshServer, dispatches, logs, store, relayHandler, tracker, serverApi, deleted, relayEvents, serverActions, removedSessions, cleaned };
}

test("startup subscribes globally and performs fail-open stale cleanup", async () => {
    const f = fixture();
    f.plugin.server_startup();
    await f.plugin.startupPromise;
    assert.deepEqual(f.dispatches[0].ids, ["*"]);
    assert.equal(f.dispatches[0].target, f.plugin);
    assert.deepEqual(f.cleaned, [true, false]);
});

test("only local relay events are processed, peer-bus copies are ignored", async () => {
    const f = fixture();
    const relay = { action: "relaylog", msgid: 15 };
    f.plugin.HandleEvent(null, relay);
    f.plugin.HandleEvent({}, relay);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.relayEvents, [relay]);
});

test("node deletion removes only its plugin config and transient sessions", async () => {
    const f = fixture();
    f.plugin.HandleEvent({}, { action: "removenode", nodeid: "node//pc1" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.deleted, ["node//pc1"]);
    assert.deepEqual(f.removedSessions, ["node//pc1"]);
});

test("peer node deletion clears local transient sessions without repeating shared DB deletion", async () => {
    const f = fixture();
    f.plugin.HandleEvent(null, { action: "removenode", nodeid: "node//pc1" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.removedSessions, ["node//pc1"]);
    assert.deepEqual(f.deleted, []);
});

test("server actions delegate with the authenticated MeshUser session", async () => {
    const f = fixture();
    const command = { pluginaction: "getNodeConfig" };
    const session = { user: { _id: "user//admin" } };
    f.plugin.serveraction(command, session);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.serverActions, [{ command, session }]);
});

test("startup, event, and action failures are logged and never thrown", async () => {
    const f = fixture();
    f.store.cleanupStaleConfigs = async () => { throw new Error("cleanup failed"); };
    f.relayHandler.handle = async () => { throw new Error("relay failed"); };
    f.store.deleteNodeConfig = async () => { throw new Error("delete failed"); };
    f.serverApi.handle = async () => { throw new Error("action failed"); };

    assert.doesNotThrow(() => f.plugin.server_startup());
    await f.plugin.startupPromise;
    assert.doesNotThrow(() => f.plugin.HandleEvent({}, { action: "relaylog" }));
    assert.doesNotThrow(() => f.plugin.HandleEvent({}, { action: "removenode", nodeid: "node//pc1" }));
    assert.doesNotThrow(() => f.plugin.serveraction({}, {}));
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(f.logs.length >= 4);
});

test("all frontend exports can be serialized independently by MeshCentral", () => {
    const f = fixture();
    assert.ok(f.plugin.exports.includes("onDeviceRefreshEnd"));
    assert.ok(f.plugin.exports.includes("connectedToastError"));
    for (const name of f.plugin.exports) {
        assert.equal(typeof f.plugin[name], "function");
        assert.doesNotThrow(() => Function(`return (${f.plugin[name].toString()})`)());
    }
});
