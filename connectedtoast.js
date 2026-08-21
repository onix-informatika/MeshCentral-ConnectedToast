"use strict";

const { CreateStore } = require("./db");
const { createAgentRouter } = require("./lib/agent-routing");
const { createBrowserApi } = require("./lib/browser-ui");
const { createRelayHandler } = require("./lib/relay-handler");
const { createServerApi } = require("./lib/server-api");
const { createSessionTracker } = require("./lib/sessions");

function createPlugin(parent, overrides = {}) {
    const obj = {};
    const meshServer = parent.parent;

    obj.parent = parent;
    obj.meshServer = meshServer;
    const browserApi = createBrowserApi();
    Object.assign(obj, browserApi);
    obj.exports = Object.keys(browserApi);

    obj.log = overrides.log || function (event, data) {
        const details = data == null ? "" : ` ${JSON.stringify(data, (key, value) => value instanceof Error ? value.message : value)}`;
        if (typeof meshServer.debug === "function") meshServer.debug("PLUGIN", "ConnectedToast", `${event}${details}`);
        else console.log(`PLUGIN: ConnectedToast: ${event}${details}`);
    };

    obj.store = overrides.store || CreateStore(meshServer);
    obj.router = overrides.router || createAgentRouter(meshServer);
    obj.tracker = overrides.tracker || createSessionTracker();

    obj.getNode = overrides.getNode || function (nodeId) {
        return new Promise((resolve, reject) => {
            meshServer.db.Get(nodeId, (error, docs) => {
                if (error != null) reject(error);
                else resolve(Array.isArray(docs) && docs.length > 0 ? docs[0] : null);
            });
        });
    };

    obj.getUser = overrides.getUser || function (userId) {
        return meshServer.webserver != null && meshServer.webserver.users != null
            ? meshServer.webserver.users[userId]
            : null;
    };

    obj.relayHandler = overrides.relayHandler || createRelayHandler({
        store: obj.store,
        getNode: obj.getNode,
        getUser: obj.getUser,
        router: obj.router,
        tracker: obj.tracker,
        now: Date.now,
        log: obj.log
    });

    obj.serverApi = overrides.serverApi || createServerApi({
        meshServer,
        store: obj.store,
        router: obj.router,
        now: Date.now,
        log: obj.log,
        source: obj
    });

    obj.server_startup = function () {
        try {
            meshServer.AddEventDispatch(["*"], obj);
            obj.log("startup", { message: "Watching relay and node events" });
            obj.startupPromise = obj.store.cleanupStaleConfigs(async (nodeId) => (await obj.getNode(nodeId)) != null)
                .then((removed) => obj.log("stale-cleanup", { removed: removed.length }))
                .catch((error) => obj.log("startup-error", { error }));
        } catch (error) {
            obj.log("startup-error", { error });
            obj.startupPromise = Promise.resolve();
        }
    };

    obj.HandleEvent = function (source, event) {
        if ((event == null) || (typeof event !== "object")) return;
        if (event.action === "relaylog") {
            if (source == null) return;
            Promise.resolve(obj.relayHandler.handle(event)).catch((error) => obj.log("relay-error", { error }));
            return;
        }
        if ((event.action === "removenode") && (typeof event.nodeid === "string")) {
            try { obj.tracker.removeNode(event.nodeid); } catch (error) { obj.log("session-cleanup-error", { error }); }
            if (source == null) return;
            Promise.resolve(obj.store.deleteNodeConfig(event.nodeid))
                .then(() => obj.log("node-config-delete", { nodeId: event.nodeid }))
                .catch((error) => obj.log("node-config-delete-error", { error, nodeId: event.nodeid }));
        }
    };

    obj.serveraction = function (command, meshUserSession) {
        Promise.resolve(obj.serverApi.handle(command, meshUserSession))
            .catch((error) => obj.log("server-action-error", { error }));
    };

    return obj;
}

module.exports.connectedtoast = function (parent) {
    return createPlugin(parent);
};

module.exports.createPlugin = createPlugin;
