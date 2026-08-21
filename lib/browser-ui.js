"use strict";

function createBrowserApi() {
    return {
        onDeviceRefreshEnd: function (nodeId) {
            const api = pluginHandler.connectedtoast;
            const resolvedNodeId = typeof nodeId === "string"
                ? nodeId
                : (currentNode && currentNode._id);
            api.state = {
                nodeId: resolvedNodeId,
                data: null,
                operators: [],
                operatorsLoaded: false,
                draftNativeConsent: null,
                pendingNativeConsent: null,
                selectedOperatorId: ""
            };

            pluginHandler.registerPluginTab({
                tabId: "connectedtoast-panel",
                tabTitle: "Connected Toast",
                title: "Connected Toast"
            });

            const panel = document.getElementById("connectedtoast-panel");
            panel.innerHTML = [
                '<style>.ct-page{max-width:980px;padding:12px}.ct-page section{border:1px solid #bbb;border-radius:6px;margin:12px 0;padding:12px}.ct-page label{display:block;margin:6px 0}.ct-page input[type=text],.ct-page input:not([type]),.ct-page textarea,.ct-page select{box-sizing:border-box;max-width:100%;width:520px}.ct-page textarea{min-height:68px}.ct-actionbar{position:sticky;top:0;z-index:2;background:#fff;border:1px solid #bbb;border-radius:6px;padding:6px 10px}.ct-native-row{display:grid;grid-template-columns:minmax(280px,2fr) repeat(3,minmax(90px,1fr));gap:8px;padding:5px;border-bottom:1px solid #ddd}.ct-on{color:#16733a;font-weight:bold}.ct-off{color:#666}.ct-inherited{color:#9a6500}.ct-table{border-collapse:collapse;margin:8px 0;width:100%}.ct-table td,.ct-table th{border:1px solid #bbb;padding:5px;text-align:left}#ct-preview-title{font-weight:bold;margin-top:8px}#ct-preview-message{white-space:pre-wrap}.ct-page button{margin:8px 8px 8px 0}</style>',
                '<div class="ct-page">',
                '<h2>Connected Toast</h2>',
                '<pre id="ct-summary">Loading Desktop transparency status...</pre>',
                '<div class="ct-actionbar"><button id="ct-save" data-ct-edit="1" type="button">Save settings</button>',
                '<button id="ct-test" data-ct-edit="1" type="button">Send test toast</button>',
                '<button id="ct-reset" data-ct-edit="1" type="button">Reset Connected Toast</button>',
                '<span id="ct-status" role="status" aria-live="polite">Changes are not saved until Save settings is pressed.</span></div>',
                '<section><h3>Native MeshCentral visibility &amp; consent</h3>',
                '<p>These settings use MeshCentral native device consent. Inherited values remain visible and Reset Connected Toast does not change them.</p>',
                '<div id="ct-native-rows"></div>',
                '<h4>Desktop transparency summary</h4><div id="ct-transparency-summary"></div>',
                '<details><summary>Inherited domain settings, read only</summary><pre id="ct-domain-defaults"></pre></details></section>',
                '<section><h3>Connected Toast</h3>',
                '<label><input id="ct-enabled" data-ct-edit="1" type="checkbox"> Enable Connected Toast</label>',
                '<label><input id="ct-notify-connect" data-ct-edit="1" type="checkbox"> Notify on connect</label>',
                '<label><input id="ct-notify-disconnect" data-ct-edit="1" type="checkbox"> Notify on disconnect</label>',
                '<fieldset><legend>Global protocols</legend>',
                '<label><input id="ct-global-desktop" data-ct-edit="1" type="checkbox"> Desktop</label>',
                '<label><input id="ct-global-terminal" data-ct-edit="1" type="checkbox"> Terminal</label>',
                '<label><input id="ct-global-files" data-ct-edit="1" type="checkbox"> Files</label></fieldset>',
                '<h4>Default rule</h4>',
                '<label>State <select id="ct-default-state" data-ct-edit="1"><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>',
                '<div id="ct-default-fields">',
                '<label><input id="ct-default-desktop" data-ct-edit="1" type="checkbox"> Desktop</label>',
                '<label><input id="ct-default-terminal" data-ct-edit="1" type="checkbox"> Terminal</label>',
                '<label><input id="ct-default-files" data-ct-edit="1" type="checkbox"> Files</label>',
                '<label>Title <input id="ct-default-title" data-ct-edit="1" maxlength="128"></label>',
                '<label>Connect message <textarea id="ct-default-connect" data-ct-edit="1" maxlength="1024"></textarea></label>',
                '<label>Disconnect message <textarea id="ct-default-disconnect" data-ct-edit="1" maxlength="1024"></textarea></label></div>',
                '<h4>Operator overrides</h4>',
                '<label>Preview effective consent for operator: <select id="ct-operator-select"></select></label>',
                '<label>State <select id="ct-operator-state" data-ct-edit="1"><option value="inherit">Inherit</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>',
                '<div id="ct-operator-fields">',
                '<label><input id="ct-operator-desktop" data-ct-edit="1" type="checkbox"> Desktop</label>',
                '<label><input id="ct-operator-terminal" data-ct-edit="1" type="checkbox"> Terminal</label>',
                '<label><input id="ct-operator-files" data-ct-edit="1" type="checkbox"> Files</label>',
                '<label>Title <input id="ct-operator-title" data-ct-edit="1" maxlength="128"></label>',
                '<label>Connect message <textarea id="ct-operator-connect" data-ct-edit="1" maxlength="1024"></textarea></label>',
                '<label>Disconnect message <textarea id="ct-operator-disconnect" data-ct-edit="1" maxlength="1024"></textarea></label></div>',
                '<div id="ct-operator-table"></div>',
                '<h4>Plain text preview</h4><div id="ct-preview-title"></div><div id="ct-preview-message"></div>',
                '<p>Placeholders: {operator}, {realname}, {device}, {protocol}, {time}, {nodeid}, {sessionid}.</p>',
                '<p>Native notices and Connected Toast are independent. Enabling both can intentionally show duplicate notices.</p>',
                '<p id="ct-duplicate-warning"></p>',
                '<p>Version 0.1.1 reports Desktop, Terminal and Files relay sessions. It does not add session blocking, prompt enforcement or mobile-specific UI.</p>',
                '</section></div>'
            ].join("");

            api.bindUi();
            meshserver.send({ action: "plugin", plugin: "connectedtoast", pluginaction: "getNodeConfig", nodeid: resolvedNodeId });
            meshserver.send({ action: "plugin", plugin: "connectedtoast", pluginaction: "getOperators", nodeid: resolvedNodeId });
        },

        bindUi: function () {
            const api = pluginHandler.connectedtoast;
            const bindings = [
                ["ct-save", "click", api.save],
                ["ct-test", "click", api.sendTestToast],
                ["ct-reset", "click", api.reset],
                ["ct-operator-select", "change", api.selectOperator],
                ["ct-default-state", "change", api.refreshRuleVisibility],
                ["ct-operator-state", "change", api.refreshRuleVisibility]
            ];
            for (const binding of bindings) document.getElementById(binding[0]).addEventListener(binding[1], binding[2]);
            const previewIds = [
                "ct-enabled", "ct-notify-connect", "ct-notify-disconnect",
                "ct-global-desktop", "ct-global-terminal", "ct-global-files",
                "ct-default-state", "ct-default-desktop", "ct-default-terminal", "ct-default-files",
                "ct-default-title", "ct-default-connect", "ct-default-disconnect",
                "ct-operator-state", "ct-operator-desktop", "ct-operator-terminal", "ct-operator-files",
                "ct-operator-title", "ct-operator-connect", "ct-operator-disconnect"
            ];
            for (const id of previewIds) document.getElementById(id).addEventListener("input", api.renderPreview);
        },

        setNodeConfig: function (_server, message) {
            const api = pluginHandler.connectedtoast;
            if (!message || !message.data) return api.setStatus("Invalid server response");
            if (!message.data.node || message.data.node.id !== api.state.nodeId) return;
            api.state.data = message.data;
            api.state.draftNativeConsent = message.data.native ? message.data.native.nodeConsent : 0;
            api.populateForm();
        },

        setOperators: function (_server, message) {
            const api = pluginHandler.connectedtoast;
            if (!message || !message.data || !Array.isArray(message.data.operators)) return api.setStatus("Invalid operator response");
            if (message.data.nodeid !== api.state.nodeId) return;
            api.state.operators = message.data.operators.slice();
            api.state.operatorsLoaded = true;
            if (api.state.data) document.getElementById("ct-save").disabled = api.state.data.canEdit !== true;
            api.populateOperators();
            api.renderNativeRows();
            api.renderPreview();
        },

        populateForm: function () {
            const api = pluginHandler.connectedtoast;
            const data = api.state.data;
            if (!data || !data.config) return;
            const config = data.config;
            document.getElementById("ct-enabled").checked = config.enabled === true;
            document.getElementById("ct-notify-connect").checked = config.notifyOnConnect === true;
            document.getElementById("ct-notify-disconnect").checked = config.notifyOnDisconnect === true;
            document.getElementById("ct-global-desktop").checked = config.protocols.desktop === true;
            document.getElementById("ct-global-terminal").checked = config.protocols.terminal === true;
            document.getElementById("ct-global-files").checked = config.protocols.files === true;
            api.writeRule("default", config.defaultRule);

            const defaults = data.domainDefaults || {};
            document.getElementById("ct-domain-defaults").textContent = Object.keys(defaults).length
                ? JSON.stringify(defaults, null, 2)
                : "No domain-level text overrides";

            const canEdit = data.canEdit === true;
            for (const element of document.getElementById("connectedtoast-panel").querySelectorAll("[data-ct-edit]")) element.disabled = !canEdit;
            document.getElementById("ct-save").disabled = !canEdit || api.state.operatorsLoaded !== true;
            document.getElementById("ct-test").disabled = !canEdit || data.online !== true;
            api.populateOperators();
            api.renderNativeRows();
            api.refreshRuleVisibility();
            api.renderPreview();
        },

        populateOperators: function () {
            const api = pluginHandler.connectedtoast;
            const select = document.getElementById("ct-operator-select");
            const previous = api.state.selectedOperatorId || select.value || "";
            select.replaceChildren();
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "Preview default rule";
            select.appendChild(empty);
            for (const operator of api.state.operators) {
                const option = document.createElement("option");
                option.value = operator.id;
                const displayName = operator.realname || operator.name || operator.id;
                option.textContent = displayName + " (" + (operator.name || operator.id) + ") [" + operator.id + "]";
                select.appendChild(option);
            }
            const exists = api.state.operators.some(function (operator) { return operator.id === previous; });
            select.value = exists ? previous : "";
            api.state.selectedOperatorId = select.value;
            api.selectOperator();
            api.renderOperatorTable();
        },

        selectOperator: function () {
            const api = pluginHandler.connectedtoast;
            const select = document.getElementById("ct-operator-select");
            const nextOperatorId = select.value || "";
            const config = api.state.data && api.state.data.config;
            if (!config) return;
            if (api.state.selectedOperatorId && api.state.selectedOperatorId !== nextOperatorId) {
                config.operatorRules[api.state.selectedOperatorId] = api.readRule("operator");
            }
            api.state.selectedOperatorId = nextOperatorId;
            const rule = api.state.selectedOperatorId && config.operatorRules[api.state.selectedOperatorId]
                ? config.operatorRules[api.state.selectedOperatorId]
                : { state: "inherit" };
            api.writeRule("operator", rule);
            api.refreshRuleVisibility();
            api.renderNativeRows();
            api.renderPreview();
        },

        writeRule: function (prefix, rule) {
            const state = rule && rule.state ? rule.state : (prefix === "operator" ? "inherit" : "enabled");
            document.getElementById("ct-" + prefix + "-state").value = state;
            const enabledRule = state === "enabled" ? rule : null;
            document.getElementById("ct-" + prefix + "-desktop").checked = !!(enabledRule && enabledRule.protocols && enabledRule.protocols.desktop);
            document.getElementById("ct-" + prefix + "-terminal").checked = !!(enabledRule && enabledRule.protocols && enabledRule.protocols.terminal);
            document.getElementById("ct-" + prefix + "-files").checked = !!(enabledRule && enabledRule.protocols && enabledRule.protocols.files);
            document.getElementById("ct-" + prefix + "-title").value = enabledRule ? enabledRule.title : "";
            document.getElementById("ct-" + prefix + "-connect").value = enabledRule ? enabledRule.connectMessage : "";
            document.getElementById("ct-" + prefix + "-disconnect").value = enabledRule ? enabledRule.disconnectMessage : "";
        },

        readRule: function (prefix) {
            const state = document.getElementById("ct-" + prefix + "-state").value;
            if (state !== "enabled") return { state: state };
            return {
                state: "enabled",
                protocols: {
                    desktop: document.getElementById("ct-" + prefix + "-desktop").checked === true,
                    terminal: document.getElementById("ct-" + prefix + "-terminal").checked === true,
                    files: document.getElementById("ct-" + prefix + "-files").checked === true
                },
                title: document.getElementById("ct-" + prefix + "-title").value,
                connectMessage: document.getElementById("ct-" + prefix + "-connect").value,
                disconnectMessage: document.getElementById("ct-" + prefix + "-disconnect").value
            };
        },

        collectConfig: function () {
            const api = pluginHandler.connectedtoast;
            const existing = api.state.data.config;
            const rules = {};
            const currentOperatorIds = new Set(api.state.operators.map(function (operator) { return operator.id; }));
            for (const operatorId of Object.keys(existing.operatorRules || {})) {
                if (currentOperatorIds.has(operatorId)) rules[operatorId] = existing.operatorRules[operatorId];
            }
            if (api.state.selectedOperatorId) rules[api.state.selectedOperatorId] = api.readRule("operator");
            return {
                type: "connectedtoast-node",
                domain: existing.domain,
                nodeId: existing.nodeId,
                enabled: document.getElementById("ct-enabled").checked === true,
                notifyOnConnect: document.getElementById("ct-notify-connect").checked === true,
                notifyOnDisconnect: document.getElementById("ct-notify-disconnect").checked === true,
                protocols: {
                    desktop: document.getElementById("ct-global-desktop").checked === true,
                    terminal: document.getElementById("ct-global-terminal").checked === true,
                    files: document.getElementById("ct-global-files").checked === true
                },
                defaultRule: api.readRule("default"),
                operatorRules: rules
            };
        },

        collectNativeConsent: function () {
            let value = 0;
            for (const definition of pluginHandler.connectedtoast.consentDefinitions()) {
                if (document.getElementById("ct-consent-" + definition.bit).checked === true) value |= definition.bit;
            }
            return value;
        },

        consentDefinitions: function () {
            return [
                { bit: 1, label: "Notify user on Desktop connection" },
                { bit: 2, label: "Notify user on Terminal connection" },
                { bit: 4, label: "Notify user on Files connection" },
                { bit: 8, label: "Require approval for Desktop connection" },
                { bit: 16, label: "Require approval for Terminal connection" },
                { bit: 32, label: "Require approval for Files connection" },
                { bit: 64, label: "Show Desktop privacy bar while connected" }
            ];
        },

        save: function () {
            const api = pluginHandler.connectedtoast;
            if (!api.state.data || api.state.data.canEdit !== true) return api.setStatus("You do not have permission to save changes");
            if (api.state.operatorsLoaded !== true) return api.setStatus("Operator list is still loading");
            api.state.pendingNativeConsent = api.collectNativeConsent();
            api.setStatus("Saving Connected Toast settings");
            meshserver.send({
                action: "plugin",
                plugin: "connectedtoast",
                pluginaction: "saveNodeConfig",
                nodeid: api.state.nodeId,
                config: api.collectConfig()
            });
        },

        saveResult: function (_server, message) {
            const api = pluginHandler.connectedtoast;
            if (!message || !message.data || message.data.ok !== true) return api.setStatus("Connected Toast settings were not saved");
            if (message.data.nodeid !== api.state.nodeId) return;
            if (message.data.config && api.state.data) api.state.data.config = message.data.config;
            if (message.data.reset === true) {
                api.state.pendingNativeConsent = null;
                api.populateForm();
                return api.setStatus("Connected Toast settings reset. Native consent was not changed");
            }
            if (api.state.pendingNativeConsent != null) {
                const consent = api.state.pendingNativeConsent;
                api.state.pendingNativeConsent = null;
                meshserver.send({ action: "changedevice", nodeid: api.state.nodeId, consent: consent });
            }
            api.setStatus("Connected Toast settings saved");
            api.renderOperatorTable();
        },

        reset: function () {
            const api = pluginHandler.connectedtoast;
            if (!api.state.data || api.state.data.canEdit !== true) return api.setStatus("You do not have permission to reset settings");
            if (window && typeof window.confirm === "function" && !window.confirm("Reset only Connected Toast settings for this device? Native consent will remain unchanged.")) return;
            meshserver.send({ action: "plugin", plugin: "connectedtoast", pluginaction: "resetNodeConfig", nodeid: api.state.nodeId });
        },

        sendTestToast: function () {
            const api = pluginHandler.connectedtoast;
            if (!api.state.data || api.state.data.canEdit !== true) return api.setStatus("You do not have permission to send a test toast");
            if (api.state.data.online !== true) return api.setStatus("Device is offline");
            const rule = api.getEffectiveRule();
            if (rule == null) return api.setStatus("No enabled rule is available for the test toast");
            api.setStatus("Sending test toast");
            meshserver.send({
                action: "plugin",
                plugin: "connectedtoast",
                pluginaction: "testToast",
                nodeid: api.state.nodeId,
                operatorid: api.state.selectedOperatorId || undefined,
                protocol: "Desktop",
                title: rule.title,
                message: rule.connectMessage
            });
        },

        testToastResult: function (_server, message) {
            const api = pluginHandler.connectedtoast;
            if (message && message.data && message.data.nodeid && message.data.nodeid !== api.state.nodeId) return;
            api.setStatus(message && message.data && message.data.message ? message.data.message : "Test toast request completed");
        },

        resetResult: function (_server, message) {
            const api = pluginHandler.connectedtoast;
            if (message && message.data && message.data.config && api.state.data) {
                api.state.data.config = message.data.config;
                api.populateForm();
            }
            api.setStatus(message && message.data && message.data.message ? message.data.message : "Connected Toast settings reset");
        },

        connectedToastError: function (_server, message) {
            const api = pluginHandler.connectedtoast;
            if (message && message.data && message.data.nodeid && message.data.nodeid !== api.state.nodeId) return;
            api.setStatus(message && message.data && message.data.message ? message.data.message : "Connected Toast request failed");
        },

        getEffectiveRule: function () {
            const api = pluginHandler.connectedtoast;
            const config = api.state.data && api.state.data.config;
            if (!config) return null;
            if (api.state.selectedOperatorId) {
                const current = api.readRule("operator");
                if (current.state === "disabled") return null;
                if (current.state === "enabled") return current;
            }
            const fallback = api.readRule("default");
            return fallback.state === "enabled" ? fallback : null;
        },

        getPreview: function () {
            const api = pluginHandler.connectedtoast;
            const data = api.state.data || {};
            const node = data.node || { id: api.state.nodeId || "", name: "Device" };
            const selected = api.state.operators.find(function (operator) { return operator.id === api.state.selectedOperatorId; });
            const browserUser = typeof userinfo !== "undefined" && userinfo ? userinfo : null;
            const values = {
                operator: selected ? (selected.name || selected.id) : (browserUser ? (browserUser.name || browserUser._id) : "Igor"),
                realname: selected ? (selected.realname || selected.name || selected.id) : (browserUser ? (browserUser.realname || browserUser.name || browserUser._id) : "Igor Benić"),
                device: node.name || node.id,
                protocol: "Desktop",
                time: new Date().toLocaleString(),
                nodeid: node.id || api.state.nodeId || "",
                sessionid: "preview-session"
            };
            const rule = api.getEffectiveRule();
            const render = function (text) {
                return String(text || "").replace(/\{(operator|realname|device|protocol|time|nodeid|sessionid)\}/g, function (_token, name) { return String(values[name] == null ? "" : values[name]); });
            };
            return rule
                ? { title: render(rule.title), message: render(rule.connectMessage) }
                : { title: "Connected Toast disabled", message: "No enabled rule applies to this operator." };
        },

        renderPreview: function () {
            const api = pluginHandler.connectedtoast;
            const preview = api.getPreview();
            document.getElementById("ct-preview-title").textContent = preview.title;
            document.getElementById("ct-preview-message").textContent = preview.message;
            api.renderOperatorTable();
            if (api.state.data && api.state.data.native) {
                const selected = api.state.operators.find(function (operator) { return operator.id === api.state.selectedOperatorId; });
                api.renderSummary(api.getEffectiveNativeConsent(), selected);
            }
        },

        getEffectiveNativeConsent: function () {
            const api = pluginHandler.connectedtoast;
            const native = api.state.data && api.state.data.native;
            if (!native) return 0;
            const selected = api.state.operators.find(function (operator) { return operator.id === api.state.selectedOperatorId; });
            const operatorConsent = selected && Number.isInteger(selected.consent) ? selected.consent & 127 : 0;
            const rows = document.getElementById("ct-native-rows");
            const nodeConsent = rows && rows.children.length >= api.consentDefinitions().length
                ? api.collectNativeConsent()
                : native.nodeConsent;
            return (native.domainConsent | native.meshConsent | nodeConsent | operatorConsent) & 127;
        },

        renderNativeRows: function () {
            const api = pluginHandler.connectedtoast;
            const data = api.state.data;
            if (!data || !data.native) return;
            const native = data.native;
            const draftNodeConsent = Number.isInteger(api.state.draftNativeConsent) ? api.state.draftNativeConsent : native.nodeConsent;
            const rows = document.getElementById("ct-native-rows");
            rows.replaceChildren();
            const header = document.createElement("div");
            header.className = "ct-native-row";
            for (const heading of ["Setting", "Device", "Inherited", "Effective"]) {
                const cell = document.createElement("strong");
                cell.textContent = heading;
                header.appendChild(cell);
            }
            rows.appendChild(header);
            const selected = api.state.operators.find(function (operator) { return operator.id === api.state.selectedOperatorId; });
            const operatorConsent = selected && Number.isInteger(selected.consent) ? selected.consent & 127 : 0;
            const effectiveConsent = api.getEffectiveNativeConsent();
            const definitions = api.consentDefinitions();
            for (const definition of definitions) {
                const bit = definition.bit;
                const row = document.createElement("div");
                row.dataset.bit = String(bit);
                row.className = "ct-native-row";
                const label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = "ct-consent-" + bit;
                checkbox.checked = (draftNodeConsent & bit) !== 0;
                checkbox.disabled = data.canEdit !== true;
                checkbox.dataset.ctEdit = "1";
                checkbox.addEventListener("input", api.renderNativePreview);
                label.appendChild(checkbox);
                const labelText = document.createElement("span");
                labelText.textContent = definition.label;
                label.appendChild(labelText);
                const device = document.createElement("span");
                device.textContent = (draftNodeConsent & bit) !== 0 ? "ON" : "OFF";
                const inherited = document.createElement("span");
                inherited.className = "ct-inherited";
                const sources = [];
                if ((native.domainConsent & bit) !== 0) sources.push("Domain");
                if ((native.meshConsent & bit) !== 0) sources.push('Device Group "' + ((data.mesh && data.mesh.name) || data.mesh.id || "") + '"');
                if ((operatorConsent & bit) !== 0) sources.push('MeshCentral user "' + (selected.realname || selected.name || selected.id) + '"');
                inherited.textContent = sources.length ? sources.join(", ") : "None";
                const effective = document.createElement("span");
                effective.textContent = (effectiveConsent & bit) !== 0 ? "ON" : "OFF";
                effective.className = (effectiveConsent & bit) !== 0 ? "ct-on" : "ct-off";
                row.appendChild(label);
                row.appendChild(device);
                row.appendChild(inherited);
                row.appendChild(effective);
                rows.appendChild(row);
            }
            api.renderNativePreview();
        },

        renderNativePreview: function () {
            const api = pluginHandler.connectedtoast;
            const data = api.state.data;
            if (!data || !data.native) return;
            const native = data.native;
            const selected = api.state.operators.find(function (operator) { return operator.id === api.state.selectedOperatorId; });
            const operatorConsent = selected && Number.isInteger(selected.consent) ? selected.consent & 127 : 0;
            const nodeConsent = api.collectNativeConsent();
            api.state.draftNativeConsent = nodeConsent;
            const effectiveConsent = (native.domainConsent | native.meshConsent | nodeConsent | operatorConsent) & 127;
            for (const row of document.getElementById("ct-native-rows").children) {
                if (row.dataset.bit == null) continue;
                const bit = Number(row.dataset.bit);
                row.children[1].textContent = (nodeConsent & bit) !== 0 ? "ON" : "OFF";
                row.children[3].textContent = (effectiveConsent & bit) !== 0 ? "ON" : "OFF";
                row.children[3].className = (effectiveConsent & bit) !== 0 ? "ct-on" : "ct-off";
            }
            const summary = [];
            if ((effectiveConsent & 1) !== 0) summary.push("desktop session notification");
            if ((effectiveConsent & 8) !== 0) summary.push("desktop consent prompt");
            if ((effectiveConsent & 64) !== 0) summary.push("desktop privacy bar");
            document.getElementById("ct-transparency-summary").textContent = summary.length ? "Effective: " + summary.join(", ") : "No effective Desktop transparency controls";
            api.renderSummary(effectiveConsent, selected);
        },

        renderSummary: function (effectiveConsent, selected) {
            const api = pluginHandler.connectedtoast;
            const data = api.state.data;
            if (!data || !data.config) return;
            const rule = api.getEffectiveRule();
            const customOn = document.getElementById("ct-enabled").checked === true
                && document.getElementById("ct-notify-connect").checked === true
                && document.getElementById("ct-global-desktop").checked === true
                && rule != null
                && rule.protocols.desktop === true;
            const lines = [
                "Desktop transparency",
                "Privacy bar: " + (((effectiveConsent & 64) !== 0) ? "ON" : "OFF"),
                "Connection toast: " + (customOn ? "ON" : "OFF"),
                "Approval prompt: " + (((effectiveConsent & 8) !== 0) ? "ON" : "OFF"),
                "Operator: " + (selected ? (selected.realname || selected.name || selected.id) : "Default rule preview")
            ];
            document.getElementById("ct-summary").textContent = lines.join("\n");
            document.getElementById("ct-duplicate-warning").textContent = ((effectiveConsent & 1) !== 0) && customOn
                ? "Both native Desktop Notification and ConnectedToast are enabled; the endpoint may receive two notifications."
                : "Recommended: use the native privacy bar with one ConnectedToast and leave native Desktop Notification off to avoid duplicates.";
        },

        renderOperatorTable: function () {
            const api = pluginHandler.connectedtoast;
            const host = document.getElementById("ct-operator-table");
            host.replaceChildren();
            const config = api.state.data && api.state.data.config;
            if (!config) return;
            const table = document.createElement("table");
            table.className = "ct-table";
            const header = document.createElement("tr");
            for (const text of ["Operator", "State", "Desktop", "Terminal", "Files", "Message"]) {
                const cell = document.createElement("th");
                cell.textContent = text;
                header.appendChild(cell);
            }
            table.appendChild(header);
            for (const operator of api.state.operators) {
                const row = document.createElement("tr");
                const rule = operator.id === api.state.selectedOperatorId
                    ? api.readRule("operator")
                    : (config.operatorRules && config.operatorRules[operator.id]);
                const state = rule ? rule.state : "inherit";
                const effectiveRule = state === "enabled" ? rule : (state === "inherit" ? config.defaultRule : null);
                const values = [
                    operator.realname || operator.name || operator.id,
                    state,
                    effectiveRule && effectiveRule.protocols.desktop ? "ON" : "OFF",
                    effectiveRule && effectiveRule.protocols.terminal ? "ON" : "OFF",
                    effectiveRule && effectiveRule.protocols.files ? "ON" : "OFF",
                    state === "enabled" ? "Custom" : (state === "disabled" ? "Disabled" : "Default")
                ];
                for (const value of values) {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                }
                table.appendChild(row);
            }
            host.appendChild(table);
        },

        refreshRuleVisibility: function () {
            document.getElementById("ct-default-fields").style.display = document.getElementById("ct-default-state").value === "enabled" ? "" : "none";
            document.getElementById("ct-operator-fields").style.display = document.getElementById("ct-operator-state").value === "enabled" ? "" : "none";
            pluginHandler.connectedtoast.renderPreview();
        },

        setStatus: function (text) {
            document.getElementById("ct-status").textContent = String(text || "");
        }
    };
}

module.exports = { createBrowserApi };
