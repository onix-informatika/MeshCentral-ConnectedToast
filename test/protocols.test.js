"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { classifyProtocol, protocolLabel } = require("../lib/protocols");

for (const value of [1, 6, 8, 9, "1", "6", "8", "9"]) {
    test(`protocol ${value} is Terminal`, () => {
        assert.equal(classifyProtocol(value), "terminal");
        assert.equal(protocolLabel(value), "Terminal");
    });
}

test("protocol 2 is Desktop", () => {
    assert.equal(classifyProtocol(2), "desktop");
    assert.equal(protocolLabel(2), "Desktop");
});

test("protocol 5 is Files", () => {
    assert.equal(classifyProtocol(5), "files");
    assert.equal(protocolLabel(5), "Files");
});

for (const value of [0, 3, 4, 10, 14, 200, 201, undefined, null, "x", 2.5]) {
    test(`unsupported protocol ${String(value)} is ignored`, () => {
        assert.equal(classifyProtocol(value), null);
        assert.equal(protocolLabel(value), null);
    });
}
