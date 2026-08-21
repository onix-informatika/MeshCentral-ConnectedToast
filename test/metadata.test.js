"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..");

test("plugin catalog metadata identifies ConnectedToast v0.1.2", () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "config.json"), "utf8"));
    assert.equal(metadata.name, "Connected Toast");
    assert.equal(metadata.shortName, "connectedtoast");
    assert.equal(metadata.version, "0.1.2");
    assert.equal(metadata.hasAdminPanel, false);
    assert.equal(metadata.meshCentralCompat, ">=1.1.53");
    for (const field of ["homepage", "changelogUrl", "configUrl", "downloadUrl", "versionHistoryUrl"]) {
        assert.equal(metadata[field].includes("onix-informatika/MeshCentral-ConnectedToast"), true);
    }
});

test("package version and plugin metadata version stay aligned", () => {
    const metadata = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "config.json"), "utf8"));
    const packageMetadata = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
    assert.equal(packageMetadata.version, metadata.version);
    assert.equal(packageMetadata.main, "connectedtoast.js");
});
