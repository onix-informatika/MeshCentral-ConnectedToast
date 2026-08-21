"use strict";

const CONSENT_BITS = Object.freeze({
    desktopNotify: 1,
    terminalNotify: 2,
    filesNotify: 4,
    desktopPrompt: 8,
    terminalPrompt: 16,
    filesPrompt: 32,
    desktopPrivacyBar: 64
});

const CONSENT_MASK = 0x7F;
const SOURCE_ORDER = Object.freeze(["domain", "mesh", "node", "operator"]);

function normalizeConsent(value) {
    if (!Number.isInteger(value) || value < 0) {
        throw new TypeError("Consent must be a non-negative integer");
    }
    return value & CONSENT_MASK;
}

function decodeConsentBits(value) {
    const normalized = normalizeConsent(value);
    const result = {};
    for (const [name, bit] of Object.entries(CONSENT_BITS)) {
        result[name] = (normalized & bit) !== 0;
    }
    return result;
}

function encodeConsentBits(flags) {
    if ((flags == null) || (typeof flags !== "object") || Array.isArray(flags)) {
        throw new TypeError("Consent flags must be an object");
    }
    let value = 0;
    for (const [name, bit] of Object.entries(CONSENT_BITS)) {
        if (flags[name] === true) value |= bit;
    }
    return value;
}

function effectiveConsent(sources) {
    if ((sources == null) || (typeof sources !== "object") || Array.isArray(sources)) {
        throw new TypeError("Consent sources must be an object");
    }
    let value = 0;
    for (const source of SOURCE_ORDER) {
        value |= normalizeConsent(sources[source] == null ? 0 : sources[source]);
    }
    return value & CONSENT_MASK;
}

function consentSources(sources) {
    effectiveConsent(sources);
    const result = {};
    for (const [name, bit] of Object.entries(CONSENT_BITS)) {
        result[name] = SOURCE_ORDER.filter((source) => {
            const value = sources[source] == null ? 0 : sources[source];
            return (value & bit) !== 0;
        });
    }
    return result;
}

module.exports = {
    CONSENT_BITS,
    CONSENT_MASK,
    decodeConsentBits,
    encodeConsentBits,
    effectiveConsent,
    consentSources
};
