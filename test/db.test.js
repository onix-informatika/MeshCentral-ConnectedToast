"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { CreateStore, nodeConfigId } = require("../db");

function createCoreDb(initial = []) {
    const records = new Map(initial.map((item) => [item._id, structuredClone(item)]));
    const calls = [];
    const failures = {};
    return {
        records,
        calls,
        failures,
        Get(id, callback) {
            calls.push(["Get", id]);
            callback(failures.Get || null, records.has(id) ? [structuredClone(records.get(id))] : []);
        },
        Set(record, callback) {
            calls.push(["Set", structuredClone(record)]);
            if (!failures.Set) records.set(record._id, structuredClone(record));
            if (callback) callback(failures.Set || null);
        },
        Remove(id, callback) {
            calls.push(["Remove", id]);
            if (!failures.Remove) records.delete(id);
            if (callback) callback(failures.Remove || null);
        },
        GetAllType(type, callback) {
            calls.push(["GetAllType", type]);
            const values = [...records.values()].filter((record) => record.type === type).map((record) => structuredClone(record));
            callback(failures.GetAllType || null, values);
        }
    };
}

function meshServer(db) {
    return { db };
}

test("node config ID is deterministic and domain-scoped", () => {
    assert.equal(nodeConfigId("node//abc"), "connectedtoast-node///abc");
    assert.equal(nodeConfigId("node/customer/abc"), "connectedtoast-node//customer/abc");
    assert.throws(() => nodeConfigId("invalid"), /Invalid node ID/);
});

test("save upserts exactly one ConnectedToast record per node", async () => {
    const db = createCoreDb();
    const store = CreateStore(meshServer(db));
    const config = { type: "connectedtoast-node", domain: "", nodeId: "node//abc", enabled: true };

    await store.saveNodeConfig(config);
    await store.saveNodeConfig({ ...config, enabled: false });

    assert.equal(db.records.size, 1);
    assert.deepEqual(await store.getNodeConfig("node//abc"), {
        _id: "connectedtoast-node///abc",
        type: "connectedtoast-node",
        domain: "",
        nodeId: "node//abc",
        enabled: false
    });
});

test("configuration is readable through a new store instance after restart", async () => {
    const db = createCoreDb();
    await CreateStore(meshServer(db)).saveNodeConfig({
        type: "connectedtoast-node", domain: "", nodeId: "node//abc", enabled: true
    });
    const restartedStore = CreateStore(meshServer(db));
    assert.equal((await restartedStore.getNodeConfig("node//abc")).enabled, true);
});

test("delete removes only the selected deterministic config", async () => {
    const db = createCoreDb([
        { _id: "connectedtoast-node///a", type: "connectedtoast-node", nodeId: "node//a" },
        { _id: "connectedtoast-node///b", type: "connectedtoast-node", nodeId: "node//b" },
        { _id: "unrelated", type: "other" }
    ]);
    const store = CreateStore(meshServer(db));
    await store.deleteNodeConfig("node//a");
    assert.equal(db.records.has("connectedtoast-node///a"), false);
    assert.equal(db.records.has("connectedtoast-node///b"), true);
    assert.equal(db.records.has("unrelated"), true);
});

test("list returns only ConnectedToast node records", async () => {
    const db = createCoreDb([
        { _id: "connectedtoast-node///a", type: "connectedtoast-node", nodeId: "node//a" },
        { _id: "unrelated", type: "other" }
    ]);
    const store = CreateStore(meshServer(db));
    assert.deepEqual((await store.listNodeConfigs()).map((x) => x.nodeId), ["node//a"]);
});

test("startup cleanup removes only configs for missing nodes", async () => {
    const db = createCoreDb([
        { _id: "connectedtoast-node///a", type: "connectedtoast-node", nodeId: "node//a" },
        { _id: "connectedtoast-node///b", type: "connectedtoast-node", nodeId: "node//b" },
        { _id: "unrelated", type: "other" }
    ]);
    const store = CreateStore(meshServer(db));
    const result = await store.cleanupStaleConfigs(async (nodeId) => nodeId === "node//a");
    assert.deepEqual(result, ["node//b"]);
    assert.equal(db.records.has("connectedtoast-node///a"), true);
    assert.equal(db.records.has("connectedtoast-node///b"), false);
    assert.equal(db.records.has("unrelated"), true);
});

test("core DB errors reject instead of being hidden", async () => {
    const db = createCoreDb();
    const store = CreateStore(meshServer(db));
    db.failures.Get = new Error("read failed");
    await assert.rejects(store.getNodeConfig("node//a"), /read failed/);
    db.failures.Get = null;
    db.failures.Set = new Error("write failed");
    await assert.rejects(store.saveNodeConfig({ nodeId: "node//a", domain: "", type: "connectedtoast-node" }), /write failed/);
    db.failures.Set = null;
    db.failures.Remove = new Error("delete failed");
    await assert.rejects(store.deleteNodeConfig("node//a"), /delete failed/);
});
