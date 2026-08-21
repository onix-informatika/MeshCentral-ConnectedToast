"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createDefaultConfig } = require("../lib/config");
const { resolveRule } = require("../lib/rules");

function enabledRule(overrides = {}) {
    return {
        state: "enabled",
        protocols: { desktop: true, terminal: false, files: false },
        title: "MeshCentral",
        connectMessage: "connected",
        disconnectMessage: "disconnected",
        ...overrides
    };
}

function config() {
    const value = createDefaultConfig("node//pc1", "");
    value.enabled = true;
    return value;
}

test("exact enabled operator rule wins over the default", () => {
    const value = config();
    value.operatorRules["user//igor"] = enabledRule({ title: "Onix IT" });
    const result = resolveRule(value, "user//igor", "desktop");
    assert.equal(result.source, "operator");
    assert.equal(result.rule.title, "Onix IT");
});

test("exact disabled operator wins over enabled default", () => {
    const value = config();
    value.operatorRules["user//service"] = { state: "disabled" };
    assert.equal(resolveRule(value, "user//service", "desktop"), null);
});

test("inherit operator uses the default rule", () => {
    const value = config();
    value.operatorRules["user//alen"] = { state: "inherit" };
    const result = resolveRule(value, "user//alen", "desktop");
    assert.equal(result.source, "default");
    assert.equal(result.rule, value.defaultRule);
});

test("missing operator override uses the default rule", () => {
    const value = config();
    assert.equal(resolveRule(value, "user//alen", "desktop").source, "default");
});

test("disabled plugin produces no rule", () => {
    const value = config();
    value.enabled = false;
    assert.equal(resolveRule(value, "user//igor", "desktop"), null);
});

test("disabled global protocol produces no rule", () => {
    const value = config();
    value.protocols.terminal = false;
    value.defaultRule.protocols.terminal = true;
    assert.equal(resolveRule(value, "user//igor", "terminal"), null);
});

test("disabled resolved-rule protocol produces no rule", () => {
    const value = config();
    value.protocols.terminal = true;
    value.defaultRule.protocols.terminal = false;
    assert.equal(resolveRule(value, "user//igor", "terminal"), null);
});

test("disabled default and unsupported protocol produce no rule", () => {
    const value = config();
    value.defaultRule.state = "disabled";
    assert.equal(resolveRule(value, "user//igor", "desktop"), null);
    value.defaultRule.state = "enabled";
    assert.equal(resolveRule(value, "user//igor", "messenger"), null);
});
