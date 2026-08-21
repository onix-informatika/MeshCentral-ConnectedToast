"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDefaultConfig } = require("../lib/config");
const { createBrowserApi } = require("../lib/browser-ui");

class FakeElement {
    constructor(tagName, document) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = document;
        this.children = [];
        this.dataset = {};
        this.style = {};
        this.className = "";
        this.value = "";
        this.checked = false;
        this.disabled = false;
        this.textContent = "";
        this._innerHTML = "";
        this.listeners = {};
    }
    set id(value) {
        this._id = value;
        this.ownerDocument.elements.set(value, this);
    }
    get id() { return this._id; }
    set innerHTML(value) {
        this._innerHTML = value;
        this.children = [];
        if (this.id === "connectedtoast-panel") this.ownerDocument.loadMarkup(value);
    }
    get innerHTML() { return this._innerHTML; }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    replaceChildren(...children) { this.children = []; for (const child of children) this.appendChild(child); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    querySelectorAll(selector) {
        if (selector === "[data-ct-edit]") return [...this.ownerDocument.elements.values()].filter((x) => x.dataset.ctEdit === "1");
        return [];
    }
}

class FakeDocument {
    constructor() { this.elements = new Map(); this.strict = false; }
    createElement(tagName) { return new FakeElement(tagName, this); }
    getElementById(id) {
        if (!this.elements.has(id)) {
            if (this.strict) return null;
            const element = this.createElement(id.includes("select") ? "select" : "div");
            element.id = id;
        }
        return this.elements.get(id);
    }
    loadMarkup(markup) {
        const pattern = /<([a-z0-9]+)([^>]*\sid="([^"]+)"[^>]*)>/gi;
        let match;
        while ((match = pattern.exec(markup)) != null) {
            if (this.elements.has(match[3])) continue;
            const element = this.createElement(match[1]);
            element.id = match[3];
            const type = /\stype="([^"]+)"/i.exec(match[2]);
            if (type) element.type = type[1];
            if (/\sdata-ct-edit="1"/i.test(match[2])) element.dataset.ctEdit = "1";
        }
        this.strict = true;
    }
}

function fixture() {
    const document = new FakeDocument();
    const sent = [];
    const registrations = [];
    globalThis.document = document;
    globalThis.currentNode = { _id: "node//pc1", name: "TEST-PC", consent: 64, conn: 1 };
    globalThis.meshes = { "mesh//m1": { _id: "mesh//m1", name: "Onix Accounting" } };
    globalThis.meshserver = { send(message) { sent.push(structuredClone(message)); } };
    globalThis.window = { confirm: () => true };
    globalThis.pluginHandler = {
        connectedtoast: createBrowserApi(),
        registerPluginTab(info) {
            registrations.push(info);
            if (!document.elements.has(info.tabId)) {
                const host = document.createElement("div");
                host.id = info.tabId;
            }
        }
    };
    return { api: globalThis.pluginHandler.connectedtoast, document, sent, registrations };
}

function responseData(overrides = {}) {
    return {
        node: { id: "node//pc1", name: "TEST-PC" },
        mesh: { id: "mesh//m1", name: "Onix Accounting" },
        config: createDefaultConfig("node//pc1", ""),
        native: { domainConsent: 1, meshConsent: 8, nodeConsent: 64, effectiveConsent: 73 },
        domainDefaults: {
            desktopPrivacyBarText: "Support connected",
            consentMessages: { title: "Consent" },
            notificationMessages: { title: "Notice" }
        },
        operators: [],
        online: true,
        canEdit: true,
        ...overrides
    };
}

test.afterEach(() => {
    delete globalThis.document;
    delete globalThis.currentNode;
    delete globalThis.meshes;
    delete globalThis.meshserver;
    delete globalThis.window;
    delete globalThis.pluginHandler;
});

test("device refresh registers one normal plugin tab and requests authoritative data", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.onDeviceRefreshEnd("node//pc1");
    assert.equal(f.document.elements.has("connectedtoast-panel"), true);
    assert.equal(f.registrations.length, 2);
    assert.deepEqual(f.sent, [
        { action: "plugin", plugin: "connectedtoast", pluginaction: "getNodeConfig", nodeid: "node//pc1" },
        { action: "plugin", plugin: "connectedtoast", pluginaction: "getOperators", nodeid: "node//pc1" },
        { action: "plugin", plugin: "connectedtoast", pluginaction: "getNodeConfig", nodeid: "node//pc1" },
        { action: "plugin", plugin: "connectedtoast", pluginaction: "getOperators", nodeid: "node//pc1" }
    ]);
    assert.equal(f.document.getElementById("connectedtoast-panel").innerHTML.includes("Native MeshCentral visibility &amp; consent"), true);
});

test("primary save action is rendered before the long settings sections", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    const markup = f.document.getElementById("connectedtoast-panel").innerHTML;
    const savePosition = markup.indexOf('id="ct-save"');
    const nativeSettingsPosition = markup.indexOf('id="ct-native-rows"');
    assert.notEqual(savePosition, -1);
    assert.notEqual(nativeSettingsPosition, -1);
    assert.equal(savePosition < nativeSettingsPosition, true);
});

test("device settings panel provides its own vertical scroll region", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    const page = f.document.getElementById("ct-page");
    assert.notEqual(page, null);
    assert.equal(page.style.overflowY, "auto");
    assert.equal(page.style.maxHeight, "calc(100vh - 150px)");
});

test("operator options use textContent for hostile display names", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [{
        id: "user//igor",
        name: "<img onerror=alert(1)>",
        realname: "<script>alert(1)</script>",
        consent: 2,
        effectiveConsent: 75
    }] } });
    const select = f.document.getElementById("ct-operator-select");
    assert.equal(select.children[1].textContent, "<script>alert(1)</script> (<img onerror=alert(1)>) [user//igor]");
    assert.equal(select.children[1].innerHTML, "");
});

test("preview renders dynamic title and message only through textContent", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    const data = responseData();
    data.config.defaultRule.title = "<img onerror=alert(1)> {protocol}";
    data.config.defaultRule.connectMessage = "<script>alert(1)</script> {operator} {device}";
    f.api.setNodeConfig(null, { data });
    f.api.renderPreview();
    const title = f.document.getElementById("ct-preview-title");
    const message = f.document.getElementById("ct-preview-message");
    assert.equal(title.textContent, "<img onerror=alert(1)> Desktop");
    assert.equal(message.textContent, "<script>alert(1)</script> Igor TEST-PC");
    assert.equal(title.innerHTML, "");
    assert.equal(message.innerHTML, "");
});

test("save persists plugin config before using native changedevice pathway", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [] } });
    f.sent.length = 0;
    f.document.getElementById("ct-enabled").checked = true;
    f.document.getElementById("ct-consent-1").checked = true;
    f.document.getElementById("ct-consent-8").checked = true;
    f.document.getElementById("ct-consent-64").checked = true;
    f.api.save();
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].pluginaction, "saveNodeConfig");
    assert.equal(f.sent[0].config.enabled, true);
    assert.equal(Object.hasOwn(f.sent[0].config, "unexpected"), false);
    f.api.saveResult(null, { data: { ok: true, nodeid: "node//pc1", config: f.sent[0].config } });
    assert.deepEqual(f.sent[1], { action: "changedevice", nodeid: "node//pc1", consent: 73 });
});

test("save waits for the authoritative operator list and removes stale operator rules", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    const data = responseData();
    data.config.operatorRules["user//deleted"] = { state: "disabled" };
    f.api.setNodeConfig(null, { data });
    assert.equal(f.document.getElementById("ct-save").disabled, true);
    f.sent.length = 0;
    f.api.save();
    assert.equal(f.sent.length, 0);
    assert.equal(f.document.getElementById("ct-status").textContent, "Operator list is still loading");

    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [{
        id: "user//igor", name: "igor", realname: "Igor", consent: 0, effectiveConsent: 73
    }] } });
    assert.equal(f.document.getElementById("ct-save").disabled, false);
    f.api.save();
    assert.deepEqual(f.sent[0].config.operatorRules, {});
});

test("reset never clears native consent", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    f.sent.length = 0;
    f.api.reset();
    assert.deepEqual(f.sent, [{ action: "plugin", plugin: "connectedtoast", pluginaction: "resetNodeConfig", nodeid: "node//pc1" }]);
});

test("offline test toast is blocked locally and reports a useful status", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData({ online: false }) });
    f.sent.length = 0;
    f.api.sendTestToast();
    assert.equal(f.sent.length, 0);
    assert.equal(f.document.getElementById("ct-status").textContent, "Device is offline");
});

test("test toast sends the current rule template for one authoritative server render", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    const data = responseData();
    data.config.defaultRule.title = "Onix {protocol}";
    data.config.defaultRule.connectMessage = "{operator} connected to {device}.";
    f.api.setNodeConfig(null, { data });
    f.sent.length = 0;
    f.api.sendTestToast();
    assert.equal(f.sent[0].title, "Onix {protocol}");
    assert.equal(f.sent[0].message, "{operator} connected to {device}.");
    assert.equal(f.sent[0].protocol, "Desktop");
});

test("server callback methods expose save, toast, and error results", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    f.api.testToastResult(null, { data: { ok: true, nodeid: "node//pc1", message: "Toast sent" } });
    assert.equal(f.document.getElementById("ct-status").textContent, "Toast sent");
    f.api.connectedToastError(null, { data: { message: "Permission denied" } });
    assert.equal(f.document.getElementById("ct-status").textContent, "Permission denied");
});

test("native rows distinguish device, inherited, and effective state", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    const rows = f.document.getElementById("ct-native-rows").children;
    assert.deepEqual(rows[0].children.map((cell) => cell.textContent), ["Setting", "Device", "Inherited", "Effective"]);
    const desktopNotify = rows.find((row) => row.dataset.bit === "1");
    const desktopPrompt = rows.find((row) => row.dataset.bit === "8");
    const privacy = rows.find((row) => row.dataset.bit === "64");
    assert.equal(desktopNotify.children[0].children[0].type, "checkbox");
    assert.equal(desktopNotify.children[2].textContent, "Domain");
    assert.equal(desktopNotify.children[3].textContent, "ON");
    assert.equal(desktopPrompt.children[2].textContent, 'Device Group "Onix Accounting"');
    assert.equal(privacy.children[1].textContent, "ON");
    assert.equal(privacy.children[3].textContent, "ON");
});

test("operator preview adds connecting user consent and updates transparency summary", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    const data = responseData();
    data.config.enabled = true;
    f.api.setNodeConfig(null, { data });
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [{
        id: "user//igor", name: "igor", realname: "Igor Benić", consent: 2, effectiveConsent: 75
    }] } });
    f.document.getElementById("ct-operator-select").value = "user//igor";
    f.api.selectOperator();

    const terminalNotify = f.document.getElementById("ct-native-rows").children.find((row) => row.dataset.bit === "2");
    assert.equal(terminalNotify.children[2].textContent, 'MeshCentral user "Igor Benić"');
    assert.equal(terminalNotify.children[3].textContent, "ON");
    assert.equal(f.document.getElementById("ct-summary").textContent.includes("Connection toast: ON"), true);
});

test("transparency summary follows unsaved custom-toast edits", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    assert.equal(f.document.getElementById("ct-summary").textContent.includes("Connection toast: OFF"), true);
    f.document.getElementById("ct-enabled").checked = true;
    f.api.renderPreview();
    assert.equal(f.document.getElementById("ct-summary").textContent.includes("Connection toast: ON"), true);
});

test("native effective preview follows unsaved device checkbox edits", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    const privacy = f.document.getElementById("ct-native-rows").children.find((row) => row.dataset.bit === "64");
    assert.equal(privacy.children[3].textContent, "ON");
    f.document.getElementById("ct-consent-64").checked = false;
    f.api.renderNativePreview();
    assert.equal(privacy.children[1].textContent, "OFF");
    assert.equal(privacy.children[3].textContent, "OFF");
    assert.equal(f.document.getElementById("ct-summary").textContent.includes("Privacy bar: OFF"), true);
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [{
        id: "user//igor", name: "igor", realname: "Igor", consent: 0, effectiveConsent: 73
    }] } });
    f.document.getElementById("ct-operator-select").value = "user//igor";
    f.api.selectOperator();
    assert.equal(f.document.getElementById("ct-consent-64").checked, false);
});

test("switching operators keeps the draft override before saving", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData() });
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [
        { id: "user//igor", name: "igor", realname: "Igor", consent: 0, effectiveConsent: 73 },
        { id: "user//alen", name: "alen", realname: "Alen", consent: 0, effectiveConsent: 73 }
    ] } });
    const select = f.document.getElementById("ct-operator-select");
    select.value = "user//igor";
    f.api.selectOperator();
    f.document.getElementById("ct-operator-state").value = "enabled";
    f.document.getElementById("ct-operator-desktop").checked = true;
    f.document.getElementById("ct-operator-title").value = "Onix IT";
    f.document.getElementById("ct-operator-connect").value = "Igor connected";
    f.document.getElementById("ct-operator-disconnect").value = "Igor disconnected";
    select.value = "user//alen";
    f.api.selectOperator();

    assert.equal(f.api.state.data.config.operatorRules["user//igor"].title, "Onix IT");
    assert.equal(f.api.state.data.config.operatorRules["user//igor"].protocols.desktop, true);
});

test("stale responses from a previously viewed device are ignored", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc2");
    const stale = responseData();
    f.api.setNodeConfig(null, { data: stale });
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [{ id: "user//igor", name: "igor", realname: "Igor" }] } });
    assert.equal(f.api.state.data, null);
    assert.deepEqual(f.api.state.operators, []);
    assert.equal(f.api.state.nodeId, "node//pc2");
    f.api.saveResult(null, { data: { ok: true, nodeid: "node//pc1", config: createDefaultConfig("node//pc1", "") } });
    f.api.testToastResult(null, { data: { ok: true, nodeid: "node//pc1", message: "Wrong device" } });
    f.api.connectedToastError(null, { data: { nodeid: "node//pc1", message: "Wrong device error" } });
    assert.equal(f.api.state.data, null);
    assert.notEqual(f.document.getElementById("ct-status").textContent, "Wrong device");
    assert.notEqual(f.document.getElementById("ct-status").textContent, "Wrong device error");
});

test("read-only users can preview operators but cannot edit or send", () => {
    const f = fixture();
    f.api.onDeviceRefreshEnd("node//pc1");
    f.api.setNodeConfig(null, { data: responseData({ canEdit: false }) });
    f.api.setOperators(null, { data: { nodeid: "node//pc1", operators: [{
        id: "user//igor", name: "igor", realname: "Igor", consent: 2, effectiveConsent: 75
    }] } });
    assert.equal(f.document.getElementById("ct-operator-select").disabled, false);
    assert.equal(f.document.getElementById("ct-operator-state").disabled, true);
    assert.equal(f.document.getElementById("ct-consent-1").disabled, true);
    assert.equal(f.document.getElementById("ct-save").disabled, true);
    assert.equal(f.document.getElementById("ct-test").disabled, true);
    assert.equal(f.document.getElementById("ct-reset").disabled, true);
});
