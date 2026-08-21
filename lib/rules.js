"use strict";

const { PROTOCOL_NAMES } = require("./config");

function resolveRule(config, operatorId, protocolClass) {
    if ((config == null) || (config.enabled !== true)) return null;
    if (!PROTOCOL_NAMES.includes(protocolClass)) return null;
    if ((config.protocols == null) || (config.protocols[protocolClass] !== true)) return null;

    const exact = (config.operatorRules != null) ? config.operatorRules[operatorId] : null;
    if ((exact != null) && (exact.state === "disabled")) return null;

    let rule;
    let source;
    if ((exact != null) && (exact.state === "enabled")) {
        rule = exact;
        source = "operator";
    } else {
        rule = config.defaultRule;
        source = "default";
    }

    if ((rule == null) || (rule.state !== "enabled")) return null;
    if ((rule.protocols == null) || (rule.protocols[protocolClass] !== true)) return null;
    return { rule, source };
}

module.exports = { resolveRule };
