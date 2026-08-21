"use strict";

const PROTOCOL_CLASSES = Object.freeze({
    desktop: Object.freeze([2]),
    terminal: Object.freeze([1, 6, 8, 9]),
    files: Object.freeze([5])
});

const PROTOCOL_LABELS = Object.freeze({
    desktop: "Desktop",
    terminal: "Terminal",
    files: "Files"
});

function classifyProtocol(value) {
    if ((typeof value === "string") && (/^\d+$/.test(value))) value = Number(value);
    if (!Number.isInteger(value)) return null;
    for (const [name, values] of Object.entries(PROTOCOL_CLASSES)) {
        if (values.includes(value)) return name;
    }
    return null;
}

function protocolLabel(value) {
    const protocolClass = classifyProtocol(value);
    return protocolClass == null ? null : PROTOCOL_LABELS[protocolClass];
}

module.exports = {
    PROTOCOL_CLASSES,
    PROTOCOL_LABELS,
    classifyProtocol,
    protocolLabel
};
