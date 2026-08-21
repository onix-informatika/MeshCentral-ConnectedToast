"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDefaultConfig } = require("../lib/config");
const { createServerApi } = require("../lib/server-api");

const MANAGE = 0x00000004;
const REMOTE = 0x00000008;
const VIEW_ONLY = 0x00000100;

function fixture() {
    const records = new Map([
        ["node//pc1", { _id: "node//pc1", type: "node", domain: "", meshid: "mesh//m1", name: "TEST-PC", consent: 64 }],
        ["node/other/pc2", { _id: "node/other/pc2", type: "node", domain: "other", meshid: "mesh/other/m2", name: "OTHER-PC" }]
    ]);
    const rights = new Map([
        ["user//admin:node//pc1", MANAGE | REMOTE],
        ["user//viewer:node//pc1", REMOTE],
        ["user//igor:node//pc1", REMOTE],
        ["user//alen:node//pc1", VIEW_ONLY],
        ["user//unrelated:node//pc1", 0]
    ]);
    const users = {
        "user//admin": { _id: "user//admin", domain: "", name: "admin", realname: "Administrator", consent: 0 },
        "user//viewer": { _id: "user//viewer", domain: "", name: "viewer", realname: "Viewer", consent: 0 },
        "user//igor": { _id: "user//igor", domain: "", name: "igbenic", realname: "Igor Benić", consent: 2 },
        "user//alen": { _id: "user//alen", domain: "", name: "alen", realname: "Alen", consent: 0 },
        "user//unrelated": { _id: "user//unrelated", domain: "", name: "unrelated", realname: "Unrelated", consent: 0 },
        "user/other/evil": { _id: "user/other/evil", domain: "other", name: "evil", realname: "Evil", consent: 127 }
    };
    const meshes = {
        "mesh//m1": { _id: "mesh//m1", domain: "", name: "Onix Accounting", consent: 8 },
        "mesh/other/m2": { _id: "mesh/other/m2", domain: "other", name: "Other", consent: 0 }
    };
    const domain = {
        id: "",
        userconsentflags: 1,
        desktopprivacybartext: "Support is connected",
        consentmessages: {
            title: "Consent",
            desktop: "Allow desktop?",
            consenttimeout: 30,
            autoacceptontimeout: true,
            autoacceptifdesktoplocked: true,
            oldstyle: true,
            secret: "must not leak"
        },
        notificationmessages: { title: "Notice", desktop: "Desktop started", secret: "must not leak" }
    };
    const db = {
        Get(id, callback) { callback(null, records.has(id) ? [structuredClone(records.get(id))] : []); }
    };
    const dispatched = [];
    const meshServer = {
        db,
        webserver: {
            users,
            meshes,
            wsagents: { "node//pc1": {} },
            GetNodeRights(user, meshid, nodeid) { return rights.get(`${user._id}:${nodeid}`) || 0; },
            CreateNodeDispatchTargets(meshid, nodeid, extra) { return ["*", meshid, nodeid, ...(extra || [])]; },
            CloneSafeNode(node) { return structuredClone(node); }
        },
        DispatchEvent(targets, source, event) { dispatched.push({ targets, event }); },
        GetRoutingServerId() { return null; }
    };
    let stored = null;
    const store = {
        async getNodeConfig() { return stored; },
        async saveNodeConfig(value) { stored = structuredClone(value); return stored; },
        async deleteNodeConfig() { stored = null; }
    };
    const routed = [];
    const router = {
        result: { ok: true, code: "sent-local" },
        async sendToastToNode(...args) { routed.push(args); return this.result; }
    };
    const logs = [];
    const api = createServerApi({
        meshServer,
        store,
        router,
        now: () => Date.parse("2026-08-21T10:00:00.000Z"),
        log: (...args) => logs.push(args)
    });

    function session(userId = "user//admin", sessionDomain = domain) {
        const messages = [];
        return {
            user: users[userId],
            domain: sessionDomain,
            ws: { send(value) { messages.push(JSON.parse(value)); } },
            messages
        };
    }

    return { api, store, router, routed, logs, meshServer, users, meshes, records, rights, dispatched, domain, session, getStored: () => stored };
}

test("getNodeConfig returns normalized native, custom, domain, and permission state", async () => {
    const f = fixture();
    const session = f.session();
    await f.api.handle({ pluginaction: "getNodeConfig", nodeid: "node//pc1" }, session);
    const response = session.messages[0];
    assert.equal(response.method, "setNodeConfig");
    assert.equal(response.data.node.name, "TEST-PC");
    assert.equal(response.data.mesh.name, "Onix Accounting");
    assert.deepEqual(response.data.native, {
        domainConsent: 1,
        meshConsent: 8,
        nodeConsent: 64,
        effectiveConsent: 73
    });
    assert.equal(response.data.online, true);
    assert.equal(response.data.canEdit, true);
    assert.equal(response.data.config.enabled, false);
    assert.equal(response.data.domainDefaults.desktopPrivacyBarText, "Support is connected");
    assert.deepEqual(response.data.domainDefaults.consentMessages, {
        title: "Consent",
        desktop: "Allow desktop?",
        consentTimeout: 30,
        autoAcceptOnTimeout: true,
        autoAcceptIfDesktopLocked: true,
        oldStyle: true
    });
    assert.deepEqual(response.data.domainDefaults.notificationMessages, { title: "Notice", desktop: "Desktop started" });
    assert.equal(JSON.stringify(response).includes("must not leak"), false);
});

test("read access rejects missing, cross-domain, and invisible nodes", async () => {
    const f = fixture();
    for (const nodeid of ["node//missing", "node/other/pc2"]) {
        const session = f.session();
        await f.api.handle({ pluginaction: "getNodeConfig", nodeid }, session);
        assert.equal(session.messages[0].method, "connectedToastError");
    }
    const invisible = f.session("user//unrelated");
    await f.api.handle({ pluginaction: "getNodeConfig", nodeid: "node//pc1" }, invisible);
    assert.equal(invisible.messages[0].data.code, "permission-denied");
});

test("unauthenticated plugin request is rejected without trusting command identity", async () => {
    const f = fixture();
    const messages = [];
    const session = { user: null, domain: f.domain, ws: { send: (x) => messages.push(JSON.parse(x)) } };
    await f.api.handle({ pluginaction: "getNodeConfig", nodeid: "node//pc1", userid: "user//admin" }, session);
    assert.equal(messages[0].data.code, "unauthenticated");
});

test("getOperators returns same-domain minimal data and server-calculated effective consent", async () => {
    const f = fixture();
    const session = f.session();
    await f.api.handle({ pluginaction: "getOperators", nodeid: "node//pc1" }, session);
    const operators = session.messages[0].data.operators;
    assert.equal(session.messages[0].method, "setOperators");
    assert.equal(operators.some((x) => x.id === "user/other/evil"), false);
    assert.ok(operators.findIndex((x) => x.id === "user//alen") < operators.findIndex((x) => x.id === "user//unrelated"));
    assert.deepEqual(Object.keys(operators.find((x) => x.id === "user//igor")).sort(), ["consent", "effectiveConsent", "id", "name", "realname"]);
    assert.equal(operators.find((x) => x.id === "user//igor").effectiveConsent, 75);
});

test("save validates manage rights, operator IDs, and authoritative actor metadata", async () => {
    const f = fixture();
    const value = createDefaultConfig("node//pc1", "");
    value.enabled = true;
    value.operatorRules["user//igor"] = { state: "disabled" };

    const session = f.session();
    await f.api.handle({ pluginaction: "saveNodeConfig", nodeid: "node//pc1", config: value, userid: "user//evil" }, session);
    assert.equal(session.messages[0].method, "saveResult");
    assert.equal(f.getStored().updatedBy, "user//admin");
    assert.equal(f.getStored().updatedAt, Date.parse("2026-08-21T10:00:00.000Z"));

    const noManage = f.session("user//viewer");
    await f.api.handle({ pluginaction: "saveNodeConfig", nodeid: "node//pc1", config: value }, noManage);
    assert.equal(noManage.messages[0].data.code, "permission-denied");

    value.operatorRules = { "user//missing": { state: "disabled" } };
    const badOperator = f.session();
    await f.api.handle({ pluginaction: "saveNodeConfig", nodeid: "node//pc1", config: value }, badOperator);
    assert.equal(badOperator.messages[0].data.code, "validation-error");
});

test("save audit event omits custom message text", async () => {
    const f = fixture();
    const value = createDefaultConfig("node//pc1", "");
    value.defaultRule.connectMessage = "private custom text";
    await f.api.handle({ pluginaction: "saveNodeConfig", nodeid: "node//pc1", config: value }, f.session());
    assert.equal(f.dispatched.length, 1);
    assert.equal(f.dispatched[0].event.action, "connectedtoastconfig");
    assert.equal(JSON.stringify(f.dispatched[0]).includes("private custom text"), false);
});

test("reset deletes only plugin config and leaves native node consent untouched", async () => {
    const f = fixture();
    const value = createDefaultConfig("node//pc1", "");
    await f.store.saveNodeConfig(value);
    const session = f.session();
    await f.api.handle({ pluginaction: "resetNodeConfig", nodeid: "node//pc1" }, session);
    assert.equal(f.getStored(), null);
    assert.equal(f.records.get("node//pc1").consent, 64);
    assert.equal(session.messages[0].data.reset, true);
});

test("testToast validates manage rights, templates, operator, and routing result", async () => {
    const f = fixture();
    const session = f.session();
    await f.api.handle({
        pluginaction: "testToast",
        nodeid: "node//pc1",
        operatorid: "user//igor",
        protocol: "Desktop",
        title: "Test, {protocol}",
        message: "{realname} on {device} at {time}"
    }, session);
    assert.equal(session.messages[0].method, "testToastResult");
    assert.equal(session.messages[0].data.nodeid, "node//pc1");
    assert.equal(session.messages[0].data.code, "sent-local");
    assert.deepEqual(f.routed[0].slice(0, 3), [
        "node//pc1",
        "Test, Desktop",
        "Igor Benić on TEST-PC at 2026-08-21T10:00:00.000Z"
    ]);

    const noManage = f.session("user//viewer");
    await f.api.handle({ pluginaction: "testToast", nodeid: "node//pc1", title: "T", message: "M" }, noManage);
    assert.equal(noManage.messages[0].data.code, "permission-denied");
    assert.equal(noManage.messages[0].data.nodeid, "node//pc1");

    const invalid = f.session();
    await f.api.handle({ pluginaction: "testToast", nodeid: "node//pc1", title: "{ip}", message: "M" }, invalid);
    assert.equal(invalid.messages[0].data.code, "validation-error");

    f.router.result = { ok: false, code: "offline" };
    const offline = f.session();
    await f.api.handle({ pluginaction: "testToast", nodeid: "node//pc1", title: "T", message: "M" }, offline);
    assert.equal(offline.messages[0].data.message, "Device is offline");
});

test("unknown plugin actions return a bounded error", async () => {
    const f = fixture();
    const session = f.session();
    await f.api.handle({ pluginaction: "deleteEverything" }, session);
    assert.equal(session.messages[0].data.code, "unknown-action");
});
