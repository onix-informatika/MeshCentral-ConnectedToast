"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { createAgentRouter } = require("../lib/agent-routing");

function server() {
    return {
        webserver: { wsagents: {} },
        GetRoutingServerIdNotSelf: () => null,
        multiServer: null
    };
}

test("local agent receives one native MeshAgent toast command", async () => {
    const meshServer = server();
    const sent = [];
    meshServer.webserver.wsagents["node//pc1"] = { send: (value) => sent.push(JSON.parse(value)) };
    const result = await createAgentRouter(meshServer).sendToastToNode(
        "node//pc1", "Onix IT", "Igor connected.", { id: "user//igor", name: "igor" }
    );
    assert.deepEqual(result, { ok: true, code: "sent-local" });
    assert.deepEqual(sent, [{
        action: "toast",
        title: "Onix IT",
        msg: "Igor connected.",
        userid: "user//igor",
        username: "igor"
    }]);
});

test("peer routing uses MeshCentral agentCommand for the exact server", async () => {
    const meshServer = server();
    const sent = [];
    meshServer.GetRoutingServerIdNotSelf = (nodeId, type) => {
        assert.equal(nodeId, "node//pc1");
        assert.equal(type, 1);
        return { serverid: "server-b", meshid: "mesh//m1" };
    };
    meshServer.multiServer = { DispatchMessageSingleServer: (message, serverId) => sent.push({ message, serverId }) };
    const result = await createAgentRouter(meshServer).sendToastToNode("node//pc1", "Title", "Message");
    assert.deepEqual(result, { ok: true, code: "sent-peer" });
    assert.deepEqual(sent, [{
        serverId: "server-b",
        message: {
            action: "agentCommand",
            nodeid: "node//pc1",
            command: { action: "toast", title: "Title", msg: "Message" }
        }
    }]);
});

test("offline node returns a meaningful result", async () => {
    assert.deepEqual(
        await createAgentRouter(server()).sendToastToNode("node//pc1", "Title", "Message"),
        { ok: false, code: "offline" }
    );
});

test("local and peer send failures are contained", async () => {
    const local = server();
    local.webserver.wsagents["node//pc1"] = { send() { throw new Error("socket closed"); } };
    const localResult = await createAgentRouter(local).sendToastToNode("node//pc1", "Title", "Message");
    assert.equal(localResult.ok, false);
    assert.equal(localResult.code, "send-failed");

    const peer = server();
    peer.GetRoutingServerIdNotSelf = () => ({ serverid: "server-b" });
    peer.multiServer = { DispatchMessageSingleServer() { throw new Error("peer closed"); } };
    const peerResult = await createAgentRouter(peer).sendToastToNode("node//pc1", "Title", "Message");
    assert.equal(peerResult.ok, false);
    assert.equal(peerResult.code, "send-failed");
});

test("invalid node, title, and message are rejected before routing", async () => {
    const router = createAgentRouter(server());
    assert.equal((await router.sendToastToNode("bad", "Title", "Message")).code, "invalid-node");
    assert.equal((await router.sendToastToNode("node//pc1", "", "Message")).code, "invalid-title");
    assert.equal((await router.sendToastToNode("node//pc1", "Title", "")).code, "invalid-message");
    assert.equal((await router.sendToastToNode("node//pc1", "x".repeat(129), "Message")).code, "invalid-title");
    assert.equal((await router.sendToastToNode("node//pc1", "Title", "x".repeat(1025))).code, "invalid-message");
});
