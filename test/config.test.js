"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDefaultConfig, sanitizeNodeConfig, validateNodeConfig } = require("../lib/config");

function context() {
    return {
        nodeId: "node//pc1",
        domain: "",
        operatorIds: new Set(["user//igor", "user//alen"])
    };
}

test("default configuration matches specification", () => {
    assert.deepEqual(createDefaultConfig("node//pc1", ""), {
        type: "connectedtoast-node",
        domain: "",
        nodeId: "node//pc1",
        enabled: false,
        notifyOnConnect: true,
        notifyOnDisconnect: false,
        protocols: { desktop: true, terminal: false, files: false },
        defaultRule: {
            state: "enabled",
            protocols: { desktop: true, terminal: false, files: false },
            title: "MeshCentral",
            connectMessage: "{operator} connected to {device}.",
            disconnectMessage: "{operator} disconnected from {device}."
        },
        operatorRules: {}
    });
});

test("sanitizer constructs a fresh object and strips unexpected fields", () => {
    const input = createDefaultConfig("node/other/evil", "other");
    input.enabled = true;
    input.unexpected = { executable: true };
    input.protocols.extra = true;
    input.defaultRule.unexpected = "x";
    const result = sanitizeNodeConfig(input, context());
    assert.equal(result.nodeId, "node//pc1");
    assert.equal(result.domain, "");
    assert.equal(result.enabled, true);
    assert.equal(Object.hasOwn(result, "unexpected"), false);
    assert.equal(Object.hasOwn(result.protocols, "extra"), false);
    assert.equal(Object.hasOwn(result.defaultRule, "unexpected"), false);
    assert.notEqual(result, input);
});

test("valid enabled, disabled, and inherit operator states are normalized", () => {
    const input = createDefaultConfig("node//pc1", "");
    input.operatorRules = {
        "user//igor": {
            state: "enabled",
            protocols: { desktop: true, terminal: true, files: true },
            title: "Onix IT",
            connectMessage: "👀 {realname} connected to {device} via {protocol}.",
            disconnectMessage: "{operator} disconnected at {time}."
        },
        "user//alen": { state: "inherit", title: "ignored" }
    };
    const result = sanitizeNodeConfig(input, context());
    assert.equal(result.operatorRules["user//igor"].title, "Onix IT");
    assert.deepEqual(result.operatorRules["user//alen"], { state: "inherit" });
});

test("invalid booleans, protocol objects, and rule states are rejected", () => {
    const cases = [
        (x) => { x.enabled = "true"; },
        (x) => { x.notifyOnConnect = 1; },
        (x) => { x.protocols.desktop = "yes"; },
        (x) => { x.defaultRule.state = "inherit"; },
        (x) => { x.operatorRules["user//igor"] = { state: "sometimes" }; }
    ];
    for (const mutate of cases) {
        const input = createDefaultConfig("node//pc1", "");
        mutate(input);
        assert.throws(() => sanitizeNodeConfig(input, context()), /Invalid/);
    }
});

test("operator IDs must be current same-domain server users", () => {
    const input = createDefaultConfig("node//pc1", "");
    input.operatorRules["user/other/evil"] = { state: "disabled" };
    assert.throws(() => sanitizeNodeConfig(input, context()), /Invalid operator ID/);

    input.operatorRules = { "user//missing": { state: "disabled" } };
    assert.throws(() => sanitizeNodeConfig(input, context()), /Invalid operator ID/);
});

test("template placeholders and configured limits are enforced on every enabled rule", () => {
    const input = createDefaultConfig("node//pc1", "");
    input.defaultRule.title = "x".repeat(129);
    assert.throws(() => sanitizeNodeConfig(input, context()), /title must be at most 128 characters/);
    input.defaultRule.title = "{unknown}";
    assert.throws(() => sanitizeNodeConfig(input, context()), /Unknown placeholder/);
    input.defaultRule.title = "ok";
    input.defaultRule.connectMessage = "x".repeat(1025);
    assert.throws(() => sanitizeNodeConfig(input, context()), /connectMessage must be at most 1024 characters/);
});

test("validateNodeConfig returns true only for a valid client configuration", () => {
    assert.equal(validateNodeConfig(createDefaultConfig("node//pc1", ""), context()), true);
    assert.equal(validateNodeConfig({ enabled: "yes" }, context()), false);
});
