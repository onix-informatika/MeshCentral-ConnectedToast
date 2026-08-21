"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { ALLOWED_PLACEHOLDERS, validateTemplate, renderTemplate } = require("../lib/templates");

test("all documented placeholders render literally from context", () => {
    const template = "{operator}|{realname}|{device}|{protocol}|{time}|{nodeid}|{sessionid}|{operator}";
    const result = renderTemplate(template, {
        operator: "igor",
        realname: "Igor Benić",
        device: "TEST-PC",
        protocol: "Desktop",
        time: "2026-08-21T10:00:00.000Z",
        nodeid: "node//abc",
        sessionid: "relay-1"
    });
    assert.equal(result, "igor|Igor Benić|TEST-PC|Desktop|2026-08-21T10:00:00.000Z|node//abc|relay-1|igor");
    assert.deepEqual([...ALLOWED_PLACEHOLDERS], ["operator", "realname", "device", "protocol", "time", "nodeid", "sessionid"]);
});

test("Unicode, emoji, and HTML-looking text stay plain string content", () => {
    const text = "👀 {operator} se spojio, <script>alert('x')</script>";
    assert.equal(validateTemplate(text, 1024, "message"), text);
    assert.equal(renderTemplate(text, { operator: "Igor" }), "👀 Igor se spojio, <script>alert('x')</script>");
});

test("unknown placeholders are rejected on validation", () => {
    assert.throws(
        () => validateTemplate("{operator} from {ip}", 1024, "message"),
        /Unknown placeholder: ip/
    );
});

test("title and message maximum lengths are enforced", () => {
    assert.equal(validateTemplate("a".repeat(128), 128, "title").length, 128);
    assert.throws(() => validateTemplate("a".repeat(129), 128, "title"), /title must be at most 128 characters/);
    assert.equal(validateTemplate("b".repeat(1024), 1024, "message").length, 1024);
    assert.throws(() => validateTemplate("b".repeat(1025), 1024, "message"), /message must be at most 1024 characters/);
});

test("non-string templates are rejected", () => {
    assert.throws(() => validateTemplate(null, 128, "title"), /title must be a string/);
});

test("template renderer does not evaluate JavaScript-like text", () => {
    globalThis.__connectedToastExecuted = false;
    const text = "${globalThis.__connectedToastExecuted = true} {operator}";
    assert.equal(renderTemplate(text, { operator: "Igor" }), "${globalThis.__connectedToastExecuted = true} Igor");
    assert.equal(globalThis.__connectedToastExecuted, false);
    delete globalThis.__connectedToastExecuted;
});

test("missing context values become empty plain text", () => {
    assert.equal(renderTemplate("{operator}:{device}", { operator: "Igor" }), "Igor:");
});
