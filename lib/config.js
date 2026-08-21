"use strict";

const { validateTemplate } = require("./templates");

const PROTOCOL_NAMES = Object.freeze(["desktop", "terminal", "files"]);
const OPERATOR_RULE_STATES = new Set(["inherit", "enabled", "disabled"]);
const DEFAULT_RULE_STATES = new Set(["enabled", "disabled"]);

function defaultProtocols() {
    return { desktop: true, terminal: false, files: false };
}

function createDefaultRule() {
    return {
        state: "enabled",
        protocols: defaultProtocols(),
        title: "MeshCentral",
        connectMessage: "{operator} connected to {device}.",
        disconnectMessage: "{operator} disconnected from {device}."
    };
}

function createDefaultConfig(nodeId, domain) {
    return {
        type: "connectedtoast-node",
        domain,
        nodeId,
        enabled: false,
        notifyOnConnect: true,
        notifyOnDisconnect: false,
        protocols: defaultProtocols(),
        defaultRule: createDefaultRule(),
        operatorRules: {}
    };
}

function requireBoolean(value, fieldName) {
    if (typeof value !== "boolean") throw new TypeError(`Invalid boolean field: ${fieldName}`);
    return value;
}

function sanitizeProtocols(value, fieldName) {
    if ((value == null) || (typeof value !== "object") || Array.isArray(value)) {
        throw new TypeError(`Invalid protocols field: ${fieldName}`);
    }
    const result = {};
    for (const name of PROTOCOL_NAMES) {
        result[name] = requireBoolean(value[name], `${fieldName}.${name}`);
    }
    return result;
}

function sanitizeEnabledRule(value, fieldName, allowedStates) {
    if ((value == null) || (typeof value !== "object") || Array.isArray(value)) {
        throw new TypeError(`Invalid rule: ${fieldName}`);
    }
    if (!allowedStates.has(value.state)) throw new TypeError(`Invalid rule state: ${fieldName}.state`);
    if (value.state !== "enabled") return { state: value.state };

    return {
        state: "enabled",
        protocols: sanitizeProtocols(value.protocols, `${fieldName}.protocols`),
        title: validateTemplate(value.title, 128, "title"),
        connectMessage: validateTemplate(value.connectMessage, 1024, "connectMessage"),
        disconnectMessage: validateTemplate(value.disconnectMessage, 1024, "disconnectMessage")
    };
}

function validateContext(context) {
    if ((context == null) || (typeof context !== "object")) throw new TypeError("Invalid validation context");
    if (typeof context.nodeId !== "string" || !context.nodeId.startsWith(`node/${context.domain}/`)) {
        throw new TypeError("Invalid node context");
    }
    if (!(context.operatorIds instanceof Set)) throw new TypeError("Invalid operator set");
}

function sanitizeNodeConfig(input, context) {
    validateContext(context);
    if ((input == null) || (typeof input !== "object") || Array.isArray(input)) {
        throw new TypeError("Invalid ConnectedToast configuration");
    }

    const result = createDefaultConfig(context.nodeId, context.domain);
    result.enabled = requireBoolean(input.enabled, "enabled");
    result.notifyOnConnect = requireBoolean(input.notifyOnConnect, "notifyOnConnect");
    result.notifyOnDisconnect = requireBoolean(input.notifyOnDisconnect, "notifyOnDisconnect");
    result.protocols = sanitizeProtocols(input.protocols, "protocols");
    result.defaultRule = sanitizeEnabledRule(input.defaultRule, "defaultRule", DEFAULT_RULE_STATES);
    result.operatorRules = {};

    if ((input.operatorRules == null) || (typeof input.operatorRules !== "object") || Array.isArray(input.operatorRules)) {
        throw new TypeError("Invalid operatorRules field");
    }
    for (const [operatorId, rule] of Object.entries(input.operatorRules)) {
        if (!context.operatorIds.has(operatorId) || !operatorId.startsWith(`user/${context.domain}/`)) {
            throw new TypeError(`Invalid operator ID: ${operatorId}`);
        }
        result.operatorRules[operatorId] = sanitizeEnabledRule(rule, `operatorRules.${operatorId}`, OPERATOR_RULE_STATES);
    }
    return result;
}

function validateNodeConfig(input, context) {
    try {
        sanitizeNodeConfig(input, context);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = {
    PROTOCOL_NAMES,
    createDefaultConfig,
    sanitizeNodeConfig,
    validateNodeConfig
};
