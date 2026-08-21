"use strict";

const RECORD_TYPE = "connectedtoast-node";

function parseNodeId(nodeId) {
    if (typeof nodeId !== "string") throw new TypeError("Invalid node ID");
    const match = /^node\/([^/]*)\/([^/]+)$/.exec(nodeId);
    if (match == null) throw new TypeError("Invalid node ID");
    return { domain: match[1], guid: match[2] };
}

function nodeConfigId(nodeId) {
    const parsed = parseNodeId(nodeId);
    return `${RECORD_TYPE}//${parsed.domain}/${parsed.guid}`;
}

function callbackPromise(invoke) {
    return new Promise((resolve, reject) => {
        invoke((error, value) => {
            if (error != null) reject(error);
            else resolve(value);
        });
    });
}

function CreateStore(meshServer) {
    if ((meshServer == null) || (meshServer.db == null)) throw new TypeError("MeshCentral DB is required");
    const coreDb = meshServer.db;

    return {
        async getNodeConfig(nodeId) {
            const id = nodeConfigId(nodeId);
            const docs = await callbackPromise((done) => coreDb.Get(id, done));
            return Array.isArray(docs) && docs.length > 0 ? docs[0] : null;
        },

        async saveNodeConfig(config) {
            if ((config == null) || (typeof config !== "object")) throw new TypeError("Configuration is required");
            const parsed = parseNodeId(config.nodeId);
            const record = {
                ...config,
                _id: nodeConfigId(config.nodeId),
                type: RECORD_TYPE,
                domain: parsed.domain,
                nodeId: config.nodeId
            };
            await callbackPromise((done) => coreDb.Set(record, done));
            return record;
        },

        async deleteNodeConfig(nodeId) {
            const id = nodeConfigId(nodeId);
            await callbackPromise((done) => coreDb.Remove(id, done));
        },

        async listNodeConfigs() {
            const docs = await callbackPromise((done) => coreDb.GetAllType(RECORD_TYPE, done));
            return Array.isArray(docs) ? docs : [];
        },

        async cleanupStaleConfigs(nodeExists) {
            if (typeof nodeExists !== "function") throw new TypeError("nodeExists must be a function");
            const docs = await this.listNodeConfigs();
            const removed = [];
            for (const doc of docs) {
                if ((doc == null) || (typeof doc.nodeId !== "string")) continue;
                if (await nodeExists(doc.nodeId)) continue;
                await this.deleteNodeConfig(doc.nodeId);
                removed.push(doc.nodeId);
            }
            return removed;
        }
    };
}

module.exports = {
    RECORD_TYPE,
    nodeConfigId,
    CreateStore
};
