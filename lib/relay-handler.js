"use strict";

const { resolveRule } = require("./rules");
const { renderTemplate } = require("./templates");
const { classifyRelayEvent } = require("./sessions");

function createRelayHandler(dependencies) {
    if ((dependencies == null) || (typeof dependencies !== "object")) throw new TypeError("Relay dependencies are required");

    return {
        async handle(event) {
            try {
                const info = classifyRelayEvent(event);
                if (info == null) return { ok: false, code: "ignored" };
                if (!dependencies.tracker.accept(info)) return { ok: false, code: "duplicate" };

                const config = await dependencies.store.getNodeConfig(info.nodeId);
                if (config == null) return { ok: false, code: "not-configured" };
                if (config.enabled !== true) return { ok: false, code: "disabled" };
                if ((info.phase === "start") && (config.notifyOnConnect !== true)) return { ok: false, code: "phase-disabled" };
                if ((info.phase === "end") && (config.notifyOnDisconnect !== true)) return { ok: false, code: "phase-disabled" };

                const resolved = resolveRule(config, info.userId, info.protocolClass);
                if (resolved == null) return { ok: false, code: "rule-disabled" };

                const node = await dependencies.getNode(info.nodeId);
                if (node == null) return { ok: false, code: "node-missing" };
                const user = dependencies.getUser(info.userId) || {};
                const context = {
                    operator: info.username || user.name || info.userId,
                    realname: user.realname || info.username || user.name || info.userId,
                    device: node.name || info.nodeId,
                    protocol: info.protocolLabel,
                    time: new Date(dependencies.now()).toISOString(),
                    nodeid: info.nodeId,
                    sessionid: info.sessionId
                };
                const title = renderTemplate(resolved.rule.title, context) || "MeshCentral";
                const messageTemplate = info.phase === "start" ? resolved.rule.connectMessage : resolved.rule.disconnectMessage;
                const message = renderTemplate(messageTemplate, context);
                if (message.length === 0) return { ok: false, code: "empty-message" };

                const result = await dependencies.router.sendToastToNode(
                    info.nodeId,
                    title,
                    message,
                    { id: info.userId, name: info.username || user.name || "" }
                );
                if (typeof dependencies.log === "function") {
                    dependencies.log(result.ok === true ? "toast-sent" : "toast-failed", {
                        nodeId: info.nodeId,
                        userId: info.userId,
                        phase: info.phase,
                        protocol: info.protocolClass,
                        code: result.code
                    });
                }
                return result;
            } catch (error) {
                if (typeof dependencies.log === "function") dependencies.log("relay-error", { error });
                return { ok: false, code: "error", error };
            }
        }
    };
}

module.exports = { createRelayHandler };
