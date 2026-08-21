"use strict";

const ALLOWED_PLACEHOLDERS = Object.freeze([
    "operator",
    "realname",
    "device",
    "protocol",
    "time",
    "nodeid",
    "sessionid"
]);

const ALLOWED_SET = new Set(ALLOWED_PLACEHOLDERS);
const TOKEN_PATTERN = /\{([^{}]+)\}/g;
const RENDER_PATTERN = /\{(operator|realname|device|protocol|time|nodeid|sessionid)\}/g;

function validateTemplate(text, maxLength, fieldName) {
    if (typeof text !== "string") throw new TypeError(`${fieldName} must be a string`);
    if (!Number.isInteger(maxLength) || maxLength < 0) throw new TypeError("Invalid template length limit");
    if (text.length > maxLength) throw new RangeError(`${fieldName} must be at most ${maxLength} characters`);

    let match;
    TOKEN_PATTERN.lastIndex = 0;
    while ((match = TOKEN_PATTERN.exec(text)) != null) {
        if (!ALLOWED_SET.has(match[1])) throw new Error(`Unknown placeholder: ${match[1]}`);
    }
    return text;
}

function renderTemplate(text, context) {
    if (typeof text !== "string") throw new TypeError("Template must be a string");
    const values = (context != null) && (typeof context === "object") ? context : {};
    return text.replace(RENDER_PATTERN, (_, name) => String(values[name] == null ? "" : values[name]));
}

module.exports = {
    ALLOWED_PLACEHOLDERS,
    validateTemplate,
    renderTemplate
};
