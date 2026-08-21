"use strict";

const { createDefaultConfig, sanitizeNodeConfig } = require("./config");
const { effectiveConsent } = require("./consent");
const { renderTemplate, validateTemplate } = require("./templates");

const MESHRIGHT_MANAGECOMPUTERS = 0x00000004;
const MESHRIGHT_REMOTECONTROL = 0x00000008;
const MESHRIGHT_REMOTEVIEWONLY = 0x00000100;
const CONSENT_MASK = 0x7F;
const TEST_PROTOCOLS = new Set(["Desktop", "Terminal", "Files"]);

class ApiError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function safeConsent(value) {
    return Number.isInteger(value) && value >= 0 ? value & CONSENT_MASK : 0;
}

function dbGet(db, id) {
    return new Promise((resolve, reject) => {
        db.Get(id, (error, docs) => {
            if (error != null) reject(error);
            else resolve(Array.isArray(docs) && docs.length > 0 ? docs[0] : null);
        });
    });
}

function copyMapped(source, mappings) {
    const result = {};
    if ((source == null) || (typeof source !== "object")) return result;
    for (const [input, output] of mappings) {
        if (source[input] !== undefined) result[output] = source[input];
    }
    return result;
}

function normalizeDomainDefaults(domain) {
    return {
        desktopPrivacyBarText: typeof domain.desktopprivacybartext === "string" ? domain.desktopprivacybartext : "",
        consentMessages: copyMapped(domain.consentmessages, [
            ["title", "title"],
            ["desktop", "desktop"],
            ["terminal", "terminal"],
            ["files", "files"],
            ["consenttimeout", "consentTimeout"],
            ["autoacceptontimeout", "autoAcceptOnTimeout"],
            ["autoacceptifnouser", "autoAcceptIfNoUser"],
            ["autoacceptifdesktopnouser", "autoAcceptIfDesktopNoUser"],
            ["autoacceptifterminalnouser", "autoAcceptIfTerminalNoUser"],
            ["autoacceptiffilenouser", "autoAcceptIfFileNoUser"],
            ["autoacceptiflocked", "autoAcceptIfLocked"],
            ["autoacceptifdesktoplocked", "autoAcceptIfDesktopLocked"],
            ["autoacceptifterminallocked", "autoAcceptIfTerminalLocked"],
            ["autoacceptiffilelocked", "autoAcceptIfFileLocked"],
            ["oldstyle", "oldStyle"]
        ]),
        notificationMessages: copyMapped(domain.notificationmessages, [
            ["title", "title"],
            ["desktop", "desktop"],
            ["terminal", "terminal"],
            ["files", "files"]
        ])
    };
}

function publicConfig(config) {
    if (config == null) return null;
    const result = { ...config };
    delete result._id;
    return result;
}

function createServerApi(dependencies) {
    const { meshServer, store, router } = dependencies;
    const webserver = meshServer.webserver;

    function send(session, method, data) {
        const message = { action: "plugin", plugin: "connectedtoast", method, data };
        if ((session != null) && (session.ws != null) && (typeof session.ws.send === "function")) {
            session.ws.send(JSON.stringify(message));
        }
        return message;
    }

    function sendError(session, code, message, nodeId) {
        return send(session, "connectedToastError", { ok: false, code, message, nodeid: nodeId });
    }

    function requireSession(session) {
        if ((session == null) || (session.user == null) || (session.domain == null)) {
            throw new ApiError("unauthenticated", "Authentication required");
        }
        return session.user;
    }

    async function resolveNode(session, nodeId, requireManage) {
        const user = requireSession(session);
        const domainId = session.domain.id;
        if ((typeof nodeId !== "string") || !nodeId.startsWith(`node/${domainId}/`)) {
            throw new ApiError("invalid-node", "Node does not belong to this domain");
        }
        const node = await dbGet(meshServer.db, nodeId);
        if ((node == null) || (node.type !== "node") || (node.domain !== domainId)) {
            throw new ApiError("node-not-found", "Node not found");
        }
        const rights = webserver.GetNodeRights(user, node.meshid, node._id);
        if (rights === 0) throw new ApiError("permission-denied", "Permission denied");
        if ((requireManage === true) && ((rights & MESHRIGHT_MANAGECOMPUTERS) === 0)) {
            throw new ApiError("permission-denied", "Manage Computers permission required");
        }
        const mesh = webserver.meshes[node.meshid];
        if ((mesh == null) || (mesh.domain !== domainId)) throw new ApiError("node-not-found", "Device group not found");
        return { node, mesh, rights };
    }

    function isOnline(nodeId) {
        if ((webserver.wsagents != null) && (webserver.wsagents[nodeId] != null)) return true;
        return typeof meshServer.GetRoutingServerId === "function" && meshServer.GetRoutingServerId(nodeId, 1) != null;
    }

    function listDomainUsers(domainId) {
        return Object.values(webserver.users || {}).filter((user) => user != null && user.domain === domainId && typeof user._id === "string");
    }

    function listOperators(session, node, mesh) {
        const baseConsent = {
            domain: safeConsent(session.domain.userconsentflags),
            mesh: safeConsent(mesh.consent),
            node: safeConsent(node.consent)
        };
        return listDomainUsers(session.domain.id)
            .map((user) => {
                const rights = webserver.GetNodeRights(user, node.meshid, node._id);
                return {
                    remote: rights === 0xFFFFFFFF || (rights & (MESHRIGHT_REMOTECONTROL | MESHRIGHT_REMOTEVIEWONLY)) !== 0,
                    id: user._id,
                    name: typeof user.name === "string" ? user.name : "",
                    realname: typeof user.realname === "string" ? user.realname : "",
                    consent: safeConsent(user.consent),
                    effectiveConsent: effectiveConsent({ ...baseConsent, operator: safeConsent(user.consent) })
                };
            })
            .sort((a, b) => Number(b.remote) - Number(a.remote) || (a.realname || a.name || a.id).localeCompare(b.realname || b.name || b.id))
            .map(({ remote, ...operator }) => operator);
    }

    function auditChange(session, node, operation) {
        if (typeof meshServer.DispatchEvent !== "function") return;
        const targets = typeof webserver.CreateNodeDispatchTargets === "function"
            ? webserver.CreateNodeDispatchTargets(node.meshid, node._id, ["server-users", session.user._id])
            : ["*", node.meshid, node._id, session.user._id];
        meshServer.DispatchEvent(targets, dependencies.source || null, {
            etype: "node",
            action: "connectedtoastconfig",
            nodeid: node._id,
            meshid: node.meshid,
            domain: node.domain,
            userid: session.user._id,
            username: session.user.name,
            msg: `ConnectedToast settings ${operation} for ${node.name}`
        });
    }

    async function getNodeConfig(command, session) {
        const { node, mesh, rights } = await resolveNode(session, command.nodeid, false);
        const stored = await store.getNodeConfig(node._id);
        const config = publicConfig(stored) || createDefaultConfig(node._id, session.domain.id);
        const native = {
            domainConsent: safeConsent(session.domain.userconsentflags),
            meshConsent: safeConsent(mesh.consent),
            nodeConsent: safeConsent(node.consent)
        };
        native.effectiveConsent = effectiveConsent({
            domain: native.domainConsent,
            mesh: native.meshConsent,
            node: native.nodeConsent,
            operator: 0
        });
        return send(session, "setNodeConfig", {
            node: { id: node._id, name: node.name || node._id },
            mesh: { id: mesh._id, name: mesh.name || mesh._id },
            config,
            native,
            domainDefaults: normalizeDomainDefaults(session.domain),
            online: isOnline(node._id),
            canEdit: (rights & MESHRIGHT_MANAGECOMPUTERS) !== 0
        });
    }

    async function getOperators(command, session) {
        const { node, mesh } = await resolveNode(session, command.nodeid, false);
        return send(session, "setOperators", { nodeid: node._id, operators: listOperators(session, node, mesh) });
    }

    async function saveNodeConfig(command, session) {
        const { node } = await resolveNode(session, command.nodeid, true);
        const operatorIds = new Set(listDomainUsers(session.domain.id).map((user) => user._id));
        let config;
        try {
            config = sanitizeNodeConfig(command.config, { nodeId: node._id, domain: session.domain.id, operatorIds });
        } catch (error) {
            throw new ApiError("validation-error", error.message);
        }
        config.updatedAt = dependencies.now();
        config.updatedBy = session.user._id;
        const saved = await store.saveNodeConfig(config);
        auditChange(session, node, "changed");
        if (typeof dependencies.log === "function") dependencies.log("config-save", { nodeId: node._id, userId: session.user._id });
        return send(session, "saveResult", { ok: true, nodeid: node._id, config: publicConfig(saved) });
    }

    async function resetNodeConfig(command, session) {
        const { node } = await resolveNode(session, command.nodeid, true);
        await store.deleteNodeConfig(node._id);
        auditChange(session, node, "reset");
        if (typeof dependencies.log === "function") dependencies.log("config-delete", { nodeId: node._id, userId: session.user._id });
        return send(session, "saveResult", {
            ok: true,
            reset: true,
            nodeid: node._id,
            config: createDefaultConfig(node._id, session.domain.id)
        });
    }

    function resolveTestOperator(session, operatorId) {
        if (operatorId == null || operatorId === "") return session.user;
        const user = (webserver.users || {})[operatorId];
        if ((user == null) || (user.domain !== session.domain.id)) throw new ApiError("validation-error", "Invalid operator ID");
        return user;
    }

    async function testToast(command, session) {
        const { node } = await resolveNode(session, command.nodeid, true);
        const operator = resolveTestOperator(session, command.operatorid);
        const protocol = TEST_PROTOCOLS.has(command.protocol) ? command.protocol : "Desktop";
        let title;
        let message;
        try {
            title = validateTemplate(command.title, 128, "title");
            message = validateTemplate(command.message, 1024, "message");
        } catch (error) {
            throw new ApiError("validation-error", error.message);
        }
        const context = {
            operator: operator.name || operator._id,
            realname: operator.realname || operator.name || operator._id,
            device: node.name || node._id,
            protocol,
            time: new Date(dependencies.now()).toISOString(),
            nodeid: node._id,
            sessionid: "test-toast"
        };
        const result = await router.sendToastToNode(
            node._id,
            renderTemplate(title, context) || "MeshCentral",
            renderTemplate(message, context),
            { id: session.user._id, name: session.user.name || "" }
        );
        const messages = {
            "sent-local": "Toast sent",
            "sent-peer": "Toast sent",
            offline: "Device is offline",
            "send-failed": "Unable to route command to agent",
            "invalid-title": "Invalid toast title",
            "invalid-message": "Invalid toast message"
        };
        if (typeof dependencies.log === "function") dependencies.log("test-toast", { nodeId: node._id, userId: session.user._id, code: result.code });
        return send(session, "testToastResult", {
            ok: result.ok === true,
            nodeid: node._id,
            code: result.code,
            message: messages[result.code] || "Unable to route command to agent"
        });
    }

    return {
        async handle(command, session) {
            try {
                requireSession(session);
                switch (command != null ? command.pluginaction : null) {
                    case "getNodeConfig": return await getNodeConfig(command, session);
                    case "getOperators": return await getOperators(command, session);
                    case "saveNodeConfig": return await saveNodeConfig(command, session);
                    case "resetNodeConfig": return await resetNodeConfig(command, session);
                    case "testToast": return await testToast(command, session);
                    default: throw new ApiError("unknown-action", "Unknown ConnectedToast action");
                }
            } catch (error) {
                const code = error instanceof ApiError ? error.code : "server-error";
                if (typeof dependencies.log === "function") dependencies.log("server-action-error", { code, error });
                return sendError(session, code, error.message || "ConnectedToast action failed", command != null ? command.nodeid : undefined);
            }
        }
    };
}

module.exports = {
    ApiError,
    normalizeDomainDefaults,
    createServerApi
};
