"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CONSENT_BITS,
    decodeConsentBits,
    encodeConsentBits,
    effectiveConsent,
    consentSources
} = require("../lib/consent");

const CASES = [
    ["desktopNotify", 1],
    ["terminalNotify", 2],
    ["filesNotify", 4],
    ["desktopPrompt", 8],
    ["terminalPrompt", 16],
    ["filesPrompt", 32],
    ["desktopPrivacyBar", 64]
];

test("consent constants match MeshCentral native values", () => {
    assert.deepEqual(CONSENT_BITS, Object.fromEntries(CASES));
});

for (const [name, value] of CASES) {
    test(`encode and decode ${name}`, () => {
        assert.equal(encodeConsentBits({ [name]: true }), value);
        assert.equal(decodeConsentBits(value)[name], true);
        assert.equal(Object.values(decodeConsentBits(value)).filter(Boolean).length, 1);
    });
}

test("consent combinations, zero, and full mask are stable", () => {
    assert.equal(encodeConsentBits({ desktopNotify: true, desktopPrompt: true, desktopPrivacyBar: true }), 73);
    assert.deepEqual(decodeConsentBits(0), {
        desktopNotify: false,
        terminalNotify: false,
        filesNotify: false,
        desktopPrompt: false,
        terminalPrompt: false,
        filesPrompt: false,
        desktopPrivacyBar: false
    });
    assert.equal(encodeConsentBits(decodeConsentBits(127)), 127);
});

test("unknown consent bits are discarded", () => {
    assert.equal(encodeConsentBits(decodeConsentBits(255)), 127);
});

test("invalid consent values are rejected", () => {
    for (const value of [-1, 1.5, NaN, "1", null]) {
        assert.throws(() => decodeConsentBits(value), TypeError);
    }
});

test("effective consent ORs domain, mesh, node, and operator", () => {
    assert.equal(effectiveConsent({ domain: 1, mesh: 8, node: 64, operator: 2 }), 75);
});

test("consent sources identify every contributor independently", () => {
    const sources = consentSources({ domain: 1, mesh: 9, node: 64, operator: 3 });
    assert.deepEqual(sources.desktopNotify, ["domain", "mesh", "operator"]);
    assert.deepEqual(sources.terminalNotify, ["operator"]);
    assert.deepEqual(sources.desktopPrompt, ["mesh"]);
    assert.deepEqual(sources.desktopPrivacyBar, ["node"]);
    assert.deepEqual(sources.filesNotify, []);
});
