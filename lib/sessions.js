"use strict";

const { classifyProtocol, protocolLabel } = require("./protocols");

const RELAY_MESSAGE_IDS = Object.freeze({
    10: { phase: "end", protocolClass: "terminal" },
    11: { phase: "end", protocolClass: "desktop" },
    12: { phase: "end", protocolClass: "files" },
    14: { phase: "start", protocolClass: "terminal" },
    15: { phase: "start", protocolClass: "desktop" },
    16: { phase: "start", protocolClass: "files" }
});

function classifyRelayEvent(event) {
    if ((event == null) || (event.action !== "relaylog")) return null;
    const classification = RELAY_MESSAGE_IDS[event.msgid];
    if (classification == null) return null;
    const protocolClass = classifyProtocol(event.protocol);
    if ((protocolClass == null) || (protocolClass !== classification.protocolClass)) return null;
    if ((typeof event.nodeid !== "string") || (typeof event.userid !== "string")) return null;

    const relayId = Array.isArray(event.msgArgs) && (typeof event.msgArgs[0] === "string") && (event.msgArgs[0].length > 0)
        ? event.msgArgs[0]
        : null;
    const sessionId = (typeof event.sessionid === "string") && event.sessionid.length > 0
        ? event.sessionid
        : (relayId || protocolClass);

    return {
        phase: classification.phase,
        protocolClass,
        protocolLabel: protocolLabel(event.protocol),
        sessionId,
        nodeId: event.nodeid,
        userId: event.userid,
        username: typeof event.username === "string" ? event.username : "",
        key: `${event.nodeid}\u0000${event.userid}\u0000${sessionId}`
    };
}

function createSessionTracker(options = {}) {
    const now = typeof options.now === "function" ? options.now : Date.now;
    const disconnectedTtlMs = Number.isInteger(options.disconnectedTtlMs) ? options.disconnectedTtlMs : 300_000;
    const activeTtlMs = Number.isInteger(options.activeTtlMs) ? options.activeTtlMs : 86_400_000;
    const sessions = new Map();

    function prune() {
        const current = now();
        let removed = 0;
        for (const [key, value] of sessions) {
            const expiresAt = value.endedAt == null
                ? value.startedAt + activeTtlMs
                : value.endedAt + disconnectedTtlMs;
            if (current > expiresAt) {
                sessions.delete(key);
                removed++;
            }
        }
        return removed;
    }

    return {
        accept(info) {
            if ((info == null) || (typeof info.key !== "string")) return false;
            prune();
            let state = sessions.get(info.key);
            if (state == null) {
                state = { nodeId: info.nodeId, startedAt: now(), startAccepted: false, endAccepted: false, endedAt: null };
                sessions.set(info.key, state);
            }
            if (info.phase === "start") {
                if (state.startAccepted) return false;
                state.startAccepted = true;
                state.startedAt = now();
                return true;
            }
            if (info.phase === "end") {
                if (state.endAccepted) return false;
                state.endAccepted = true;
                state.endedAt = now();
                return true;
            }
            return false;
        },

        removeNode(nodeId) {
            let removed = 0;
            for (const [key, value] of sessions) {
                if (value.nodeId === nodeId) {
                    sessions.delete(key);
                    removed++;
                }
            }
            return removed;
        },

        prune,
        size() { return sessions.size; }
    };
}

module.exports = {
    RELAY_MESSAGE_IDS,
    classifyRelayEvent,
    createSessionTracker
};
