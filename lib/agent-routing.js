"use strict";

function validNodeId(value) {
    return typeof value === "string" && /^node\/[^/]*\/[^/]+$/.test(value);
}

function validText(value, min, max) {
    return typeof value === "string" && value.length >= min && value.length <= max;
}

function createAgentRouter(meshServer) {
    if (meshServer == null) throw new TypeError("MeshCentral server is required");

    return {
        async sendToastToNode(nodeId, title, message, actor) {
            if (!validNodeId(nodeId)) return { ok: false, code: "invalid-node" };
            if (!validText(title, 1, 128)) return { ok: false, code: "invalid-title" };
            if (!validText(message, 1, 1024)) return { ok: false, code: "invalid-message" };

            const command = { action: "toast", title, msg: message };
            if ((actor != null) && (typeof actor.id === "string")) command.userid = actor.id;
            if ((actor != null) && (typeof actor.name === "string")) command.username = actor.name;

            const agents = meshServer.webserver != null ? meshServer.webserver.wsagents : null;
            const localAgent = agents != null ? agents[nodeId] : null;
            if (localAgent != null) {
                try {
                    localAgent.send(JSON.stringify(command));
                    return { ok: true, code: "sent-local" };
                } catch (error) {
                    return { ok: false, code: "send-failed", error };
                }
            }

            const routing = typeof meshServer.GetRoutingServerIdNotSelf === "function"
                ? meshServer.GetRoutingServerIdNotSelf(nodeId, 1)
                : null;
            if ((routing != null) && (meshServer.multiServer != null) && (typeof meshServer.multiServer.DispatchMessageSingleServer === "function")) {
                try {
                    meshServer.multiServer.DispatchMessageSingleServer({
                        action: "agentCommand",
                        nodeid: nodeId,
                        command
                    }, routing.serverid);
                    return { ok: true, code: "sent-peer" };
                } catch (error) {
                    return { ok: false, code: "send-failed", error };
                }
            }
            return { ok: false, code: "offline" };
        }
    };
}

module.exports = { createAgentRouter };
