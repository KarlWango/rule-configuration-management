"use strict";
var edaEsbuildExportName = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    about: () => about,
    activate: () => activate,
    exportRuleConfig: () => exportRuleConfig,
    importRuleConfig: () => importRuleConfig,
    netPairRules: () => netPairRules
  });

  // extension.json
  var extension_default = {
    name: "rule-configuration-management",
    uuid: "391ccce5208645c08aca90afcefcf819",
    displayName: "\u89C4\u5219\u914D\u7F6E\u7BA1\u7406",
    description: "\u628A\u5F53\u524D PCB \u7684\u8BBE\u8BA1\u89C4\u5219\u5BFC\u51FA\u6210 JSON\uFF0C\u518D\u8FC1\u79FB\u5230\u5176\u4ED6 PCB\uFF1B\u652F\u6301\u6279\u91CF\u7EF4\u62A4\u7F51\u7EDC\u96C6\u5408\u89C4\u5219\u3002",
    version: "1.0.0",
    publisher: "karl",
    engines: {
      eda: ">=3.2.0"
    },
    license: "Apache-2.0",
    repository: {
      type: "github",
      url: "https://github.com/KarlWango/rule-configuration-management"
    },
    categories: "PCB",
    keywords: [
      "PCB",
      "DRC",
      "Rule"
    ],
    images: {
      logo: "./images/logo.png"
    },
    homepage: "https://github.com/KarlWango/rule-configuration-management",
    bugs: "https://github.com/KarlWango/rule-configuration-management/issues",
    activationEvents: {},
    entry: "./dist/index",
    dependentExtensions: {},
    headerMenus: {
      home: [
        {
          id: "ruleConfigMenuHome",
          title: "\u89C4\u5219\u914D\u7F6E",
          menuItems: [
            {
              id: "AboutHome",
              title: "\u5173\u4E8E\u89C4\u5219\u914D\u7F6E\u7BA1\u7406",
              registerFn: "about"
            }
          ]
        }
      ],
      sch: [
        {
          id: "ruleConfigMenuSch",
          title: "\u89C4\u5219\u914D\u7F6E",
          menuItems: [
            {
              id: "AboutSch",
              title: "\u5173\u4E8E\u89C4\u5219\u914D\u7F6E\u7BA1\u7406",
              registerFn: "about"
            }
          ]
        }
      ],
      pcb: [
        {
          id: "ruleConfigMenuPcb",
          title: "\u89C4\u5219\u914D\u7F6E",
          menuItems: [
            {
              id: "ExportRuleConfig",
              title: "\u5BFC\u51FA\u8BBE\u8BA1\u89C4\u5219\u914D\u7F6E\u2026",
              registerFn: "exportRuleConfig"
            },
            {
              id: "ImportRuleConfig",
              title: "\u5BFC\u5165\u8BBE\u8BA1\u89C4\u5219\u914D\u7F6E\u2026",
              registerFn: "importRuleConfig"
            },
            {
              id: "NetPairRules",
              title: "\u7F51\u7EDC\u96C6\u5408\u89C4\u5219\u2026",
              registerFn: "netPairRules"
            },
            {
              id: "AboutPcb",
              title: "\u5173\u4E8E\u89C4\u5219\u914D\u7F6E\u7BA1\u7406",
              registerFn: "about"
            }
          ]
        }
      ]
    }
  };

  // src/core/eda.ts
  var injected;
  function setEdaApi(instance) {
    injected = instance;
  }
  function resolveEda() {
    if (injected)
      return injected;
    const g = globalThis;
    if (g.eda) {
      injected = g.eda;
      return injected;
    }
    try {
      const found = (0, eval)('typeof eda === "undefined" ? undefined : eda');
      if (found) {
        injected = found;
        return injected;
      }
    } catch {
    }
    return void 0;
  }
  function eda2() {
    const found = resolveEda();
    if (!found)
      throw new Error("EDA API \u4E0D\u53EF\u7528\uFF1A\u672C\u4EE3\u7801\u5FC5\u987B\u5728\u5609\u7ACB\u521BEDA\u6269\u5C55\u8FD0\u884C\u65F6\u4E2D\u6267\u884C");
    return found;
  }
  var drc = () => eda2().pcb_Drc;
  var netApi = () => eda2().pcb_Net;
  var fileSystem = () => eda2().sys_FileSystem;
  function toast(message) {
    try {
      eda2().sys_ToastMessage.showMessage(message);
    } catch {
    }
  }

  // src/core/bridge.ts
  var HOST_KEY = "rcm:host";
  var UI_KEY = "rcm:ui";
  var POLL_MS = 200;
  function store() {
    try {
      return globalThis.localStorage;
    } catch {
      return void 0;
    }
  }
  var Channel = class {
    constructor(onCommand) {
      this.onCommand = onCommand;
    }
    seq = 0;
    lastCommandId = 0;
    timer;
    listener;
    owner = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    pendingHandshake;
    start() {
      const g = globalThis;
      if (typeof g.addEventListener === "function") {
        this.listener = (ev) => {
          if (ev?.key === UI_KEY)
            this.drain();
        };
        g.addEventListener("storage", this.listener);
      }
      this.timer = setInterval(() => this.drain(), POLL_MS);
      this.drain();
    }
    stop() {
      const g = globalThis;
      if (this.timer !== void 0)
        clearInterval(this.timer);
      this.timer = void 0;
      if (this.listener && typeof g.removeEventListener === "function")
        g.removeEventListener("storage", this.listener);
      this.listener = void 0;
    }
    /** 清空两侧信箱：每次打开窗口都从干净状态开始 */
    reset() {
      const s = store();
      try {
        s?.removeItem(HOST_KEY);
        s?.removeItem(UI_KEY);
      } catch {
      }
      this.seq = 0;
      this.lastCommandId = 0;
    }
    drain() {
      const s = store();
      if (!s)
        return;
      let raw = null;
      try {
        raw = s.getItem(UI_KEY);
      } catch {
        return;
      }
      if (!raw)
        return;
      let command;
      try {
        command = JSON.parse(raw);
      } catch {
        return;
      }
      if (!command || typeof command.id !== "number" || command.id <= this.lastCommandId)
        return;
      if (command.type !== "ready" && command.owner !== this.owner)
        return;
      this.lastCommandId = command.id;
      try {
        this.onCommand(command);
      } catch {
      }
    }
    /**
     * 发布界面状态。
     * 必须用 `{ seq, state }` 信封：界面侧按 `msg.state` 取状态、
     * 按外层 `msg.seq` 去重（P-21 回归：早期直接写裸状态对象，界面收到空状态）。
     */
    publish(state) {
      this.seq += 1;
      const handshake = this.pendingHandshake;
      this.pendingHandshake = void 0;
      try {
        store()?.setItem(HOST_KEY, JSON.stringify({ seq: this.seq, state, owner: this.owner, handshake }));
      } catch {
      }
    }
    /** UI 的 ready 携带随机 nonce：下一次 publish 带回该 nonce，UI 据此认主 */
    claim(nonce) {
      this.pendingHandshake = typeof nonce === "string" && nonce ? nonce : void 0;
    }
  };

  // src/core/types.ts
  var ALL_MODULES = [
    "ruleConfig",
    "netRules",
    "netByNetRules",
    "netClasses",
    "differentialPairs",
    "equalLengthGroups"
  ];
  var MODULE_LABELS = {
    ruleConfig: "\u89C4\u5219\u7BA1\u7406",
    netRules: "\u7F51\u7EDC\u89C4\u5219",
    netByNetRules: "\u7F51\u7EDC-\u7F51\u7EDC\u89C4\u5219",
    netClasses: "\u7F51\u7EDC\u7C7B",
    differentialPairs: "\u5DEE\u5206\u5BF9",
    equalLengthGroups: "\u7B49\u957F\u7F51\u7EDC\u7EC4"
  };
  var SCHEMA_ID = "easyeda-eda-rule-config-set";
  var SCHEMA_VERSION = 1;

  // src/core/util.ts
  var MM_PER_MIL = 0.0254;
  var BASE_TOLERANCE_MM = 5e-5;
  var META_KEYS = /* @__PURE__ */ new Set([
    "isRule",
    "categorayKey",
    "redStar",
    "copperRuleName",
    "planeRuleName"
  ]);
  function parseNetList(raw) {
    return String(raw || "").split(/[/,，;；\s]+/).map((item) => item.trim()).filter((item) => item.length > 0);
  }
  function clone(value) {
    return value === void 0 ? value : JSON.parse(JSON.stringify(value));
  }
  function toMm(value, unit) {
    return unit === "mil" ? value * MM_PER_MIL : value;
  }
  function numbersClose(left, right, unit) {
    if (!Number.isFinite(left) || !Number.isFinite(right))
      return left === right;
    const a = toMm(left, unit);
    const b = toMm(right, unit);
    if (a === b)
      return true;
    if (Number(a.toPrecision(12)) === Number(b.toPrecision(12)))
      return true;
    const diff = Math.abs(a - b);
    if (diff <= BASE_TOLERANCE_MM)
      return true;
    const magnitude = Math.max(Math.abs(a), Math.abs(b));
    return magnitude > 1 && diff / magnitude <= 1e-6;
  }
  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }
  function compareValues(path, left, right, unit, out) {
    if (META_KEYS.has(path.split(".").pop() || ""))
      return;
    if (isPlainObject(left) && isPlainObject(right)) {
      const keys = /* @__PURE__ */ new Set([...Object.keys(left), ...Object.keys(right)]);
      for (const key of keys) {
        if (META_KEYS.has(key))
          continue;
        compareValues(path ? `${path}.${key}` : key, left[key], right[key], unit, out);
      }
      return;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        out.push({ path: `${path}.length`, left: left.length, right: right.length });
        return;
      }
      for (let i = 0; i < left.length; i++) compareValues(`${path}[${i}]`, left[i], right[i], unit, out);
      return;
    }
    if (typeof left === "number" && typeof right === "number") {
      if (!numbersClose(left, right, unit))
        out.push({ path, left, right });
      return;
    }
    if (left !== right)
      out.push({ path, left, right });
  }
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function ruleUnit(item) {
    if (isPlainObject(item) && typeof item.unit === "string")
      return item.unit;
    return void 0;
  }
  function detectUnit(config) {
    if (!isPlainObject(config))
      return void 0;
    for (const top of Object.keys(config)) {
      for (const group of Object.keys(config[top] || {})) {
        for (const rule of Object.keys(config[top][group] || {})) {
          const unit = ruleUnit(config[top][group][rule]);
          if (unit)
            return unit;
        }
      }
    }
    return void 0;
  }

  // src/core/collect.ts
  async function safe(key, errors, fn) {
    try {
      return await fn();
    } catch (e) {
      errors[key] = String(e?.message || e);
      return void 0;
    }
  }
  async function collectModules(modules = [...ALL_MODULES]) {
    const errors = {};
    const data = {};
    const api = drc();
    if (modules.includes("ruleConfig")) {
      const cur = await safe("ruleConfig", errors, () => api.getCurrentRuleConfiguration());
      if (cur)
        data.ruleConfig = clone(cur.config ?? cur);
    }
    if (modules.includes("netRules")) {
      const value = await safe("netRules", errors, () => api.getNetRules());
      if (value)
        data.netRules = clone(value);
    }
    if (modules.includes("netByNetRules")) {
      const value = await safe("netByNetRules", errors, () => api.getNetByNetRules());
      if (value)
        data.netByNetRules = clone(value);
    }
    if (modules.includes("netClasses")) {
      const value = await safe("netClasses", errors, () => api.getAllNetClasses());
      if (value)
        data.netClasses = value.map((c) => ({ name: c.name, nets: clone(c.nets || []) }));
    }
    if (modules.includes("differentialPairs")) {
      const value = await safe("differentialPairs", errors, () => api.getAllDifferentialPairs());
      if (value) {
        data.differentialPairs = value.map((p) => ({ name: p.name, positiveNet: p.positiveNet, negativeNet: p.negativeNet }));
      }
    }
    if (modules.includes("equalLengthGroups")) {
      const value = await safe("equalLengthGroups", errors, () => api.getAllEqualLengthNetGroups());
      if (value)
        data.equalLengthGroups = value.map((g) => ({ name: g.name, nets: clone(g.nets || []) }));
    }
    const ruleConfigName = await safe("ruleConfigName", errors, () => api.getCurrentRuleConfigurationName());
    return {
      data,
      errors,
      ruleConfigName: ruleConfigName ?? void 0,
      unit: detectUnit(data.ruleConfig),
      collectedAt: nowIso()
    };
  }
  function buildConfigSet(collected, modules, meta = {}) {
    const data = {};
    for (const key of modules) {
      const value = collected.data[key];
      if (value !== void 0)
        data[key] = clone(value);
    }
    return {
      schema: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      generator: meta.generator || { name: "rule-configuration-management", version: "1.0.0" },
      edaVersion: meta.edaVersion,
      exportedAt: nowIso(),
      source: { pcb: meta.pcbName, unit: collected.unit, ruleConfigName: collected.ruleConfigName },
      modules: [...modules],
      data
    };
  }

  // src/core/netindex.ts
  async function buildNetIndex() {
    let names = [];
    try {
      names = await netApi().getAllNetsName() || [];
    } catch {
      try {
        names = await netApi().getAllNetName() || [];
      } catch {
        names = [];
      }
    }
    const map = /* @__PURE__ */ new Map();
    for (const name of names) map.set(String(name).toLowerCase(), String(name));
    return {
      names,
      has: (name) => map.has(String(name).toLowerCase()),
      real: (name) => map.get(String(name).toLowerCase())
    };
  }
  function filterNets(nets, index) {
    const kept = [];
    const missing = [];
    for (const name of nets || []) {
      const real = index.real(name);
      if (real === void 0)
        missing.push(name);
      else if (!kept.includes(real))
        kept.push(real);
    }
    return { kept, missing };
  }

  // src/core/plan.ts
  function netRuleKey(entry) {
    return `${entry.type}|${String(entry.name).toLowerCase()}`;
  }
  function sameKey(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function describeSetSide(ref, side, refs) {
    if (!ref || ref.type !== "set")
      return String(ref?.name ?? `\u96C6\u5408${side}`);
    return `${ref.name || `\u96C6\u5408${side}`}\uFF08${refs.length} \u4E2A\u7F51\u7EDC\uFF09`;
  }
  function tagSetSource(entry, src) {
    Object.defineProperty(entry, "_src", { value: src, enumerable: false });
    return entry;
  }
  var DERIVED_KEYS = ["sub", "Differential Pair"];
  function mergeNetRuleEntry(base, target) {
    const out = base ? { ...clone(base), ...clone(target) } : clone(target);
    if (base) {
      for (const key of DERIVED_KEYS) {
        if (base[key] !== void 0)
          out[key] = clone(base[key]);
        else delete out[key];
      }
    }
    return out;
  }
  function resolveClasses(file) {
    const fromModule = file.data.netClasses;
    if (fromModule && fromModule.length) {
      return fromModule.map((c) => ({ name: c.name, nets: clone(c.nets || []) }));
    }
    return (file.data.netRules || []).filter((entry) => entry.type === "netClass").map((entry) => ({ name: entry.name, nets: (entry.sub || []).map((s) => s.name) }));
  }
  function resolveGroups(file) {
    const fromModule = file.data.equalLengthGroups;
    if (fromModule && fromModule.length) {
      return fromModule.map((g) => ({ name: g.name, nets: clone(g.nets || []) }));
    }
    return (file.data.netRules || []).filter((entry) => entry.type === "equalLengthGroup").map((entry) => ({ name: entry.name, nets: (entry.sub || []).map((s) => s.name) }));
  }
  function buildPlan(file, current, index, modules, options = {}) {
    const plan = {
      modules,
      netRules: { netEntries: [], memberEntries: [], memberOwner: {}, classEntries: [], groupEntries: [] },
      netClasses: [],
      draftClasses: [],
      differentialPairs: [],
      equalLengthGroups: [],
      netByNetRules: {},
      missingNets: [],
      skipped: []
    };
    const skip = (module, what, reason) => {
      plan.skipped.push({ module, what, reason });
    };
    const miss = (name) => {
      if (!plan.missingNets.includes(name))
        plan.missingNets.push(name);
    };
    if (modules.includes("ruleConfig") && file.data.ruleConfig) {
      const payload = clone(current.ruleConfig || {});
      const targeted = [];
      const fileCfg = file.data.ruleConfig;
      for (const top of Object.keys(fileCfg)) {
        if (!isPlainObject(payload[top]))
          continue;
        for (const group of Object.keys(fileCfg[top] || {})) {
          if (!isPlainObject(payload[top][group]))
            continue;
          payload[top][group] = clone(fileCfg[top][group]);
          targeted.push({ top, group });
        }
      }
      plan.ruleConfig = { payload, targeted };
    }
    const fileNetRules = file.data.netRules || [];
    const classScope = modules.includes("netClasses");
    const groupScope = modules.includes("equalLengthGroups");
    if (options.exact) {
      const exact = { netClasses: {}, equalLengthGroups: {}, differentialPairs: [] };
      if (classScope) {
        for (const cls of resolveClasses(file))
          exact.netClasses[String(cls.name).toLowerCase()] = cls.nets.map(String);
      }
      if (groupScope) {
        for (const group of resolveGroups(file))
          exact.equalLengthGroups[String(group.name).toLowerCase()] = group.nets.map(String);
      }
      if (modules.includes("differentialPairs")) {
        for (const pair of file.data.differentialPairs || [])
          exact.differentialPairs.push(String(pair.name).toLowerCase());
      }
      plan.exact = exact;
    }
    if (classScope) {
      for (const cls of resolveClasses(file)) {
        const { kept, missing } = filterNets(cls.nets, index);
        missing.forEach(miss);
        if (!kept.length) {
          skip("netClasses", `\u7F51\u7EDC\u7C7B ${cls.name}`, `\u6210\u5458\u7F51\u7EDC\u5168\u90E8\u7F3A\u5931\uFF1A${missing.join(", ")}`);
          continue;
        }
        if (missing.length)
          skip("netClasses", `\u7F51\u7EDC\u7C7B ${cls.name}`, `\u8DF3\u8FC7\u7F3A\u5931\u7F51\u7EDC\uFF1A${missing.join(", ")}`);
        plan.netClasses.push({ name: cls.name, nets: kept });
      }
    }
    if (groupScope) {
      for (const group of resolveGroups(file)) {
        const { kept, missing } = filterNets(group.nets, index);
        missing.forEach(miss);
        if (!kept.length) {
          skip("equalLengthGroups", `\u7B49\u957F\u7F51\u7EDC\u7EC4 ${group.name}`, `\u6210\u5458\u7F51\u7EDC\u5168\u90E8\u7F3A\u5931\uFF1A${missing.join(", ")}`);
          continue;
        }
        if (missing.length)
          skip("equalLengthGroups", `\u7B49\u957F\u7F51\u7EDC\u7EC4 ${group.name}`, `\u8DF3\u8FC7\u7F3A\u5931\u7F51\u7EDC\uFF1A${missing.join(", ")}`);
        plan.equalLengthGroups.push({ name: group.name, nets: kept });
      }
    }
    if (modules.includes("differentialPairs")) {
      for (const pair of file.data.differentialPairs || []) {
        const positive = index.real(pair.positiveNet);
        const negative = index.real(pair.negativeNet);
        if (!positive || !negative) {
          const missing = [positive ? null : pair.positiveNet, negative ? null : pair.negativeNet].filter((x) => !!x);
          missing.forEach(miss);
          skip("differentialPairs", `\u5DEE\u5206\u5BF9 ${pair.name}`, `\u6574\u5BF9\u8DF3\u8FC7\uFF08\u7F3A\u5931\u7F51\u7EDC\uFF1A${missing.join(", ")}\uFF09`);
          continue;
        }
        plan.differentialPairs.push({ name: pair.name, positiveNet: positive, negativeNet: negative });
      }
    }
    if (modules.includes("netByNetRules")) {
      const currentClassOwner = /* @__PURE__ */ new Map();
      for (const cls of current.netClasses || []) {
        for (const net of cls.nets || [])
          currentClassOwner.set(String(net).toLowerCase(), String(cls.name));
      }
      if (!currentClassOwner.size) {
        for (const entry of current.netRules || []) {
          if (entry.type !== "netClass")
            continue;
          for (const sub of entry.sub || []) {
            if (sub && sub.name)
              currentClassOwner.set(String(sub.name).toLowerCase(), String(entry.name));
          }
        }
      }
      const planDraftClass = (name, nets) => {
        const conflict = nets.map((net) => ({ net, owner: currentClassOwner.get(net.toLowerCase()) })).find((item) => item.owner && !sameKey(item.owner, name));
        if (conflict) {
          skip("netByNetRules", `\u7F51\u7EDC\u7C7B ${name}`, `\u7F51\u7EDC ${conflict.net} \u5DF2\u5C5E\u4E8E\u7F51\u7EDC\u7C7B\u300C${conflict.owner}\u300D\uFF0C\u65E0\u6CD5\u52A0\u5165\u8BE5\u7F51\u7EDC\u7C7B\uFF1B\u76F8\u5173\u7F51\u7EDC\u5BF9\u6539\u4E3A\u9010\u6761\u5C55\u5F00`);
          return;
        }
        const draftConflict = nets.map((net) => {
          const owner = plan.draftClasses.find((draft2) => !sameKey(draft2.name, name) && draft2.nets.some((item) => sameKey(item, net)));
          return owner ? { net, owner: owner.name } : void 0;
        }).find((item) => !!item);
        if (draftConflict) {
          skip("netByNetRules", `\u7F51\u7EDC\u7C7B ${name}`, `\u7F51\u7EDC ${draftConflict.net} \u5DF2\u5728\u672C\u6279\u9644\u52A0\u89C4\u5219\u4E2D\u52A0\u5165\u7F51\u7EDC\u7C7B\u300C${draftConflict.owner}\u300D\uFF0C\u8BE5\u4FA7\u4E0D\u518D\u5EFA\u7C7B\uFF1B\u76F8\u5173\u7F51\u7EDC\u5BF9\u6539\u4E3A\u9010\u6761\u5C55\u5F00`);
          return;
        }
        let draft = plan.draftClasses.find((item) => sameKey(item.name, name));
        if (!draft) {
          draft = { name, nets: [] };
          plan.draftClasses.push(draft);
        }
        for (const net of nets) {
          if (!draft.nets.some((x) => sameKey(x, net)))
            draft.nets.push(net);
        }
      };
      for (const group of Object.keys(file.data.netByNetRules || {})) {
        for (const entry of file.data.netByNetRules[group]) {
          const isSet = (ref) => !!ref && ref.type === "set";
          const legacy = entry.netClass && typeof entry.netClass === "object" ? entry.netClass.name : void 0;
          if (entry.single && isSet(entry.net1) && isSet(entry.net2)) {
            const sideRef = entry.single === "net1" ? entry.net1 : entry.net2;
            const className = sideRef.className;
            if (className) {
              const kept = filterNets(sideRef.nets, index).kept;
              if (kept.length)
                planDraftClass(className, kept);
              else
                skip("netByNetRules", `\u7F51\u7EDC\u7C7B ${className}`, "\u6210\u5458\u7F51\u7EDC\u5728\u5F53\u524D PCB \u5168\u90E8\u7F3A\u5931");
            }
            continue;
          }
          const leftClass = (isSet(entry.net1) ? entry.net1.className : void 0) || legacy;
          const rightClass = (isSet(entry.net2) ? entry.net2.className : void 0) || legacy;
          if (!leftClass && !rightClass)
            continue;
          const leftNets = isSet(entry.net1) ? filterNets(entry.net1.nets, index).kept : [];
          const rightNets = isSet(entry.net2) ? filterNets(entry.net2.nets, index).kept : [];
          const hasSideClass = isSet(entry.net1) && entry.net1.className || isSet(entry.net2) && entry.net2.className;
          if (legacy && !hasSideClass) {
            const union = [...leftNets];
            for (const net of rightNets) {
              if (!union.some((x) => sameKey(x, net)))
                union.push(net);
            }
            if (leftNets.length && rightNets.length)
              planDraftClass(legacy, union);
            continue;
          }
          if (leftClass && leftNets.length)
            planDraftClass(leftClass, leftNets);
          if (rightClass && rightNets.length)
            planDraftClass(rightClass, rightNets);
        }
      }
    }
    if (modules.includes("netRules")) {
      const liveByKey = new Map((current.netRules || []).map((entry) => [netRuleKey(entry), entry]));
      const fileKeys = /* @__PURE__ */ new Set();
      const plainEntries = /* @__PURE__ */ new Map();
      for (const entry of fileNetRules) {
        if (entry.type !== "net")
          continue;
        const real = index.real(entry.name);
        const key = `net|${String(entry.name).toLowerCase()}`;
        if (!real) {
          miss(entry.name);
          skip("netRules", `\u7F51\u7EDC\u89C4\u5219 ${entry.name}`, "PCB \u4E0A\u4E0D\u5B58\u5728\u8BE5\u7F51\u7EDC");
          continue;
        }
        const realKey = `net|${String(real).toLowerCase()}`;
        plainEntries.set(realKey, mergeNetRuleEntry(liveByKey.get(realKey), { ...clone(entry), name: real }));
        fileKeys.add(key);
      }
      const membership = /* @__PURE__ */ new Map();
      for (const group of plan.equalLengthGroups) {
        for (const net of group.nets) membership.set(net.toLowerCase(), group.name);
      }
      for (const cls of plan.netClasses) {
        for (const net of cls.nets) membership.set(net.toLowerCase(), cls.name);
      }
      for (const draft of plan.draftClasses) {
        for (const net of draft.nets)
          membership.set(net.toLowerCase(), draft.name);
      }
      for (const entry of plainEntries.values()) {
        const lower = String(entry.name).toLowerCase();
        const owner = membership.get(lower);
        if (owner) {
          plan.netRules.memberEntries.push(entry);
          plan.netRules.memberOwner[lower] = owner;
        } else {
          plan.netRules.netEntries.push(entry);
        }
      }
      for (const entry of fileNetRules) {
        if (entry.type === "net")
          continue;
        if (entry.type !== "netClass" && entry.type !== "equalLengthGroup") {
          skip("netRules", `\u7F51\u7EDC\u89C4\u5219 ${entry.name}`, `\u672A\u77E5\u6761\u76EE\u7C7B\u578B ${entry.type}`);
          continue;
        }
        const key = netRuleKey(entry);
        const isClass = entry.type === "netClass";
        const known = isClass ? plan.netClasses.some((cls) => sameKey(cls.name, entry.name)) : plan.equalLengthGroups.some((group) => sameKey(group.name, entry.name));
        if (!known && (isClass ? classScope : groupScope))
          continue;
        if (!known && !liveByKey.has(key)) {
          skip("netRules", `${isClass ? "\u7F51\u7EDC\u7C7B" : "\u7B49\u957F\u7EC4"}\u89C4\u5219 ${entry.name}`, "\u672C\u673A\u4E0D\u5B58\u5728\u8BE5\u5206\u7C7B\uFF0C\u65E0\u6CD5\u65B0\u589E");
          continue;
        }
        const sub = (entry.sub || []).filter((item) => index.has(item.name)).map((item) => {
          const real = index.real(item.name);
          const plain = plainEntries.get(`net|${real.toLowerCase()}`);
          return plain ? mergeNetRuleEntry(item, plain) : { ...clone(item), name: real };
        });
        const merged = mergeNetRuleEntry(liveByKey.get(key), { ...clone(entry), sub });
        if (isClass)
          plan.netRules.classEntries.push(merged);
        else plan.netRules.groupEntries.push(merged);
        fileKeys.add(key);
      }
      for (const entry of current.netRules || []) {
        if (fileKeys.has(netRuleKey(entry)))
          continue;
        if (entry.type === "net") {
          continue;
        }
        const inScope = entry.type === "netClass" ? classScope : groupScope;
        if (inScope) {
          continue;
        }
        if (entry.type === "netClass")
          plan.netRules.classEntries.push(clone(entry));
        else if (entry.type === "equalLengthGroup")
          plan.netRules.groupEntries.push(clone(entry));
      }
    }
    if (modules.includes("netByNetRules")) {
      const currentGroups = current.netByNetRules || {};
      const fileGroups = file.data.netByNetRules || {};
      const allGroups = /* @__PURE__ */ new Set([...Object.keys(currentGroups), ...Object.keys(fileGroups)]);
      const classNames = /* @__PURE__ */ new Set([
        ...plan.netClasses.map((cls) => cls.name),
        ...(current.netRules || []).filter((entry) => entry.type === "netClass").map((entry) => entry.name),
        ...plan.draftClasses.map((draft) => draft.name)
      ]);
      const resolveRef = (ref) => {
        if (!ref || !ref.name)
          return void 0;
        if (ref.type === "net")
          return index.real(ref.name);
        if (ref.type === "netClass")
          return classNames.has(ref.name) ? ref.name : void 0;
        return index.real(ref.name);
      };
      const resolveSet = (ref) => {
        const { kept, missing } = filterNets(ref?.nets || [], index);
        if (missing.length) {
          const label = ref?.name ? `\u96C6\u5408 ${ref.name}` : "\u7F51\u7EDC\u96C6\u5408";
          skip("netByNetRules", label, `\u8DF3\u8FC7\u7F3A\u5931\u7F51\u7EDC\uFF1A${missing.join(", ")}`);
        }
        return kept;
      };
      const groupRuleKeys = (group) => {
        const keys = /* @__PURE__ */ new Set();
        let found = false;
        const collect = (cfg) => {
          for (const top of Object.keys(cfg || {})) {
            const groupCfg = (cfg || {})[top]?.[group];
            if (isPlainObject(groupCfg)) {
              for (const key of Object.keys(groupCfg))
                keys.add(key.toLowerCase());
              found = true;
            }
          }
        };
        collect(current.ruleConfig);
        if (modules.includes("ruleConfig"))
          collect(file.data.ruleConfig);
        if (!found)
          return void 0;
        return keys;
      };
      const unknownRuleNoted = /* @__PURE__ */ new Set();
      for (const group of allGroups) {
        const fileList = fileGroups[group];
        if (!fileList) {
          plan.netByNetRules[group] = clone(currentGroups[group] || []);
          continue;
        }
        const out = [];
        const knownRules = groupRuleKeys(group);
        const isPlannedClass = (name) => plan.draftClasses.some((draft) => sameKey(draft.name, name));
        for (const entry of fileList) {
          const isSet = (ref) => !!ref && ref.type === "set";
          const leftRefs = isSet(entry.net1) ? resolveSet(entry.net1) : [resolveRef(entry.net1)].filter((x) => !!x);
          const rightRefs = isSet(entry.net2) ? resolveSet(entry.net2) : [resolveRef(entry.net2)].filter((x) => !!x);
          const label = `${isSet(entry.net1) ? entry.net1.name || "\u96C6\u5408A" : entry.net1?.name} \u2194 ${isSet(entry.net2) ? entry.net2.name || "\u96C6\u5408B" : entry.net2?.name}`;
          if (entry.single)
            continue;
          if (knownRules && !knownRules.has(String(entry.rule ?? "").toLowerCase())) {
            const ruleName = String(entry.rule ?? "");
            const noteKey = `${group}|${ruleName.toLowerCase()}`;
            if (!unknownRuleNoted.has(noteKey)) {
              unknownRuleNoted.add(noteKey);
              skip("netByNetRules", `\u5206\u7EC4 ${group} \u7684\u89C4\u5219\u300C${ruleName}\u300D`, "\u89C4\u5219\u7BA1\u7406\u4E2D\u4E0D\u5B58\u5728\u8BE5\u89C4\u5219\uFF08\u5BFC\u5165\u540E\u4F1A\u53D8\u6210\u9ED8\u8BA4\u89C4\u5219\uFF09\uFF0C\u8BF7\u5148\u5728\u89C4\u5219\u7BA1\u7406\u4E2D\u521B\u5EFA\u540C\u540D\u89C4\u5219");
            }
            continue;
          }
          if (!leftRefs.length || !rightRefs.length) {
            const names = [
              ...leftRefs.length ? [] : [isSet(entry.net1) ? entry.net1.name || "\u96C6\u5408A" : entry.net1?.name],
              ...rightRefs.length ? [] : [isSet(entry.net2) ? entry.net2.name || "\u96C6\u5408B" : entry.net2?.name]
            ].filter((x) => !!x);
            skip("netByNetRules", label, `\u5F15\u7528\u7684\u7F51\u7EDC/\u7F51\u7EDC\u7C7B\u4E0D\u5B58\u5728\u6216\u4E3A\u7A7A\uFF1A${names.join(", ")}`);
            continue;
          }
          const legacyClass = entry.netClass && typeof entry.netClass === "object" && entry.netClass.name ? entry.netClass.name : void 0;
          const leftClass = (isSet(entry.net1) ? entry.net1.className : void 0) || legacyClass;
          const rightClass = (isSet(entry.net2) ? entry.net2.className : void 0) || legacyClass;
          if (leftClass || rightClass) {
            const leftIsClass = !!leftClass && isPlannedClass(leftClass);
            const rightIsClass = !!rightClass && isPlannedClass(rightClass);
            if (leftIsClass && rightIsClass) {
              out.push({
                net1: { type: "netClass", name: leftClass },
                net2: { type: "netClass", name: rightClass },
                rule: entry.rule
              });
              continue;
            }
            if (leftIsClass) {
              for (const right of rightRefs) {
                out.push(tagSetSource({ net1: { type: "netClass", name: leftClass }, net2: { type: "net", name: right }, rule: entry.rule }, {
                  label: `${leftClass} \u2194 ${describeSetSide(entry.net2, "B", rightRefs)}`,
                  bNets: isSet(entry.net2) ? rightRefs : void 0
                }));
              }
              continue;
            }
            if (rightIsClass) {
              for (const left of leftRefs) {
                out.push(tagSetSource({ net1: { type: "net", name: left }, net2: { type: "netClass", name: rightClass }, rule: entry.rule }, {
                  label: `${describeSetSide(entry.net1, "A", leftRefs)} \u2194 ${rightClass}`,
                  aNets: isSet(entry.net1) ? leftRefs : void 0
                }));
              }
              continue;
            }
          }
          const hasSetRef = isSet(entry.net1) || isSet(entry.net2);
          const srcLabel = hasSetRef ? `${describeSetSide(entry.net1, "A", leftRefs)} \u2194 ${describeSetSide(entry.net2, "B", rightRefs)}` : void 0;
          const srcMembers = hasSetRef ? {
            aNets: isSet(entry.net1) ? leftRefs : void 0,
            bNets: isSet(entry.net2) ? rightRefs : void 0
          } : void 0;
          for (const left of leftRefs) {
            for (const right of rightRefs) {
              const pair = {
                net1: isSet(entry.net1) ? { type: "net", name: left } : { ...clone(entry.net1), name: left },
                net2: isSet(entry.net2) ? { type: "net", name: right } : { ...clone(entry.net2), name: right },
                rule: entry.rule
              };
              if (srcLabel)
                tagSetSource(pair, { label: srcLabel, ...srcMembers });
              out.push(pair);
            }
          }
        }
        const pairKeyOf = (entry) => [String(entry.net1?.name ?? "").toLowerCase(), String(entry.net2?.name ?? "").toLowerCase()].sort().join("|");
        const lastIndexOfPair = /* @__PURE__ */ new Map();
        for (let index2 = 0; index2 < out.length; index2++)
          lastIndexOfPair.set(pairKeyOf(out[index2]), index2);
        if (lastIndexOfPair.size !== out.length) {
          const kept = out.filter((entry, index2) => lastIndexOfPair.get(pairKeyOf(entry)) === index2);
          for (let index2 = 0; index2 < out.length; index2++) {
            const entry = out[index2];
            const lastIndex = lastIndexOfPair.get(pairKeyOf(entry));
            if (lastIndex === void 0 || lastIndex === index2)
              continue;
            const finalEntry = out[lastIndex];
            if (String(finalEntry.rule) !== String(entry.rule)) {
              skip("netByNetRules", `\u7F51\u7EDC\u5BF9 ${group} \xB7 ${entry.net1.name} \u2194 ${entry.net2.name}`, `\u88AB\u591A\u6761\u96C6\u5408/\u6761\u76EE\u5B9A\u4E49\u5206\u914D\u4E86\u4E0D\u540C\u89C4\u5219\uFF08${entry.rule}\u3001${finalEntry.rule}\uFF09\uFF0C\u6309\u7F16\u8F91\u5668\u8BED\u4E49\u4FDD\u7559\u540E\u9762\u7684\u300C${finalEntry.rule}\u300D`);
            }
          }
          plan.netByNetRules[group] = kept;
        } else {
          plan.netByNetRules[group] = out;
        }
      }
    }
    return plan;
  }

  // src/core/diff.ts
  function emptySummary() {
    return { added: 0, modified: 0, removed: 0, kept: 0, skipped: 0, unsupported: 0 };
  }
  function sameName(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function sameStringSet(a, b) {
    if (a.length !== b.length)
      return false;
    const set = new Set(b.map((x) => x.toLowerCase()));
    return a.every((x) => set.has(x.toLowerCase()));
  }
  function diffPlan(plan, current) {
    const entries = [];
    const warnings = [];
    const add = (entry) => {
      entries.push(entry);
    };
    if (plan.ruleConfig) {
      const currentCfg = current.ruleConfig || {};
      for (const { top, group } of plan.ruleConfig.targeted) {
        const target = plan.ruleConfig.payload[top][group] || {};
        const present = (currentCfg[top] || {})[group] || {};
        for (const rule of Object.keys(target)) {
          const path = `${top} / ${group} / ${rule}`;
          if (!(rule in present)) {
            add({ module: "ruleConfig", kind: "added", path });
            continue;
          }
          const fields = [];
          compareValues("", target[rule], present[rule], ruleUnit(target[rule]) ?? ruleUnit(present[rule]), fields);
          if (fields.length)
            add({ module: "ruleConfig", kind: "modified", path, fields });
        }
        for (const rule of Object.keys(present)) {
          if (!(rule in target))
            add({ module: "ruleConfig", kind: "removed", path: `${top} / ${group} / ${rule}`, note: "\u5C06\u968F\u5206\u7EC4\u8986\u76D6\u88AB\u5220\u9664" });
        }
      }
    }
    if (plan.modules.includes("netRules")) {
      const currentMap = new Map((current.netRules || []).map((entry) => [netRuleKey(entry), entry]));
      const compareEntry = (entry, label) => {
        const present = currentMap.get(netRuleKey(entry));
        if (!present) {
          add({ module: "netRules", kind: "added", path: label });
          return;
        }
        const fields = [];
        compareValues("", entry, present, void 0, fields);
        if (fields.length)
          add({ module: "netRules", kind: "modified", path: label, fields });
      };
      for (const entry of plan.netRules.netEntries) compareEntry(entry, `\u7F51\u7EDC\u89C4\u5219 ${entry.name}`);
      for (const entry of plan.netRules.classEntries) compareEntry(entry, `\u7F51\u7EDC\u7C7B\u89C4\u5219 ${entry.name}`);
      for (const entry of plan.netRules.groupEntries) compareEntry(entry, `\u7B49\u957F\u7EC4\u89C4\u5219 ${entry.name}`);
      for (const entry of plan.netRules.memberEntries) {
        const owner = plan.netRules.memberOwner[String(entry.name).toLowerCase()] || "";
        add({ module: "netRules", kind: "kept", path: `\u7F51\u7EDC\u89C4\u5219 ${entry.name}`, note: `\u8BE5\u7F51\u7EDC\u5C5E\u4E8E\u300C${owner}\u300D\uFF0C\u89C4\u5219\u5C06\u5E76\u5165\u8BE5\u6761\u76EE\u7684\u6210\u5458\u5217\u8868` });
      }
    }
    if (plan.modules.includes("netClasses")) {
      const currentClasses = current.netClasses || [];
      for (const cls of plan.netClasses) {
        const present = currentClasses.find((c) => sameName(c.name, cls.name));
        if (!present) {
          add({ module: "netClasses", kind: "added", path: `\u7F51\u7EDC\u7C7B ${cls.name}`, note: `\u6210\u5458\uFF1A${cls.nets.join(", ")}` });
        } else if (!sameStringSet(cls.nets, present.nets)) {
          const toAdd = cls.nets.filter((net) => !(present.nets || []).some((x) => sameName(x, net)));
          const keptMembers = (present.nets || []).filter((net) => !cls.nets.some((x) => sameName(x, net)));
          const note = [
            toAdd.length ? `\u65B0\u589E\u6210\u5458\uFF1A${toAdd.join(", ")}` : "",
            keptMembers.length ? `\u672C\u673A\u591A\u51FA\u7684\u6210\u5458\u4FDD\u7559\uFF1A${keptMembers.join(", ")}` : ""
          ].filter(Boolean).join("\uFF1B");
          if (note)
            add({ module: "netClasses", kind: "modified", path: `\u7F51\u7EDC\u7C7B ${cls.name}`, note });
          if (keptMembers.length)
            warnings.push(`\u7F51\u7EDC\u7C7B\u300C${cls.name}\u300D\u91CC\u672C\u673A\u591A\u51FA\u7684\u6210\u5458\uFF08${keptMembers.join(", ")}\uFF09\u6309\u89C4\u5219\u4E0D\u79FB\u51FA\u8BE5\u7C7B\u3002`);
        }
      }
    }
    for (const cls of plan.draftClasses) {
      const present = (current.netClasses || []).find((c) => sameName(c.name, cls.name));
      if (!present) {
        add({ module: "netClasses", kind: "added", path: `\u7F51\u7EDC\u7C7B ${cls.name}`, note: `\u6210\u5458\uFF1A${cls.nets.join(", ")}\uFF08\u9644\u52A0\u7F51\u7EDC\u5BF9\u8349\u7A3F\uFF09` });
      } else {
        const toAdd = cls.nets.filter((net) => !(present.nets || []).some((x) => sameName(x, net)));
        if (toAdd.length)
          add({ module: "netClasses", kind: "modified", path: `\u7F51\u7EDC\u7C7B ${cls.name}`, note: `\u65B0\u589E\u6210\u5458\uFF1A${toAdd.join(", ")}\uFF08\u9644\u52A0\u7F51\u7EDC\u5BF9\u8349\u7A3F\uFF09` });
      }
    }
    if (plan.modules.includes("differentialPairs")) {
      const currentPairs = current.differentialPairs || [];
      for (const pair of plan.differentialPairs) {
        const present = currentPairs.find((p) => sameName(p.name, pair.name));
        if (!present) {
          add({ module: "differentialPairs", kind: "added", path: `\u5DEE\u5206\u5BF9 ${pair.name}`, note: `${pair.positiveNet} / ${pair.negativeNet}` });
        } else if (!sameName(present.positiveNet, pair.positiveNet) || !sameName(present.negativeNet, pair.negativeNet)) {
          add({ module: "differentialPairs", kind: "modified", path: `\u5DEE\u5206\u5BF9 ${pair.name}`, note: `${present.positiveNet}/${present.negativeNet} \u2192 ${pair.positiveNet}/${pair.negativeNet}\uFF08\u53EA\u6539\u7F51\u7EDC\uFF0C\u4E0D\u5220\u9664\u91CD\u5EFA\uFF09` });
        }
      }
    }
    if (plan.modules.includes("equalLengthGroups")) {
      const currentGroups = current.equalLengthGroups || [];
      for (const group of plan.equalLengthGroups) {
        const present = currentGroups.find((g) => sameName(g.name, group.name));
        if (!present) {
          add({ module: "equalLengthGroups", kind: "added", path: `\u7B49\u957F\u7F51\u7EDC\u7EC4 ${group.name}`, note: `\u6210\u5458\uFF1A${group.nets.join(", ")}` });
        } else if (!sameStringSet(group.nets, present.nets)) {
          const toAdd = group.nets.filter((net) => !(present.nets || []).some((x) => sameName(x, net)));
          const keptMembers = (present.nets || []).filter((net) => !group.nets.some((x) => sameName(x, net)));
          const note = [
            toAdd.length ? `\u65B0\u589E\u6210\u5458\uFF1A${toAdd.join(", ")}` : "",
            keptMembers.length ? `\u672C\u673A\u591A\u51FA\u7684\u6210\u5458\u4FDD\u7559\uFF1A${keptMembers.join(", ")}` : ""
          ].filter(Boolean).join("\uFF1B");
          if (note)
            add({ module: "equalLengthGroups", kind: "modified", path: `\u7B49\u957F\u7F51\u7EDC\u7EC4 ${group.name}`, note });
          if (keptMembers.length)
            warnings.push(`\u7B49\u957F\u7F51\u7EDC\u7EC4\u300C${group.name}\u300D\u91CC\u672C\u673A\u591A\u51FA\u7684\u6210\u5458\uFF08${keptMembers.join(", ")}\uFF09\u6309\u89C4\u5219\u4E0D\u79FB\u51FA\u8BE5\u7EC4\u3002`);
        }
      }
    }
    if (plan.modules.includes("netByNetRules")) {
      const currentGroups = current.netByNetRules || {};
      const keyOf = (entry) => `${String(entry.net1?.name).toLowerCase()}|${String(entry.net2?.name).toLowerCase()}`;
      const srcBuckets = /* @__PURE__ */ new Map();
      const bucketKey = (group, kind, src) => `${group}|${kind}|${src.label}`;
      const sourceDetail = (src) => {
        const lines = [];
        if (src.aNets)
          lines.push(`\u96C6\u5408A\u6210\u5458\uFF08${src.aNets.length}\uFF09\uFF1A${src.aNets.join(", ")}`);
        if (src.bNets)
          lines.push(`\u96C6\u5408B\u6210\u5458\uFF08${src.bNets.length}\uFF09\uFF1A${src.bNets.join(", ")}`);
        return lines;
      };
      for (const group of Object.keys(plan.netByNetRules)) {
        const target = plan.netByNetRules[group] || [];
        const present = currentGroups[group] || [];
        if (!(group in currentGroups)) {
          if (target.length)
            add({ module: "netByNetRules", kind: "added", path: `${group} (${target.length} \u6761)` });
          continue;
        }
        const presentMap = new Map(present.map((entry) => [keyOf(entry), entry]));
        const targetKeys = new Set(target.map((entry) => keyOf(entry)));
        for (const entry of target) {
          const label = `${group} \xB7 ${entry.net1.name} \u2194 ${entry.net2.name}`;
          const src = entry._src;
          const hit = presentMap.get(keyOf(entry));
          if (!hit) {
            if (src) {
              const key = bucketKey(group, "added", src);
              const bucket = srcBuckets.get(key);
              if (bucket)
                bucket.count += 1;
              else
                srcBuckets.set(key, { kind: "added", group, src: src.label, rule: entry.rule, count: 1, detail: sourceDetail(src) });
            } else {
              add({ module: "netByNetRules", kind: "added", path: label, note: `\u89C4\u5219\uFF1A${entry.rule}` });
            }
          } else if (hit.rule !== entry.rule) {
            if (src) {
              const key = bucketKey(group, "modified", src);
              const bucket = srcBuckets.get(key);
              if (bucket)
                bucket.count += 1;
              else
                srcBuckets.set(key, { kind: "modified", group, src: src.label, firstNote: `${hit.rule} \u2192 ${entry.rule}`, count: 1, detail: sourceDetail(src) });
            } else {
              add({ module: "netByNetRules", kind: "modified", path: label, note: `${hit.rule} \u2192 ${entry.rule}` });
            }
          }
        }
        for (const entry of present) {
          if (!targetKeys.has(keyOf(entry))) {
            add({ module: "netByNetRules", kind: "removed", path: `${group} \xB7 ${entry.net1.name} \u2194 ${entry.net2.name}`, note: "\u5C06\u5220\u9664\u8BE5\u6761\u76EE" });
          }
        }
        for (const bucket of srcBuckets.values()) {
          add({
            module: "netByNetRules",
            kind: bucket.kind,
            path: `${bucket.group} \xB7 ${bucket.src}`,
            note: bucket.kind === "added" ? `\u89C4\u5219\uFF1A${bucket.rule}\uFF08\u5C55\u5F00 ${bucket.count} \u5BF9\uFF09` : `\u89C4\u5219\uFF1A${bucket.firstNote}${bucket.count > 1 ? ` \u7B49\uFF08\u5171 ${bucket.count} \u5BF9\uFF09` : ""}`,
            detail: bucket.detail.length ? bucket.detail : void 0
          });
        }
        srcBuckets.clear();
      }
    }
    for (const item of plan.skipped) {
      add({ module: item.module, kind: "skipped", path: item.what, note: item.reason });
    }
    const summary = emptySummary();
    for (const entry of entries) summary[entry.kind] += 1;
    return { entries, summary, warnings, skipped: plan.skipped };
  }

  // src/core/apply.ts
  var SILENTLY_IGNORED = "\u63A5\u53E3\u8FD4\u56DE undefined\uFF1A\u8F7D\u8377\u88AB\u9759\u9ED8\u5FFD\u7565\uFF08\u901A\u5E38\u7F3A\u5C11\u5FC5\u9700\u7684\u9876\u5C42\u952E\u6216\u7ED3\u6784\u4E0D\u7B26\uFF09";
  function sameName2(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  async function readNetRules() {
    try {
      return await drc().getNetRules() || [];
    } catch {
      return [];
    }
  }
  function stripDerived(entry) {
    const copy = clone(entry);
    delete copy["Differential Pair"];
    return copy;
  }
  async function verifyNetRuleEntries(expected) {
    const current = await readNetRules();
    const map = new Map(current.map((entry) => [netRuleKey(entry), entry]));
    const diffs = [];
    for (const entry of expected) {
      const present = map.get(netRuleKey(entry));
      if (!present) {
        diffs.push({ path: `${entry.type}|${entry.name}`, left: "\u5B58\u5728", right: "\u7F3A\u5931" });
        continue;
      }
      const local = [];
      compareValues("", stripDerived(entry), stripDerived(present), void 0, local);
      for (const item of local) diffs.push({ ...item, path: `${entry.name}.${item.path}` });
    }
    return { ok: diffs.length === 0, diffs };
  }
  function buildNetRulesPayload(plan, live) {
    const memberByNet = /* @__PURE__ */ new Map();
    for (const entry of plan.netRules.memberEntries) memberByNet.set(String(entry.name).toLowerCase(), entry);
    const ownerOf = plan.netRules.memberOwner;
    const payload = [];
    const indexByKey = /* @__PURE__ */ new Map();
    const put = (entry) => {
      indexByKey.set(netRuleKey(entry), payload.length);
      payload.push(entry);
    };
    for (const entry of live) {
      if (entry.type === "netClass" || entry.type === "equalLengthGroup") {
        const sub = (entry.sub || []).map((item) => {
          const lower = String(item.name).toLowerCase();
          const override = ownerOf[lower] && sameName2(ownerOf[lower], entry.name) ? memberByNet.get(lower) : void 0;
          return override ? mergeNetRuleEntry(item, override) : clone(item);
        });
        put({ ...clone(entry), sub });
      } else {
        put(clone(entry));
      }
    }
    const targets = [...plan.netRules.netEntries, ...plan.netRules.classEntries, ...plan.netRules.groupEntries];
    for (const target of targets) {
      const key = netRuleKey(target);
      const at = indexByKey.get(key);
      if (at === void 0) {
        indexByKey.set(key, payload.length);
        payload.push(mergeNetRuleEntry(void 0, target));
      } else {
        payload[at] = mergeNetRuleEntry(payload[at], target);
      }
    }
    return payload;
  }
  async function applyPlan(plan, options = {}) {
    const api = drc();
    const steps = [];
    const push = (step) => {
      steps.push(step);
    };
    if (plan.ruleConfig) {
      const step = { name: "ruleConfig", label: "\u89C4\u5219\u7BA1\u7406", ok: true };
      try {
        const returned = await api.overwriteCurrentRuleConfiguration(plan.ruleConfig.payload);
        step.returned = returned;
        if (typeof returned === "undefined") {
          step.ok = false;
          step.error = SILENTLY_IGNORED;
        } else {
          const after = await api.getCurrentRuleConfiguration();
          const cfg = after && (after.config ?? after) || {};
          const diffs = [];
          for (const { top, group } of plan.ruleConfig.targeted) {
            const target = plan.ruleConfig.payload[top][group] || {};
            const present = (cfg[top] || {})[group] || {};
            for (const rule of Object.keys(target)) {
              const local = [];
              compareValues("", target[rule], present[rule], void 0, local);
              if (!(rule in present))
                local.push({ path: rule, left: "\u5B58\u5728", right: "\u7F3A\u5931" });
              for (const item of local) diffs.push({ ...item, path: `${top} / ${group} / ${rule}${item.path ? `.${item.path}` : ""}` });
            }
          }
          step.verified = diffs.length === 0;
          step.detail = diffs.slice(0, 20);
          if (diffs.length) {
            step.ok = false;
            step.error = "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7";
          }
        }
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    if (options.deleteClasses && options.deleteClasses.length) {
      const step = { name: "deleteDraftClasses", label: "\u6E05\u7406\u8349\u7A3F\u7F51\u7EDC\u7C7B", ok: true, detail: [] };
      try {
        const detail = [];
        for (const name of options.deleteClasses)
          detail.push({ action: "delete", name, ok: await api.deleteNetClass(name) });
        step.detail = detail;
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    if (plan.modules.includes("netClasses")) {
      const step = { name: "netClasses", label: "\u7F51\u7EDC\u7C7B", ok: true, detail: [] };
      try {
        const current = await api.getAllNetClasses() || [];
        const detail = [];
        for (const cls of current) {
          const declared = plan.exact ? plan.exact.netClasses[String(cls.name).toLowerCase()] : void 0;
          if (plan.exact && declared === void 0) {
            detail.push(typeof api.deleteNetClass === "function" ? { action: "delete", name: cls.name, ok: await api.deleteNetClass(cls.name) } : { action: "unsupported", name: cls.name, note: "\u5F53\u524D EDA \u7248\u672C\u7F3A\u5C11\u5220\u9664\u7F51\u7EDC\u7C7B\u7684\u63A5\u53E3\uFF0C\u4FDD\u7559\u672C\u673A\u5BF9\u8C61" });
            continue;
          }
          if (plan.exact && declared) {
            const extra = (cls.nets || []).filter((net) => !declared.some((x) => sameName2(x, net)));
            if (extra.length)
              detail.push({ action: "removeNet", name: cls.name, nets: extra, ok: await api.removeNetFromNetClass(cls.name, extra) });
            continue;
          }
          if (!plan.netClasses.some((target) => sameName2(target.name, cls.name)))
            detail.push({ action: "keep", name: cls.name, ok: true });
        }
        for (const target of plan.netClasses) {
          const present = current.find((cls) => sameName2(cls.name, target.name));
          if (!present) {
            detail.push({ action: "create", name: target.name, nets: target.nets, ok: await api.createNetClass(target.name, target.nets, null) });
            continue;
          }
          const presentNets = present.nets || [];
          const toAdd = target.nets.filter((net) => !presentNets.some((x) => sameName2(x, net)));
          if (toAdd.length)
            detail.push({ action: "addNet", name: target.name, nets: toAdd, ok: await api.addNetToNetClass(target.name, toAdd) });
        }
        step.detail = detail;
        const after = await api.getAllNetClasses() || [];
        const targetsMatch = (list) => plan.netClasses.every((target) => {
          const present = list.find((cls) => sameName2(cls.name, target.name));
          return !!present && target.nets.length === (present.nets || []).length && target.nets.every((net) => present.nets.some((x) => sameName2(x, net)));
        });
        const ok = plan.exact ? after.every((cls) => plan.exact.netClasses[String(cls.name).toLowerCase()] !== void 0) && targetsMatch(after) : after.length >= plan.netClasses.length && targetsMatch(after);
        step.verified = ok;
        if (!ok) {
          step.ok = false;
          step.error = "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7";
        }
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    if (plan.draftClasses.length) {
      const step = { name: "draftClasses", label: "\u7F51\u7EDC\u7C7B\uFF08\u9644\u52A0\u7F51\u7EDC\u96C6\u5408\u8349\u7A3F\uFF09", ok: true, detail: [] };
      try {
        const detail = [];
        const classes = await api.getAllNetClasses() || [];
        for (const draft of plan.draftClasses) {
          const present = classes.find((cls) => sameName2(cls.name, draft.name));
          if (!present) {
            detail.push({ action: "createDraftClass", name: draft.name, nets: draft.nets, ok: await api.createNetClass(draft.name, draft.nets, null) });
            continue;
          }
          const presentNets = present.nets || [];
          const toAdd = draft.nets.filter((net) => !presentNets.some((x) => sameName2(x, net)));
          if (toAdd.length)
            detail.push({ action: "addDraftNet", name: draft.name, nets: toAdd, ok: await api.addNetToNetClass(draft.name, toAdd) });
        }
        step.detail = detail;
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    if (plan.modules.includes("equalLengthGroups")) {
      const step = { name: "equalLengthGroups", label: "\u7B49\u957F\u7F51\u7EDC\u7EC4", ok: true, detail: [] };
      try {
        const current = await api.getAllEqualLengthNetGroups() || [];
        const detail = [];
        for (const group of current) {
          const declared = plan.exact ? plan.exact.equalLengthGroups[String(group.name).toLowerCase()] : void 0;
          if (plan.exact && declared === void 0) {
            detail.push(typeof api.deleteEqualLengthNetGroup === "function" ? { action: "delete", name: group.name, ok: await api.deleteEqualLengthNetGroup(group.name) } : { action: "unsupported", name: group.name, note: "\u5F53\u524D EDA \u7248\u672C\u7F3A\u5C11\u5220\u9664\u7B49\u957F\u7F51\u7EDC\u7EC4\u7684\u63A5\u53E3\uFF0C\u4FDD\u7559\u672C\u673A\u5BF9\u8C61" });
            continue;
          }
          if (plan.exact && declared) {
            const extra = (group.nets || []).filter((net) => !declared.some((x) => sameName2(x, net)));
            if (extra.length)
              detail.push({ action: "removeNet", name: group.name, nets: extra, ok: await api.removeNetFromEqualLengthNetGroup(group.name, extra) });
            continue;
          }
          if (!plan.equalLengthGroups.some((target) => sameName2(target.name, group.name)))
            detail.push({ action: "keep", name: group.name, ok: true });
        }
        for (const target of plan.equalLengthGroups) {
          const present = current.find((group) => sameName2(group.name, target.name));
          if (!present) {
            detail.push({ action: "create", name: target.name, nets: target.nets, ok: await api.createEqualLengthNetGroup(target.name, target.nets, null) });
            continue;
          }
          const presentNets = present.nets || [];
          const toAdd = target.nets.filter((net) => !presentNets.some((x) => sameName2(x, net)));
          if (toAdd.length)
            detail.push({ action: "addNet", name: target.name, nets: toAdd, ok: await api.addNetToEqualLengthNetGroup(target.name, toAdd) });
        }
        step.detail = detail;
        const after = await api.getAllEqualLengthNetGroups() || [];
        const groupsMatch = (list) => plan.equalLengthGroups.every((target) => {
          const present = list.find((group) => sameName2(group.name, target.name));
          return !!present && target.nets.length === (present.nets || []).length && target.nets.every((net) => present.nets.some((x) => sameName2(x, net)));
        });
        const ok = plan.exact ? after.every((group) => plan.exact.equalLengthGroups[String(group.name).toLowerCase()] !== void 0) && groupsMatch(after) : after.length >= plan.equalLengthGroups.length && groupsMatch(after);
        step.verified = ok;
        if (!ok) {
          step.ok = false;
          step.error = "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7";
        }
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    if (plan.modules.includes("differentialPairs")) {
      const step = { name: "differentialPairs", label: "\u5DEE\u5206\u5BF9", ok: true, detail: [] };
      try {
        const current = await api.getAllDifferentialPairs() || [];
        const detail = [];
        for (const pair of current) {
          if (plan.exact && !plan.exact.differentialPairs.includes(String(pair.name).toLowerCase())) {
            detail.push(typeof api.deleteDifferentialPair === "function" ? { action: "delete", name: pair.name, ok: await api.deleteDifferentialPair(pair.name) } : { action: "unsupported", name: pair.name, note: "\u5F53\u524D EDA \u7248\u672C\u7F3A\u5C11\u5220\u9664\u5DEE\u5206\u5BF9\u7684\u63A5\u53E3\uFF0C\u4FDD\u7559\u672C\u673A\u5BF9\u8C61" });
            continue;
          }
          if (!plan.differentialPairs.some((target) => sameName2(target.name, pair.name)))
            detail.push({ action: "keep", name: pair.name, ok: true });
        }
        for (const target of plan.differentialPairs) {
          const present = current.find((pair) => sameName2(pair.name, target.name));
          if (!present) {
            detail.push({ action: "create", name: target.name, ok: await api.createDifferentialPair(target.name, target.positiveNet, target.negativeNet) });
            continue;
          }
          const netChanged = !sameName2(present.positiveNet, target.positiveNet) || !sameName2(present.negativeNet, target.negativeNet);
          if (!netChanged)
            continue;
          const canModify = typeof api.modifyDifferentialPairPositiveNet === "function" && typeof api.modifyDifferentialPairNegativeNet === "function";
          if (!canModify) {
            detail.push({ action: "unsupported", name: target.name, note: "\u5F53\u524D EDA \u7248\u672C\u7F3A\u5C11\u4FEE\u6539\u5DEE\u5206\u5BF9\u7F51\u7EDC\u7684\u63A5\u53E3\uFF0C\u4FDD\u7559\u672C\u673A\u539F\u503C" });
            continue;
          }
          if (!sameName2(present.positiveNet, target.positiveNet))
            detail.push({ action: "modifyPositiveNet", name: target.name, net: target.positiveNet, ok: await api.modifyDifferentialPairPositiveNet(target.name, target.positiveNet) });
          if (!sameName2(present.negativeNet, target.negativeNet))
            detail.push({ action: "modifyNegativeNet", name: target.name, net: target.negativeNet, ok: await api.modifyDifferentialPairNegativeNet(target.name, target.negativeNet) });
        }
        step.detail = detail;
        const after = await api.getAllDifferentialPairs() || [];
        const pairsMatch = (list) => plan.differentialPairs.every((target) => {
          const present = list.find((pair) => sameName2(pair.name, target.name));
          return !!present && sameName2(present.positiveNet, target.positiveNet) && sameName2(present.negativeNet, target.negativeNet);
        });
        const ok = plan.exact ? after.every((pair) => plan.exact.differentialPairs.includes(String(pair.name).toLowerCase())) && pairsMatch(after) : after.length >= plan.differentialPairs.length && pairsMatch(after);
        step.verified = ok;
        if (!ok) {
          step.ok = false;
          step.error = "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7";
        }
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    if (plan.modules.includes("netRules")) {
      const liveBefore = await readNetRules();
      const payload = buildNetRulesPayload(plan, liveBefore);
      if (payload.length) {
        const step = { name: "netRules", label: "\u7F51\u7EDC\u89C4\u5219\uFF08\u7F51\u7EDC / \u7F51\u7EDC\u7C7B / \u7B49\u957F\u7EC4\uFF09", ok: true };
        try {
          const byType = {};
          for (const entry of payload) byType[entry.type] = (byType[entry.type] || 0) + 1;
          step.detail = { \u63D0\u4EA4\u6761\u76EE\u6570: payload.length, \u6309\u7C7B\u578B: byType };
          const returned = await api.overwriteNetRules(payload);
          step.returned = returned;
          if (typeof returned === "undefined") {
            step.ok = false;
            step.error = SILENTLY_IGNORED;
          } else {
            const result = await verifyNetRuleEntries(payload);
            step.verified = result.ok;
            if (!result.ok) {
              step.ok = false;
              step.error = "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7";
              step.detail = result.diffs.slice(0, 20);
            }
          }
        } catch (e) {
          step.ok = false;
          step.error = String(e?.message || e);
        }
        push(step);
      }
    }
    if (plan.modules.includes("netByNetRules")) {
      const step = { name: "netByNetRules", label: "\u7F51\u7EDC-\u7F51\u7EDC\u89C4\u5219", ok: true };
      try {
        const returned = await api.overwriteNetByNetRules(plan.netByNetRules);
        step.returned = returned;
        if (typeof returned === "undefined") {
          step.ok = false;
          step.error = SILENTLY_IGNORED;
        } else {
          const after = await api.getNetByNetRules() || {};
          const diffs = [];
          for (const group of Object.keys(plan.netByNetRules)) {
            const expect = (plan.netByNetRules[group] || []).map((entry) => `${entry.net1.name}|${entry.net2.name}|${entry.rule}`).sort();
            const actual = (after[group] || []).map((entry) => `${entry.net1.name}|${entry.net2.name}|${entry.rule}`).sort();
            if (JSON.stringify(expect) !== JSON.stringify(actual))
              diffs.push(`${group}: \u671F\u671B ${expect.length} \u6761\uFF0C\u5B9E\u9645 ${actual.length} \u6761`);
          }
          step.verified = diffs.length === 0;
          step.detail = diffs;
          if (diffs.length) {
            step.ok = false;
            step.error = "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7";
          }
        }
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    {
      const step = { name: "finalCheck", label: "\u7EC8\u68C0", ok: true };
      try {
        const problems = [];
        if (plan.modules.includes("netClasses")) {
          const live = await api.getAllNetClasses() || [];
          if (live.length < plan.netClasses.length)
            problems.push(`\u7F51\u7EDC\u7C7B\u6570\u91CF\uFF1A\u671F\u671B\u81F3\u5C11 ${plan.netClasses.length}\uFF0C\u5B9E\u9645 ${live.length}`);
          for (const target of plan.netClasses) {
            const present = live.find((cls) => sameName2(cls.name, target.name));
            if (!present) {
              problems.push(`\u7F51\u7EDC\u7C7B ${target.name} \u7F3A\u5931`);
              continue;
            }
            const nets = present.nets || [];
            if (!target.nets.every((net) => nets.some((x) => sameName2(x, net)))) {
              problems.push(`\u7F51\u7EDC\u7C7B ${target.name} \u6210\u5458\u7F3A\u5931\uFF1A\u671F\u671B\u5305\u542B ${target.nets.join(",")}\uFF0C\u5B9E\u9645 ${nets.join(",")}`);
            }
          }
        }
        if (plan.modules.includes("equalLengthGroups")) {
          const live = await api.getAllEqualLengthNetGroups() || [];
          if (live.length < plan.equalLengthGroups.length)
            problems.push(`\u7B49\u957F\u7F51\u7EDC\u7EC4\u6570\u91CF\uFF1A\u671F\u671B\u81F3\u5C11 ${plan.equalLengthGroups.length}\uFF0C\u5B9E\u9645 ${live.length}`);
          for (const target of plan.equalLengthGroups) {
            const present = live.find((group) => sameName2(group.name, target.name));
            if (!present) {
              problems.push(`\u7B49\u957F\u7F51\u7EDC\u7EC4 ${target.name} \u7F3A\u5931`);
              continue;
            }
            const nets = present.nets || [];
            if (!target.nets.every((net) => nets.some((x) => sameName2(x, net)))) {
              problems.push(`\u7B49\u957F\u7F51\u7EDC\u7EC4 ${target.name} \u6210\u5458\u7F3A\u5931\uFF1A\u671F\u671B\u5305\u542B ${target.nets.join(",")}\uFF0C\u5B9E\u9645 ${nets.join(",")}`);
            }
          }
        }
        if (plan.modules.includes("differentialPairs")) {
          const live = await api.getAllDifferentialPairs() || [];
          if (live.length < plan.differentialPairs.length)
            problems.push(`\u5DEE\u5206\u5BF9\u6570\u91CF\uFF1A\u671F\u671B\u81F3\u5C11 ${plan.differentialPairs.length}\uFF0C\u5B9E\u9645 ${live.length}`);
          for (const target of plan.differentialPairs) {
            const present = live.find((pair) => sameName2(pair.name, target.name));
            if (!present) {
              problems.push(`\u5DEE\u5206\u5BF9 ${target.name} \u7F3A\u5931`);
              continue;
            }
            if (!sameName2(present.positiveNet, target.positiveNet) || !sameName2(present.negativeNet, target.negativeNet)) {
              problems.push(`\u5DEE\u5206\u5BF9 ${target.name} \u7F51\u7EDC\u4E0D\u7B26\uFF1A\u671F\u671B ${target.positiveNet}/${target.negativeNet}\uFF0C\u5B9E\u9645 ${present.positiveNet}/${present.negativeNet}`);
            }
          }
        }
        if (plan.modules.includes("netRules")) {
          const live = await readNetRules();
          const keys = new Set(live.map(netRuleKey));
          const expected = [...plan.netRules.netEntries, ...plan.netRules.classEntries, ...plan.netRules.groupEntries];
          for (const entry of expected) {
            if (!keys.has(netRuleKey(entry)))
              problems.push(`\u7F51\u7EDC\u89C4\u5219\u6761\u76EE\u7F3A\u5931\uFF1A${entry.type} ${entry.name}`);
          }
        }
        if (plan.draftClasses.length) {
          const liveClasses = await api.getAllNetClasses() || [];
          for (const draft of plan.draftClasses) {
            const present = liveClasses.find((cls) => sameName2(cls.name, draft.name));
            if (!present) {
              problems.push(`\u7F51\u7EDC\u7C7B ${draft.name} \u7F3A\u5931\uFF08\u9644\u52A0\u7F51\u7EDC\u96C6\u5408\u8349\u7A3F\uFF09`);
              continue;
            }
            const nets = present.nets || [];
            if (!draft.nets.every((net) => nets.some((x) => sameName2(x, net))))
              problems.push(`\u7F51\u7EDC\u7C7B ${draft.name} \u6210\u5458\u7F3A\u5931\uFF1A\u671F\u671B\u5305\u542B ${draft.nets.join(",")}\uFF0C\u5B9E\u9645 ${nets.join(",")}`);
          }
        }
        if (plan.modules.includes("netByNetRules")) {
          const live = await api.getNetByNetRules() || {};
          for (const group of Object.keys(plan.netByNetRules)) {
            const expect = (plan.netByNetRules[group] || []).length;
            const actual = (live[group] || []).length;
            if (expect !== actual)
              problems.push(`\u7F51\u7EDC-\u7F51\u7EDC\u89C4\u5219 ${group}\uFF1A\u671F\u671B ${expect} \u6761\uFF0C\u5B9E\u9645 ${actual} \u6761`);
          }
        }
        step.detail = problems.slice(0, 40);
        step.verified = problems.length === 0;
        if (problems.length) {
          step.ok = false;
          step.error = "\u7EC8\u68C0\u53D1\u73B0\u4E0D\u4E00\u81F4";
        }
      } catch (e) {
        step.ok = false;
        step.error = String(e?.message || e);
      }
      push(step);
    }
    const failed = steps.find((step) => !step.ok);
    return { steps, ok: !failed, failed: failed?.name };
  }

  // src/core/engine.ts
  async function runExport(modules = [...ALL_MODULES], meta = {}) {
    const collected = await collectModules(modules);
    return { file: buildConfigSet(collected, modules, meta), collected };
  }
  async function runImport(file, modules = [...ALL_MODULES], options = {}) {
    const declared = file.modules || [];
    const scope = declared.length ? modules.filter((key) => declared.includes(key)) : modules;
    const collectScope = scope.includes("netByNetRules") && !scope.includes("ruleConfig") ? [...scope, "ruleConfig"] : scope;
    if (scope.includes("netByNetRules") && !scope.includes("netClasses"))
      collectScope.push("netClasses");
    const index = await buildNetIndex();
    const current = await collectModules(collectScope);
    const plan = buildPlan(file, current.data, index, scope, { exact: options.exact });
    const diff = diffPlan(plan, current.data);
    if (options.dryRun)
      return { plan, diff, current };
    const applied = await applyPlan(plan, { deleteClasses: options.deleteClasses });
    const after = await collectModules(collectScope);
    const residual = diffPlan(buildPlan(file, after.data, index, scope, { exact: options.exact }), after.data);
    return { plan, diff, current, applied, residual, after };
  }
  function parseConfigSet(text2) {
    const warnings = [];
    let raw;
    try {
      raw = JSON.parse(text2);
    } catch (e) {
      return { error: `JSON \u89E3\u6790\u5931\u8D25\uFF1A${String(e?.message || e)}`, warnings };
    }
    if (!raw || typeof raw !== "object")
      return { error: "\u6587\u4EF6\u5185\u5BB9\u4E0D\u662F\u5BF9\u8C61", warnings };
    if (raw.schema === SCHEMA_ID) {
      if (raw.schemaVersion !== SCHEMA_VERSION) {
        warnings.push(`\u6587\u4EF6 schemaVersion=${raw.schemaVersion}\uFF0C\u5F53\u524D\u7A0B\u5E8F\u652F\u6301 ${SCHEMA_VERSION}\uFF0C\u5C06\u6309\u517C\u5BB9\u6A21\u5F0F\u8BFB\u53D6\u3002`);
      }
      if (!raw.data || typeof raw.data !== "object")
        return { error: "\u6587\u4EF6\u7F3A\u5C11 data \u5B57\u6BB5", warnings };
      const modules = Array.isArray(raw.modules) && raw.modules.length ? raw.modules : [...ALL_MODULES];
      return { file: { ...raw, modules }, warnings };
    }
    const looksLikeConfig = ["Spacing", "Physics", "Plane", "Expansion"].some((key) => key in raw);
    if (looksLikeConfig) {
      warnings.push("\u68C0\u6D4B\u5230\u5609\u7ACB\u521BEDA \u5185\u7F6E\u5BFC\u51FA\u7684\u88F8\u89C4\u5219\u914D\u7F6E\uFF0C\u5DF2\u6309\u300C\u4EC5\u89C4\u5219\u7BA1\u7406\u300D\u6A21\u5757\u5BFC\u5165\u3002");
      return {
        file: {
          schema: SCHEMA_ID,
          schemaVersion: SCHEMA_VERSION,
          generator: { name: "easyeda-builtin-export", version: "unknown" },
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: { unit: void 0 },
          modules: ["ruleConfig"],
          data: { ruleConfig: raw }
        },
        warnings
      };
    }
    return { error: "\u65E0\u6CD5\u8BC6\u522B\u7684\u6587\u4EF6\u7ED3\u6784\uFF08\u65E2\u4E0D\u662F\u672C\u6269\u5C55\u7684\u914D\u7F6E\u96C6\uFF0C\u4E5F\u4E0D\u662F\u89C4\u5219\u7BA1\u7406\u914D\u7F6E\uFF09", warnings };
  }

  // src/core/overlay.ts
  function findBars() {
    try {
      return Array.from(document.querySelectorAll('[id^="progress-barwin_progress"]')).filter((el) => el.offsetParent !== null || el.querySelector('[class*="progressbar-value"]'));
    } catch {
      return [];
    }
  }
  function isOrphan(bar) {
    const title = bar.querySelector('[class^="message-p-msg"]') || bar.querySelector('[class*="message-p-msg"]');
    if (!title)
      return false;
    return String(title.textContent || "").trim() === "";
  }
  function scheduleOverlayCleanup(options = {}) {
    const rounds = options.rounds ?? 18;
    const intervalMs = options.intervalMs ?? 1e3;
    let left = rounds;
    let cleaned = 0;
    const tick = () => {
      try {
        for (const bar of findBars()) {
          if (!isOrphan(bar))
            continue;
          eda2().sys_LoadingAndProgressBar.destroyProgressBar();
          cleaned += 1;
        }
      } catch {
      }
      if (cleaned > 0 && !findBars().length) {
        try {
          options.onCleanup?.(cleaned);
        } catch {
        }
        return;
      }
      left -= 1;
      if (left > 0)
        setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
  }

  // src/core/labels.ts
  var RULE_TOP_LABELS = {
    "Spacing": "\u95F4\u8DDD",
    "Physics": "\u7269\u7406",
    "Plane": "\u5E73\u9762",
    "Expansion": "\u6269\u5C55",
    "Copper Analysis": "\u94DC\u76AE\u5206\u6790",
    "Drill Hole Analysis": "\u94BB\u5B54\u5206\u6790",
    "Silkscreen Analysis": "\u4E1D\u5370\u5206\u6790",
    "Solder Mask Analysis": "\u963B\u710A\u5206\u6790"
  };
  var RULE_GROUP_LABELS = {
    "Safe Spacing": "\u5B89\u5168\u95F4\u8DDD",
    "Other Spacing": "\u5176\u4ED6\u95F4\u8DDD",
    "Creepage Distance": "\u722C\u7535\u8DDD\u79BB",
    "Copper Safe Spacing": "\u94DC\u76AE\u5B89\u5168\u95F4\u8DDD",
    "Plane Safe Spacing": "\u5E73\u9762\u5B89\u5168\u95F4\u8DDD",
    "Track": "\u5BFC\u7EBF",
    "Net Length Range": "\u7F51\u7EDC\u957F\u5EA6\u8303\u56F4",
    "Net Length Tolerance": "\u7F51\u7EDC\u957F\u5EA6\u5BB9\u5DEE",
    "Differential Pair": "\u5DEE\u5206\u5BF9",
    "Blind/Buried Via": "\u76F2\u57CB\u5B54",
    "Via Size": "\u8FC7\u5B54\u5927\u5C0F",
    "Height": "\u9AD8\u5EA6",
    "Plane Zone": "\u5185\u7535\u5C42",
    "Copper Zone": "\u94FA\u94DC",
    "Solder Mask Expansion": "\u963B\u710A\u6269\u5C55",
    "Paste Mask Expansion": "\u94A2\u7F51\u6269\u5C55",
    "Acute Angle": "\u9510\u89D2",
    "Hole Falls on Pad": "\u5B54\u843D\u5728\u710A\u76D8\u4E0A",
    "Bare Track Ends": "\u88F8\u9732\u8D70\u7EBF\u672B\u7AEF",
    "Pad Hole Ring": "\u710A\u76D8\u5B54\u73AF",
    "Track Neckdown": "\u8D70\u7EBF\u9888\u7F29",
    "Short Circuit Prompt": "\u77ED\u8DEF\u63D0\u793A",
    "Minimum Copper Width": "\u6700\u5C0F\u94DC\u5BBD",
    "No Connected Vias": "\u672A\u8FDE\u63A5\u8FC7\u5B54",
    "Hole Size": "\u5B54\u5F84",
    "NPTH to Copper": "NPTH\u5230\u94DC",
    "Silkscreen to Pad": "\u4E1D\u5370\u5230\u710A\u76D8",
    "Silkscreen to Hole": "\u4E1D\u5370\u5230\u5B54",
    "Silkscreen Line Width": "\u4E1D\u5370\u7EBF\u5BBD",
    "Solder Mask Bridge": "\u963B\u710A\u6865",
    "SMask Opening Copper": "\u963B\u710A\u5F00\u7A97\u94DC\u76AE",
    "Pad Negative Opening": "\u710A\u76D8\u8D1F\u7247\u5F00\u7A97"
  };
  var RULE_GROUP_TOPS = {
    "Copper Safe Spacing": "Spacing",
    "Plane Safe Spacing": "Spacing",
    "Safe Spacing": "Spacing",
    "Other Spacing": "Spacing",
    "Creepage Distance": "Spacing",
    "Track": "Physics",
    "Net Length Range": "Physics",
    "Net Length Tolerance": "Physics",
    "Differential Pair": "Physics",
    "Blind/Buried Via": "Physics",
    "Via Size": "Physics",
    "Height": "Physics",
    "Plane Zone": "Plane",
    "Copper Zone": "Plane",
    "Solder Mask Expansion": "Expansion",
    "Paste Mask Expansion": "Expansion",
    "Acute Angle": "Copper Analysis",
    "Hole Falls on Pad": "Copper Analysis",
    "Bare Track Ends": "Copper Analysis",
    "Pad Hole Ring": "Copper Analysis",
    "Track Neckdown": "Copper Analysis",
    "Short Circuit Prompt": "Copper Analysis",
    "Minimum Copper Width": "Copper Analysis",
    "No Connected Vias": "Drill Hole Analysis",
    "Hole Size": "Drill Hole Analysis",
    "NPTH to Copper": "Drill Hole Analysis",
    "Silkscreen to Pad": "Silkscreen Analysis",
    "Silkscreen to Hole": "Silkscreen Analysis",
    "Silkscreen Line Width": "Silkscreen Analysis",
    "Solder Mask Bridge": "Solder Mask Analysis",
    "SMask Opening Copper": "Solder Mask Analysis",
    "Pad Negative Opening": "Solder Mask Analysis"
  };
  function ruleGroupLabel(top, group) {
    const topLabel = RULE_TOP_LABELS[top || ""] ?? RULE_TOP_LABELS[RULE_GROUP_TOPS[group] ?? ""] ?? top ?? "";
    const groupLabel = RULE_GROUP_LABELS[group] ?? group;
    return groupLabel ? `${topLabel}-${groupLabel}` : topLabel;
  }
  function topByRuleGroup(group, configuredTops = {}) {
    return configuredTops[group] ?? RULE_GROUP_TOPS[group] ?? "";
  }

  // src/core/pairDrafts.ts
  function appendPairDrafts(file, drafts) {
    if (!drafts.length)
      return;
    file.data.netByNetRules = file.data.netByNetRules || {};
    for (const draft of drafts) {
      if (draft.aNets.length && draft.bNets.length) {
        const list2 = file.data.netByNetRules[draft.group] || (file.data.netByNetRules[draft.group] = []);
        list2.push({
          net1: { type: "set", nets: [...draft.aNets], className: draft.aClass || void 0 },
          net2: { type: "set", nets: [...draft.bNets], className: draft.bClass || void 0 },
          rule: draft.rule
        });
        continue;
      }
      const nets = draft.aNets.length ? draft.aNets : draft.bNets;
      if (!nets.length)
        continue;
      const className = draft.aNets.length ? draft.aClass : draft.bClass;
      const list = file.data.netByNetRules[draft.group] || (file.data.netByNetRules[draft.group] = []);
      if (className) {
        const side = draft.aNets.length ? "net1" : "net2";
        list.push({
          net1: side === "net1" ? { type: "set", nets: [...nets], className } : { type: "set", nets: [] },
          net2: side === "net2" ? { type: "set", nets: [...nets], className } : { type: "set", nets: [] },
          rule: draft.rule,
          single: side
        });
      } else {
        file.data.netRules = file.data.netRules || [];
        for (const net of nets) {
          if (!file.data.netRules.some((entry) => entry.type === "net" && String(entry.name).toLowerCase() === net.toLowerCase()))
            file.data.netRules.push({ type: "net", name: net });
        }
        if (!file.modules.includes("netRules"))
          file.modules.push("netRules");
      }
    }
    if (!file.modules.includes("netByNetRules") && Object.keys(file.data.netByNetRules).length)
      file.modules.push("netByNetRules");
  }
  function buildExportSummary(data) {
    const ruleConfigGroups = Object.entries(data.ruleConfig || {}).flatMap(
      ([top, groups]) => Object.entries(groups || {}).map(([group, rules]) => ({
        top,
        group,
        label: ruleGroupLabel(top, group),
        count: Object.keys(rules || {}).length
      }))
    );
    const configuredTops = {};
    for (const [top, groups] of Object.entries(data.ruleConfig || {})) {
      for (const group of Object.keys(groups || {}))
        configuredTops[group] = top;
    }
    const netRuleStat = /* @__PURE__ */ new Map();
    const countNetRuleLeaf = (entry) => {
      for (const [group, value] of Object.entries(entry || {})) {
        if (["type", "name", "sub", "targetNet"].includes(group) || value === void 0 || value === null)
          continue;
        const top = topByRuleGroup(group, configuredTops);
        const key = `${top}|${group}`;
        const item = netRuleStat.get(key) || { top, group, total: 0, custom: 0 };
        item.total += 1;
        if (value !== "default")
          item.custom += 1;
        netRuleStat.set(key, item);
      }
    };
    for (const entry of data.netRules || [])
      countNetRuleLeaf(entry);
    const netRuleGroups = [...netRuleStat.values()].map((item) => ({ label: ruleGroupLabel(item.top, item.group), total: item.total, custom: item.custom }));
    return {
      ruleConfigGroups,
      ruleConfigCount: ruleConfigGroups.reduce((total, item) => total + item.count, 0),
      netClassNames: (data.netClasses || []).map((cls) => String(cls?.name ?? "")).filter(Boolean),
      netRuleCount: (data.netRules || []).length,
      netRuleGroups,
      netByNetGroups: Object.fromEntries(
        Object.keys(data.netByNetRules || {}).map((group) => [
          ruleGroupLabel(configuredTops[group], group),
          (data.netByNetRules[group] || []).length
        ])
      ),
      differentialPairCount: (data.differentialPairs || []).length,
      equalLengthGroupCount: (data.equalLengthGroups || []).length
    };
  }

  // src/core/settings.ts
  var DEFAULT_SETTINGS = {
    lastExportModules: null,
    uiLanguage: "auto"
  };
  var STORAGE_KEY = "settings";
  var cache;
  var writable = true;
  function storage() {
    return eda2().sys_Storage;
  }
  function normalize(raw) {
    const out = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== "object")
      return out;
    if (Array.isArray(raw.lastExportModules))
      out.lastExportModules = raw.lastExportModules.map((key) => String(key));
    else if (raw.lastExportModules === null)
      out.lastExportModules = null;
    if (raw.uiLanguage === "zh-Hans" || raw.uiLanguage === "en" || raw.uiLanguage === "auto")
      out.uiLanguage = raw.uiLanguage;
    return out;
  }
  function loadSettings() {
    if (cache)
      return cache;
    try {
      const raw = storage()?.getExtensionUserConfig?.(STORAGE_KEY);
      cache = normalize(raw);
    } catch {
      writable = false;
      cache = { ...DEFAULT_SETTINGS };
    }
    return cache;
  }
  async function saveSettings(patch) {
    const next = { ...loadSettings(), ...patch };
    cache = normalize(next);
    if (!writable)
      return false;
    try {
      const result = await storage().setExtensionUserConfig(STORAGE_KEY, cache);
      return result !== false;
    } catch {
      writable = false;
      return false;
    }
  }

  // src/core/tableImport.ts
  function decodeCsv(bytes) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      try {
        return new TextDecoder("gbk").decode(bytes);
      } catch {
        return new TextDecoder("utf-8").decode(bytes);
      }
    }
  }
  function splitCsvLine(line) {
    const cells = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  }
  var HEADER_KEYS = ["seta", "setb", "classa", "classb", "rule"];
  function parseNetSetTable(text2) {
    const errors = [];
    const rows = [];
    const lines = String(text2 || "").replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
    let header;
    let dataLine = 0;
    for (const raw of lines) {
      if (!raw.trim())
        continue;
      const cells = splitCsvLine(raw).map((cell2) => cell2.trim());
      if (!header) {
        header = {};
        cells.forEach((name, index) => {
          const key = name.toLowerCase();
          if (HEADER_KEYS.includes(key))
            header[key] = index;
        });
        const parsedHeader2 = header;
        if (parsedHeader2.rule === void 0 || parsedHeader2.seta === void 0 && parsedHeader2.setb === void 0) {
          errors.push("\u8868\u5934\u4E0D\u7B26\u5408\u6A21\u677F\uFF1A\u81F3\u5C11\u9700\u8981 setA / setB \u4E4B\u4E00\u4E0E rule \u5217\uFF08\u5927\u5C0F\u5199\u4E0D\u654F\u611F\uFF0C\u5217\u5E8F\u968F\u610F\uFF09");
          return { rows, errors };
        }
        continue;
      }
      dataLine++;
      const parsedHeader = header;
      const cell = (key) => parsedHeader[key] === void 0 ? "" : cells[parsedHeader[key]] || "";
      const aNets = parseNetList(cell("seta"));
      const bNets = parseNetList(cell("setb"));
      const rule = cell("rule");
      if (!aNets.length && !bNets.length) {
        errors.push(`\u7B2C ${dataLine} \u884C\uFF1A\u96C6\u5408A / \u96C6\u5408B \u81F3\u5C11\u4E00\u4E2A\u9700\u8981\u586B\u5199\u7F51\u7EDC\u540D`);
        continue;
      }
      if (!rule) {
        errors.push(`\u7B2C ${dataLine} \u884C\uFF1A\u89C4\u5219\u5217\uFF08rule\uFF09\u4E3A\u7A7A`);
        continue;
      }
      rows.push({ rule, aNets, bNets, aClass: cell("classa") || void 0, bClass: cell("classb") || void 0 });
    }
    if (!header)
      errors.push("\u8868\u683C\u5185\u5BB9\u4E3A\u7A7A");
    return { rows, errors };
  }

  // src/core/text.ts
  var RESIDUAL_TEMPLATE = {
    "zh-Hans": "\u5269\u4F59\u5DEE\u5F02\uFF1A\u65B0\u589E ${1} / \u4FEE\u6539 ${2} / \u5220\u9664 ${3} / \u4FDD\u7559 ${4} / \u8DF3\u8FC7 ${5} / \u4E0D\u652F\u6301 ${6}",
    "en": "Remaining differences: added ${1} / modified ${2} / removed ${3} / kept ${4} / skipped ${5} / unsupported ${6}"
  };
  var TABLE = {
    "window.title": { "zh-Hans": "\u89C4\u5219\u914D\u7F6E\u7BA1\u7406", "en": "Rule Configuration Manager" },
    "window.title.export": { "zh-Hans": "\u5BFC\u51FA\u8BBE\u8BA1\u89C4\u5219\u914D\u7F6E", "en": "Export Design Rule Configuration" },
    "window.title.import": { "zh-Hans": "\u5BFC\u5165\u8BBE\u8BA1\u89C4\u5219\u914D\u7F6E", "en": "Import Design Rule Configuration" },
    "window.title.netpair": { "zh-Hans": "\u7F51\u7EDC\u96C6\u5408\u89C4\u5219", "en": "Net-set Rules" },
    "busy.pickFile": { "zh-Hans": "\u8BF7\u5728\u5F39\u51FA\u7684\u7A97\u53E3\u4E2D\u9009\u62E9\u914D\u7F6E\u6587\u4EF6\u2026", "en": "Choose a configuration file in the dialog\u2026" },
    "busy.compare": { "zh-Hans": "\u6B63\u5728\u6BD4\u5BF9\u5F53\u524D PCB \u4E0E\u914D\u7F6E\u6587\u4EF6\u2026", "en": "Comparing the current PCB with the configuration file\u2026" },
    "busy.export": { "zh-Hans": "\u6B63\u5728\u8BFB\u53D6\u5F53\u524D PCB \u89C4\u5219\u2026", "en": "Reading the current PCB rules\u2026" },
    "busy.write": { "zh-Hans": "\u6B63\u5728\u5199\u5165\u89C4\u5219\uFF0C\u8BF7\u52FF\u64CD\u4F5C\u2026", "en": "Writing rules, please wait\u2026" },
    "toast.noWindow": { "zh-Hans": "\u65E0\u6CD5\u6253\u5F00\u89C4\u5219\u914D\u7F6E\u7BA1\u7406\u7A97\u53E3", "en": "Unable to open the Rule Configuration window" },
    "toast.overlayCleared": { "zh-Hans": "\u5DF2\u91CA\u653E\u7F16\u8F91\u5668\u6B8B\u7559\u7684\u8FDB\u5EA6\u906E\u7F69\uFF0C\u754C\u9762\u53EF\u4EE5\u6B63\u5E38\u64CD\u4F5C\u4E86", "en": "Released the editor leftover progress overlay; the UI is usable again" },
    "toast.restored": { "zh-Hans": "\u5DF2\u8FD8\u539F\u5230\u5BFC\u5165\u524D\u7684\u72B6\u6001", "en": "Rolled back to the state before import" },
    "error.openDialog": { "zh-Hans": "\u6253\u5F00\u6587\u4EF6\u9009\u62E9\u7A97\u53E3\u5931\u8D25\uFF1A", "en": "Failed to open the file picker: " },
    "error.readFile": { "zh-Hans": "\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25\uFF1A", "en": "Failed to read the file: " },
    "error.diff": { "zh-Hans": "\u5DEE\u5F02\u6BD4\u5BF9\u5931\u8D25\uFF1A", "en": "Diff failed: " },
    "error.import": { "zh-Hans": "\u5BFC\u5165\u5931\u8D25\uFF1A", "en": "Import failed: " },
    "error.export": { "zh-Hans": "\u5BFC\u51FA\u5931\u8D25\uFF1A", "en": "Export failed: " },
    "log.importHeader": { "zh-Hans": "\u89C4\u5219\u914D\u7F6E\u5BFC\u5165\u65E5\u5FD7", "en": "Rule configuration import log" },
    "log.exportHeader": { "zh-Hans": "\u89C4\u5219\u914D\u7F6E\u5BFC\u51FA\u65E5\u5FD7", "en": "Rule configuration export log" },
    "log.file": { "zh-Hans": "\u914D\u7F6E\u6587\u4EF6\uFF1A", "en": "Configuration file: " },
    "log.result": { "zh-Hans": "\u5BFC\u51FA\u6587\u4EF6\uFF1A", "en": "Exported file: " },
    "log.modules": { "zh-Hans": "\u6A21\u5757\uFF1A", "en": "Modules: " },
    "log.ok": { "zh-Hans": "\u6210\u529F", "en": "OK" },
    "log.fail": { "zh-Hans": "\u5931\u8D25", "en": "failed" },
    "log.residual": RESIDUAL_TEMPLATE,
    "log.hint": { "zh-Hans": "\u63D0\u793A\uFF1A", "en": "Note: " },
    "log.restore": { "zh-Hans": "\u8FD8\u539F\uFF1A", "en": "Rollback: " },
    "log.restored": { "zh-Hans": "\u5DF2\u6309\u5BFC\u5165\u524D\u7684\u5FEB\u7167\u8FD8\u539F", "en": "Restored from the pre-import snapshot" },
    "module.netByNetRules": { "zh-Hans": "\u7F51\u7EDC-\u7F51\u7EDC\u89C4\u5219", "en": "Net-to-net rules" },
    "log.netpairHeader": { "zh-Hans": "\u7F51\u7EDC\u96C6\u5408\u89C4\u5219\u5199\u5165\u65E5\u5FD7", "en": "Net-set rule write log" },
    "log.netpairGroup": { "zh-Hans": "\u5206\u7EC4\uFF1A${1}", "en": "Group: ${1}" },
    "log.netpairRule": { "zh-Hans": "\u89C4\u5219\u540D\uFF1A${1}", "en": "Rule: ${1}" },
    "log.netpairSets": { "zh-Hans": "\u96C6\u5408A ${1} \u4E2A\u7F51\u7EDC\uFF08\u7F3A\u5931 ${2}\uFF09 / \u96C6\u5408B ${3} \u4E2A\u7F51\u7EDC\uFF08\u7F3A\u5931 ${4}\uFF09", "en": "Set A ${1} nets (missing ${2}) / Set B ${3} nets (missing ${4})" },
    "log.netpairExpand": { "zh-Hans": "\u5C55\u5F00 ${1} \xD7 ${2} = ${3} \u5BF9\uFF0C\u65B0\u589E ${4} \u6761\uFF08\u91CD\u590D\u8DF3\u8FC7 ${5}\uFF0C\u7F3A\u5931\u7F51\u7EDC ${6} \u4E2A\uFF09", "en": "Expanded ${1} \xD7 ${2} = ${3} pairs; added ${4} (duplicates skipped ${5}, missing nets ${6})" },
    "netpair.error.noGroup": { "zh-Hans": "\u5F53\u524D PCB \u6CA1\u6709\u53EF\u7528\u7684\u7F51\u7EDC-\u7F51\u7EDC\u89C4\u5219\u5206\u7EC4", "en": "No net-to-net rule group is available on this PCB" },
    "netpair.error.noRule": { "zh-Hans": "\u8BF7\u4ECE\u6240\u9009\u5206\u7EC4\u4E2D\u9009\u62E9\u89C4\u5219\uFF08\u8BE5\u5206\u7EC4\u5FC5\u987B\u5DF2\u6709\u89C4\u5219\uFF09", "en": "Pick a rule from the selected group (the group must already have rules)" },
    "netpair.error.emptySet": { "zh-Hans": "\u96C6\u5408\u4E3A\u7A7A\uFF1A\u8BF7\u81F3\u5C11\u4E3A\u4E00\u4E2A\u96C6\u5408\u586B\u5199\u7F51\u7EDC\u540D\uFF08\u5F53\u524D PCB \u4E0A\u6CA1\u6709\u4EFB\u4F55\u5339\u914D\u7684\u7F51\u7EDC\uFF09", "en": "Empty sets: enter nets in at least one set (no matching net exists on this PCB)" },
    "netpair.error.verify": { "zh-Hans": "\u56DE\u8BFB\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A\u90E8\u5206\u7F51\u7EDC\u5BF9\u6CA1\u6709\u88AB\u7F16\u8F91\u5668\u63A5\u53D7", "en": "Verification failed: some pairs were not accepted by the editor" },
    "netpair.missing": { "zh-Hans": "\u4EE5\u4E0B\u7F51\u7EDC\u5728\u5F53\u524D PCB \u4E0D\u5B58\u5728\uFF0C\u5DF2\u8DF3\u8FC7\uFF1A${1}", "en": "These nets do not exist on this PCB and were skipped: ${1}" },
    "netpair.toast.done": { "zh-Hans": "\u7F51\u7EDC\u96C6\u5408\u89C4\u5219\u5DF2\u5199\u5165", "en": "Net-set rules written" },
    "netpair.toast.verifyFailed": { "zh-Hans": "\u7F51\u7EDC\u96C6\u5408\u89C4\u5219\u5199\u5165\u540E\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u8BF7\u67E5\u770B\u65E5\u5FD7", "en": "Verification failed after writing; see the log" },
    "about.title": { "zh-Hans": "\u5173\u4E8E", "en": "About" }
  };
  var EXT_TEXT_TAGS = Object.keys(TABLE);
  function fallbackText(tag, lang, args = []) {
    const pair = TABLE[tag];
    if (!pair)
      return tag;
    return format(pair[lang] ?? pair["zh-Hans"], args);
  }
  function format(text2, args) {
    return text2.replace(/\$\{(\d+)\}/g, (_, index) => {
      const value = args[Number(index) - 1];
      return value === void 0 ? "" : String(value);
    });
  }
  function text(tag, lang, args = []) {
    try {
      const value = eda2().sys_I18n?.text?.(tag, extension_default.uuid, lang, ...args);
      if (typeof value === "string" && value && value !== tag)
        return value;
    } catch {
    }
    return fallbackText(tag, lang ?? "zh-Hans", args);
  }

  // src/flow.ts
  var IFRAME_ID = "rcm-wizard";
  var IFRAME_FILE = "/iframe/index.html";
  var WINDOW_W = 1020;
  var WINDOW_H = 720;
  var GENERATOR = { name: "rule-configuration-management", version: "1.0.0" };
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function defaultExportName() {
    const d = /* @__PURE__ */ new Date();
    return `Config_DesignRule_PCB_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
  }
  function formatDateTime(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  }
  var Wizard = class {
    channel = new Channel((command) => void this.handle(command));
    ctx = this.freshCtx("import");
    tableImportSeq = 0;
    started = false;
    freshCtx(mode) {
      const settings = loadSettings();
      const remembered = settings.lastExportModules;
      const modules = {};
      for (const key of ALL_MODULES) modules[key] = remembered ? remembered.includes(key) : true;
      return {
        mode,
        lang: "zh-Hans",
        settings,
        warnings: [],
        modules,
        exportFileName: defaultExportName(),
        log: []
      };
    }
    t(tag, args = []) {
      return text(tag, this.ctx.lang, args);
    }
    // ---------------------------------------------------------------- 生命周期
    async open(mode) {
      this.channel.stop();
      this.ctx = this.freshCtx(mode);
      this.ctx.lang = await this.resolveLang();
      if (mode === "netpair")
        this.ctx.netpair = { ...await this.collectNetPairData(), a: "", b: "", rule: "", classA: "", classB: "" };
      if (mode === "export")
        await this.loadExportMeta();
      this.channel.reset();
      await this.show();
      if (mode === "import")
        setTimeout(() => void this.pickFile(), 200);
    }
    async collectNetPairData() {
      const groups = [];
      const rules = {};
      try {
        const nbn = await eda2().pcb_Drc.getNetByNetRules();
        for (const key of Object.keys(nbn || {}))
          groups.push(key);
      } catch {
      }
      try {
        const rc = await eda2().pcb_Drc.getCurrentRuleConfiguration();
        const cfg = rc && (rc.config ?? rc) || {};
        for (const group of groups) {
          rules[group] = [];
          for (const top of Object.keys(cfg)) {
            const groupCfg = (cfg[top] || {})[group];
            if (groupCfg && typeof groupCfg === "object") {
              rules[group] = Object.keys(groupCfg);
              break;
            }
          }
        }
      } catch {
      }
      return { groups, rules };
    }
    /** 导出弹窗的元数据：分组/规则（供附加网络对选择）+ 当前 PCB 将导出的内容清单 */
    async loadExportMeta() {
      this.ctx.npMeta = await this.collectNetPairData();
      try {
        const collected = await collectModules();
        this.ctx.exportSummary = buildExportSummary(collected.data);
      } catch {
        this.ctx.exportSummary = void 0;
      }
    }
    /** 界面语言：设置优先；auto 时跟随编辑器（非中文一律按英文） */
    async resolveLang() {
      const setting = loadSettings().uiLanguage;
      if (setting === "zh-Hans" || setting === "en")
        return setting;
      try {
        const current = await eda2().sys_I18n?.getCurrentLanguage?.();
        if (typeof current === "string" && current)
          return current.toLowerCase().startsWith("zh") ? "zh-Hans" : "en";
      } catch {
      }
      return "zh-Hans";
    }
    async show(snapshotOverride) {
      const opened = await this.ensureWindow();
      if (!opened) {
        toast(this.t("toast.noWindow"));
        return;
      }
      this.channel.start();
      this.started = true;
      this.publish(snapshotOverride);
    }
    async ensureWindow() {
      try {
        await eda2().sys_IFrame.closeIFrame(IFRAME_ID);
      } catch {
      }
      try {
        return await eda2().sys_IFrame.openIFrame(IFRAME_FILE, WINDOW_W, WINDOW_H, IFRAME_ID, {
          title: text(`window.title.${this.ctx.mode}`, this.ctx.lang),
          minimizeButton: true,
          maximizeButton: false,
          grayscaleMask: false
        });
      } catch {
        return false;
      }
    }
    // ---------------------------------------------------------------- 状态发布
    publish(override) {
      const ctx = this.ctx;
      const state = {
        view: this.view(),
        mode: ctx.mode,
        lang: ctx.lang,
        file: ctx.file ? {
          name: ctx.fileName,
          size: ctx.fileSize,
          modules: ctx.file.modules,
          moduleLabels: ctx.file.modules.map((key) => MODULE_LABELS[key] ?? key),
          edaVersion: ctx.file.edaVersion,
          exportedAt: ctx.file.exportedAt ? formatDateTime(new Date(ctx.file.exportedAt)) : void 0,
          unit: ctx.file.source?.unit,
          ruleConfigName: ctx.file.source?.ruleConfigName,
          schemaVersion: ctx.file.schemaVersion
        } : void 0,
        warnings: ctx.warnings,
        error: ctx.error,
        modules: ALL_MODULES.map((key) => ({ key, label: MODULE_LABELS[key], on: ctx.modules[key] !== false })),
        exportFileName: ctx.exportFileName,
        diff: ctx.diff ? this.diffViewModel(ctx.diff) : void 0,
        steps: ctx.steps,
        residualSummary: ctx.residualSummary,
        savedName: ctx.savedName,
        restored: ctx.restored,
        hasSnapshot: !!ctx.snapshot,
        netpair: ctx.netpair ? JSON.parse(JSON.stringify(ctx.netpair)) : void 0,
        npMeta: ctx.npMeta ? JSON.parse(JSON.stringify(ctx.npMeta)) : void 0,
        npdTableImported: ctx.npdTableImported,
        exportSummary: ctx.exportSummary ? JSON.parse(JSON.stringify(ctx.exportSummary)) : void 0,
        log: ctx.log.join("\n"),
        ...override
      };
      this.channel.publish(state);
    }
    view() {
      const ctx = this.ctx;
      if (ctx.steps || ctx.savedName)
        return "result";
      if (ctx.diff)
        return "preview";
      if (ctx.mode === "netpair")
        return "select-netpair";
      return ctx.mode === "export" ? "select-export" : "select-import";
    }
    diffViewModel(diff) {
      const order = new Map(ALL_MODULES.map((key, index) => [key, index]));
      const byModule = /* @__PURE__ */ new Map();
      for (const entry of diff.entries) {
        if (!byModule.has(entry.module)) {
          byModule.set(entry.module, {
            module: entry.module,
            label: MODULE_LABELS[entry.module] ?? entry.module,
            count: 0,
            entries: []
          });
        }
        const group = byModule.get(entry.module);
        group.count += 1;
        group.entries.push({
          kind: entry.kind,
          path: entry.path,
          note: entry.note,
          detail: entry.detail,
          fields: (entry.fields || []).slice(0, 200).map((field) => ({
            path: field.path,
            left: field.left,
            right: field.right
          }))
        });
      }
      return {
        summary: diff.summary,
        warnings: diff.warnings,
        skipped: diff.skipped,
        groups: [...byModule.values()].sort(
          (a, b) => (order.get(a.module) ?? 99) - (order.get(b.module) ?? 99)
        )
      };
    }
    // ---------------------------------------------------------------- 指令处理
    async handle(command) {
      switch (command.type) {
        case "ready":
          this.channel.claim(command.payload?.nonce);
          this.publish();
          break;
        case "pickFile":
          await this.pickFile();
          break;
        case "preview":
          await this.buildPreview();
          break;
        case "applyImport":
          await this.applyImport();
          break;
        case "restore":
          await this.doRestore();
          break;
        case "export":
          await this.doExport(command.payload || {});
          break;
        case "netpairInput":
          await this.onNetPairInput(command.payload || {});
          break;
        case "netpairGroup":
          if (this.ctx.netpair) {
            this.ctx.netpair.group = String(command.payload?.group ?? "");
            const groupRules = this.ctx.netpair.rules[this.ctx.netpair.group] || [];
            if (!groupRules.includes(this.ctx.netpair.rule))
              this.ctx.netpair.rule = groupRules[0] ?? "";
            await this.refreshNetPairPreview();
          }
          break;
        case "netpairRule":
          if (this.ctx.netpair) {
            this.ctx.netpair.rule = String(command.payload?.rule ?? "");
            this.publish();
          }
          break;
        case "applyNetPair":
          await this.applyNetPair(command.payload || {});
          break;
        case "npdTableImport":
          await this.npdTableImport(String(command.payload?.group ?? ""));
          break;
        case "npTableImport":
          await this.npTableImport();
          break;
        case "restart":
          this.ctx = this.freshCtx(this.ctx.mode);
          this.ctx.lang = await this.resolveLang();
          if (this.ctx.mode === "netpair")
            this.ctx.netpair = { ...await this.collectNetPairData(), a: "", b: "", rule: "", classA: "", classB: "" };
          if (this.ctx.mode === "export")
            await this.loadExportMeta();
          this.publish();
          break;
        case "close":
          this.channel.stop();
          try {
            await eda2().sys_IFrame.closeIFrame(IFRAME_ID);
          } catch {
          }
          break;
        case "toast":
          toast(String(command.payload?.message ?? ""));
          break;
        default:
          break;
      }
    }
    // ---------------------------------------------------------------- 网络集合规则（直写入口）
    /** 集合文本 → 当前 PCB 上的真实网络（忽略大小写、去重），缺失网络单独返回 */
    resolveNetList(raw, index) {
      const kept = [];
      const missing = [];
      for (const name of parseNetList(raw)) {
        const real = index.real(name);
        if (real === void 0) {
          if (!missing.includes(name))
            missing.push(name);
        } else if (!kept.includes(real)) {
          kept.push(real);
        }
      }
      return { kept, missing };
    }
    async refreshNetPairPreview() {
      const np = this.ctx.netpair;
      if (!np)
        return;
      const index = await buildNetIndex();
      const a = this.resolveNetList(np.a, index);
      const b = this.resolveNetList(np.b, index);
      np.preview = {
        aCount: a.kept.length,
        bCount: b.kept.length,
        // 只填一个集合时按单集合模式计数（建类或网络规则条目），不再是乘积
        total: a.kept.length && b.kept.length ? a.kept.length * b.kept.length : a.kept.length + b.kept.length,
        missingA: a.missing,
        missingB: b.missing
      };
      this.publish({ npPreviewTick: true });
    }
    async onNetPairInput(payload) {
      const np = this.ctx.netpair;
      if (!np)
        return;
      if (typeof payload.a === "string")
        np.a = payload.a;
      if (typeof payload.b === "string")
        np.b = payload.b;
      if (typeof payload.rule === "string")
        np.rule = payload.rule;
      if (typeof payload.classA === "string")
        np.classA = payload.classA;
      if (typeof payload.classB === "string")
        np.classB = payload.classB;
      await this.refreshNetPairPreview();
    }
    /**
     * 写入网络集合规则：把弹窗内容构造成一份「仅含网络-网络规则（必要时含网络规则）」的配置集，
     * 复用导入管线执行 —— 建类冲突回退、单集合建类 / 网络规则语义、缺失网络求交、日志与还原
     * 与「导出配置 → 导入」路径完全一致。
     */
    async applyNetPair(payload) {
      const np = this.ctx.netpair;
      if (!np)
        return;
      if (typeof payload.group === "string" && payload.group)
        np.group = payload.group;
      if (typeof payload.a === "string")
        np.a = payload.a;
      if (typeof payload.b === "string")
        np.b = payload.b;
      if (typeof payload.rule === "string")
        np.rule = payload.rule;
      if (typeof payload.classA === "string")
        np.classA = payload.classA;
      if (typeof payload.classB === "string")
        np.classB = payload.classB;
      const group = np.group || np.groups[0];
      if (!group) {
        this.ctx.error = this.t("netpair.error.noGroup");
        this.publish({ view: "select-netpair" });
        return;
      }
      const rule = String(np.rule || "").trim();
      const groupRules = np.rules[group] || [];
      if (!rule || !groupRules.includes(rule)) {
        this.ctx.error = this.t("netpair.error.noRule");
        this.publish({ view: "select-netpair" });
        return;
      }
      this.ctx.error = void 0;
      this.publish({ view: "busy", busyText: this.t("busy.write") });
      try {
        const index = await buildNetIndex();
        const a = this.resolveNetList(np.a, index);
        const b = this.resolveNetList(np.b, index);
        if (!a.kept.length && !b.kept.length) {
          this.ctx.error = this.t("netpair.error.emptySet");
          this.publish({ view: "select-netpair" });
          return;
        }
        const draft = {
          group,
          rule,
          aNets: a.kept,
          bNets: b.kept,
          aClass: String(np.classA || "").trim() || void 0,
          bClass: String(np.classB || "").trim() || void 0
        };
        await this.writeNetPairDrafts(group, [draft], this.missingWarningFor(a.missing, b.missing));
      } catch (e) {
        this.ctx.error = `${this.t("error.import")}${String(e?.message || e)}`;
        this.publish({ view: "select-netpair" });
      }
    }
    /** 缺失网络的人话汇总（单条手输路径用；表格路径由计划的跳过列表覆盖） */
    missingWarningFor = (missingA, missingB) => {
      const missingNets = [...missingA, ...missingB].filter((name, i, list) => list.indexOf(name) === i);
      return missingNets.length ? [this.t("netpair.missing", [missingNets.join(", ")])] : [];
    };
    /** 读入模板表格（CSV）：编码兼容 UTF-8 / GBK，取消选择返回空 */
    async readNetSetTable() {
      let file;
      try {
        file = await fileSystem().openReadFileDialog(["csv"], false);
      } catch (e) {
        return { error: `${this.t("error.openDialog")}${String(e?.message || e)}` };
      }
      if (!file)
        return {};
      try {
        let bytes;
        if (typeof file.arrayBuffer === "function") {
          try {
            bytes = new Uint8Array(await file.arrayBuffer());
          } catch {
            bytes = void 0;
          }
        }
        const content = bytes ? decodeCsv(bytes) : await file.text();
        const parsed = parseNetSetTable(content);
        if (parsed.errors.length)
          return { error: parsed.errors.join("\uFF1B") };
        return { rows: parsed.rows };
      } catch (e) {
        return { error: `${this.t("error.readFile")}${String(e?.message || e)}` };
      }
    }
    /** 导出弹窗：表格导入 → 合并进附加草稿列表（规则键按当前所选分组校验，整表生效或整体拒绝） */
    async npdTableImport(group) {
      const id = ++this.tableImportSeq;
      const result = await this.readNetSetTable();
      if (!result.rows) {
        if (result.error)
          this.ctx.npdTableImported = { id, error: result.error };
        this.publish();
        return;
      }
      if (!group) {
        this.ctx.npdTableImported = { id, error: "\u8BF7\u5148\u9009\u62E9\u89C4\u5219\u5206\u7EC4\uFF0C\u518D\u5BFC\u5165\u8868\u683C" };
        this.publish();
        return;
      }
      const rules = (this.ctx.npMeta?.rules || {})[group] || [];
      const badRows = result.rows.map((row, index) => ({ row, line: index + 1 })).filter((item) => !rules.includes(item.row.rule));
      if (badRows.length) {
        this.ctx.npdTableImported = {
          id,
          error: `\u7B2C ${badRows.map((item) => item.line).join("\u3001")} \u884C\u7684\u89C4\u5219\u4E0D\u5728\u5206\u7EC4\u300C${group}\u300D\u4E2D\uFF08\u53EF\u9009\uFF1A${rules.join("\u3001") || "\u8BE5\u5206\u7EC4\u8FD8\u6CA1\u6709\u89C4\u5219"}\uFF09\uFF0C\u8BF7\u4FEE\u6B63 rule \u5217\u540E\u91CD\u65B0\u5BFC\u5165`
        };
        this.publish();
        return;
      }
      this.ctx.npdTableImported = { id, drafts: result.rows };
      this.publish();
    }
    /** 网络集合规则弹窗：表格整表一次写入（每行 = 一条附加网络集合规则） */
    async npTableImport() {
      const np = this.ctx.netpair;
      if (!np)
        return;
      const result = await this.readNetSetTable();
      if (!result.rows) {
        if (result.error) {
          this.ctx.error = result.error;
          this.publish();
        }
        return;
      }
      const group = np.group || np.groups[0];
      if (!group) {
        this.ctx.error = this.t("netpair.error.noGroup");
        this.publish();
        return;
      }
      const groupRules = np.rules[group] || [];
      const badRows = result.rows.map((row, index) => ({ row, line: index + 1 })).filter((item) => !groupRules.includes(item.row.rule));
      if (badRows.length) {
        this.ctx.error = `\u7B2C ${badRows.map((item) => item.line).join("\u3001")} \u884C\u7684\u89C4\u5219\u4E0D\u5728\u5206\u7EC4\u300C${group}\u300D\u4E2D\uFF08\u53EF\u9009\uFF1A${groupRules.join("\u3001") || "\u8BE5\u5206\u7EC4\u8FD8\u6CA1\u6709\u89C4\u5219"}\uFF09\uFF0C\u8BF7\u4FEE\u6B63 rule \u5217\u540E\u91CD\u8BD5`;
        this.publish();
        return;
      }
      const drafts = result.rows.map((row) => ({ group, ...row }));
      this.ctx.error = void 0;
      this.publish({ view: "busy", busyText: this.t("busy.write") });
      try {
        await this.writeNetPairDrafts(group, drafts);
      } catch (e) {
        this.ctx.error = `${this.t("error.import")}${String(e?.message || e)}`;
        this.publish({ view: "select-netpair" });
      }
    }
    /**
     * 写入一组附加网络集合草稿（手输单条 / 表格多行共用）：构造成「仅含网络-网络规则
     * （必要时含网络规则）」的配置集，复用导入管线 —— 建类冲突回退、单集合建类 /
     * 网络规则语义、缺失网络求交、日志与还原与「导出配置 → 导入」路径完全一致。
     */
    async writeNetPairDrafts(group, drafts, warnings = []) {
      try {
        const file = {
          schema: SCHEMA_ID,
          schemaVersion: SCHEMA_VERSION,
          generator: GENERATOR,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: {},
          modules: ["netByNetRules"],
          data: {}
        };
        const drc2 = eda2().pcb_Drc;
        const currentGroups = await drc2.getNetByNetRules() || {};
        file.data.netByNetRules = {};
        for (const key of Object.keys(currentGroups))
          file.data.netByNetRules[key] = JSON.parse(JSON.stringify(currentGroups[key] || []));
        appendPairDrafts(file, drafts);
        const keyOf = (entry) => `${[String(entry.net1?.name ?? "").toLowerCase(), String(entry.net2?.name ?? "").toLowerCase()].sort().join("|")}@${String(entry.rule ?? "").toLowerCase()}`;
        const existingKeys = new Set((currentGroups[group] || []).map(keyOf));
        file.data.netByNetRules[group] = (file.data.netByNetRules[group] || []).filter((entry) => {
          if (entry.single)
            return true;
          const isNetRef = (ref) => !!ref && ref.type === "net";
          if (!isNetRef(entry.net1) || !isNetRef(entry.net2))
            return true;
          return !existingKeys.has(keyOf(entry));
        });
        const scope = file.modules.filter((key) => key !== "ruleConfig");
        const outcome = await runImport(file, scope);
        scheduleOverlayCleanup({
          onCleanup: () => toast(this.t("toast.overlayCleared"))
        });
        this.ctx.snapshot = {
          data: JSON.parse(JSON.stringify(outcome.current.data)),
          modules: scope,
          draftClasses: outcome.plan.draftClasses.map((cls) => cls.name)
        };
        this.ctx.steps = (outcome.applied?.steps || []).map((step) => ({
          label: step.label,
          ok: step.ok,
          verified: step.verified,
          error: step.error,
          detail: this.stepDetail(step, outcome)
        }));
        this.ctx.skippedItems = outcome.plan.skipped.map((item) => ({ module: item.module, what: item.what, reason: item.reason }));
        this.ctx.residualSummary = outcome.residual?.summary;
        this.ctx.warnings = warnings;
        this.ctx.restored = false;
        this.ctx.log = this.buildLog(this.t("log.netpairHeader"), `${group} / ${drafts.length} \u6761`);
        toast(this.t("netpair.toast.done"));
        this.publish({ view: "result" });
      } catch (e) {
        this.ctx.error = `${this.t("error.import")}${String(e?.message || e)}`;
        this.publish({ view: "select-netpair" });
      }
    }
    // ---------------------------------------------------------------- 导入三步
    async pickFile() {
      this.ctx.error = void 0;
      this.publish({ view: "busy", busyText: "\u8BF7\u5728\u5F39\u51FA\u7684\u7A97\u53E3\u4E2D\u9009\u62E9\u914D\u7F6E\u6587\u4EF6\u2026" });
      let file;
      try {
        file = await fileSystem().openReadFileDialog(["json"], false);
      } catch (e) {
        this.ctx.error = `${this.t("error.openDialog")}${String(e?.message || e)}`;
        this.publish();
        return;
      }
      if (!file) {
        this.publish();
        return;
      }
      try {
        const parsed = parseConfigSet(await file.text());
        if (parsed.error || !parsed.file) {
          this.ctx.error = parsed.error || "\u6587\u4EF6\u89E3\u6790\u5931\u8D25";
          this.ctx.file = void 0;
          this.publish({ view: "select-import" });
          return;
        }
        this.ctx.file = parsed.file;
        this.ctx.fileName = file.name;
        this.ctx.fileSize = file.size;
        this.ctx.warnings = parsed.warnings;
        this.ctx.diff = void 0;
        this.ctx.steps = void 0;
        this.ctx.snapshot = void 0;
        this.ctx.restored = void 0;
        this.publish({ view: "select-import" });
      } catch (e) {
        this.ctx.error = `${this.t("error.readFile")}${String(e?.message || e)}`;
        this.publish({ view: "select-import" });
      }
    }
    /**
     * 导入 / 预览的作用域 = 配置文件实际声明的模块。
     *
     * 文件没提到的模块一律不动。裸规则配置只含 ruleConfig，若按全模块对比，
     * 本机已有的网络类 / 差分对 / 等长组会被当成「文件里没有 = 需要清空」而删除。
     * 真机实测证据见 .probe/p69-diff-detail.json（P-70）。
     */
    scopeModules() {
      const declared = this.ctx.file?.modules || [];
      const scoped = ALL_MODULES.filter((key) => declared.includes(key));
      return scoped.length ? scoped : [...ALL_MODULES];
    }
    async buildPreview() {
      const file = this.ctx.file;
      if (!file)
        return;
      this.publish({ view: "busy", busyText: this.t("busy.compare") });
      try {
        const index = await buildNetIndex();
        const modules = this.scopeModules();
        const current = await collectModules(modules);
        const plan = buildPlan(file, current.data, index, modules);
        this.ctx.diff = diffPlan(plan, current.data);
        this.ctx.snapshot = {
          data: JSON.parse(JSON.stringify(current.data)),
          modules,
          draftClasses: plan.draftClasses.map((cls) => cls.name)
        };
        this.ctx.restored = void 0;
        this.ctx.error = void 0;
        this.publish({ view: "preview" });
      } catch (e) {
        this.ctx.error = `${this.t("error.diff")}${String(e?.message || e)}`;
        this.publish({ view: "preview" });
      }
    }
    async applyImport() {
      const file = this.ctx.file;
      if (!file)
        return;
      this.publish({ view: "busy", busyText: this.t("busy.write") });
      try {
        const outcome = await runImport(file, this.scopeModules());
        scheduleOverlayCleanup({
          onCleanup: () => toast(this.t("toast.overlayCleared"))
        });
        this.ctx.steps = (outcome.applied?.steps || []).map((step) => ({
          label: step.label,
          ok: step.ok,
          verified: step.verified,
          error: step.error,
          detail: this.stepDetail(step, outcome)
        }));
        this.ctx.skippedItems = outcome.plan.skipped.map((item) => ({ module: item.module, what: item.what, reason: item.reason }));
        this.ctx.residualSummary = outcome.residual?.summary;
        this.ctx.warnings = [...this.ctx.warnings, ...outcome.diff.warnings || []];
        this.ctx.restored = false;
        this.ctx.log = this.buildLog();
        this.publish({ view: "result" });
      } catch (e) {
        this.ctx.error = `${this.t("error.import")}${String(e?.message || e)}`;
        this.publish({ view: "result" });
      }
    }
    /** 结果步骤的「人话」明细：成功时显示实际改动（来自预览差异统计），失败时保留原始校验差异 */
    stepDetail(step, outcome) {
      if (!step.ok) {
        if (Array.isArray(step.detail) && step.detail.length)
          return step.detail.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("\uFF1B");
        return void 0;
      }
      if (step.name === "deleteDraftClasses") {
        const names = Array.isArray(step.detail) ? step.detail.map((item) => item?.name).filter(Boolean) : [];
        return names.length ? `\u5220\u9664\u8349\u7A3F\u5EFA\u7684\u7F51\u7EDC\u7C7B ${names.join("\u3001")}` : void 0;
      }
      if (step.name === "draftClasses" && Array.isArray(step.detail)) {
        const parts2 = step.detail.map((item) => {
          if (item?.action === "createDraftClass")
            return `\u65B0\u5EFA\u7F51\u7EDC\u7C7B ${item.name}`;
          if (item?.action === "addDraftNet")
            return `\u7F51\u7EDC\u7C7B ${item.name} \u8FFD\u52A0\u6210\u5458 ${(item.nets || []).join("\u3001")}`;
          return null;
        }).filter(Boolean);
        return parts2.length ? parts2.join("\uFF1B") : "\u65E0\u53D8\u5316";
      }
      const countable = ["ruleConfig", "netClasses", "equalLengthGroups", "differentialPairs", "netRules", "netByNetRules"];
      if (!step.name || !countable.includes(step.name))
        return void 0;
      const counts = {};
      for (const entry of outcome.diff.entries) {
        if (entry.module !== step.name)
          continue;
        counts[entry.kind] = (counts[entry.kind] || 0) + 1;
      }
      const parts = [];
      if (counts.added)
        parts.push(`\u65B0\u589E ${counts.added} \u6761`);
      if (counts.modified)
        parts.push(`\u4FEE\u6539 ${counts.modified} \u6761`);
      if (counts.removed)
        parts.push(`\u5220\u9664 ${counts.removed} \u6761`);
      if (counts.kept)
        parts.push(`\u4FDD\u7559 ${counts.kept} \u6761`);
      return parts.length ? parts.join(" / ") : "\u65E0\u53D8\u5316";
    }
    /**
     * 一键还原到导入前。
     *
     * 平台没有开放规则配置的撤销栈：真机实测 MSG_BUS_PCB.publish('undo') 只回退画布图元，
     * 规则数值不变（证据 .probe/p155-undo-test2-raw.json、p160-undo-ab2-raw.json），
     * 因此用「导入前快照 + 反向写入」实现回退，作用域与本次导入完全一致。
     */
    async doRestore() {
      const snapshot = this.ctx.snapshot;
      if (!snapshot)
        return;
      this.ctx.error = void 0;
      this.publish({ view: "busy", busyText: this.t("busy.write") });
      try {
        const file = {
          schema: SCHEMA_ID,
          schemaVersion: SCHEMA_VERSION,
          generator: GENERATOR,
          exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
          source: {},
          modules: snapshot.modules,
          data: snapshot.data
        };
        const outcome = await runImport(file, snapshot.modules, { exact: true, deleteClasses: snapshot.draftClasses });
        scheduleOverlayCleanup({
          onCleanup: () => toast(this.t("toast.overlayCleared"))
        });
        this.ctx.steps = (outcome.applied?.steps || []).map((step) => ({
          label: step.label,
          ok: step.ok,
          verified: step.verified,
          error: step.error,
          detail: Array.isArray(step.detail) ? step.detail.slice(0, 30) : void 0
        }));
        this.ctx.residualSummary = outcome.residual?.summary;
        this.ctx.warnings = [...this.ctx.warnings, ...outcome.diff.warnings || []];
        this.ctx.snapshot = void 0;
        this.ctx.restored = true;
        this.ctx.log = [...this.ctx.log, `${this.t("log.restore")}${this.t("log.restored")}`];
        toast(this.t("toast.restored"));
        this.publish({ view: "result" });
      } catch (e) {
        this.ctx.error = `${this.t("error.import")}${String(e?.message || e)}`;
        this.publish({ view: "result" });
      }
    }
    /** header / fileLabel 供「网络集合规则」直写入口复用同一套日志结构 */
    buildLog(header = this.t("log.importHeader"), fileLabel) {
      const lines = [];
      lines.push(`${header}  ${formatDateTime(/* @__PURE__ */ new Date())}`);
      lines.push(`${this.t("log.file")}${fileLabel ?? this.ctx.fileName ?? "-"}`);
      for (const step of this.ctx.steps || []) {
        const detail = step.detail ? ` \u2014 ${typeof step.detail === "string" ? step.detail : JSON.stringify(step.detail)}` : "";
        lines.push(`[${step.ok ? this.t("log.ok") : this.t("log.fail")}] ${step.label}${step.error ? ` \u2014 ${step.error}` : ""}${detail}`);
      }
      for (const item of this.ctx.skippedItems || []) {
        const label = MODULE_LABELS[item.module] ?? item.module;
        lines.push(`[\u8DF3\u8FC7] ${label} \xB7 ${item.what} \u2014 ${item.reason}`);
      }
      const residual = this.ctx.residualSummary;
      if (residual) {
        lines.push(this.t("log.residual", [
          residual.added,
          residual.modified,
          residual.removed,
          residual.kept,
          residual.skipped,
          residual.unsupported
        ]));
      }
      for (const warning of this.ctx.warnings) lines.push(`${this.t("log.hint")}${warning}`);
      return lines;
    }
    // ---------------------------------------------------------------- 导出
    async doExport(payload) {
      const chosen = payload.modules && payload.modules.length ? payload.modules : ALL_MODULES;
      const drafts = (payload.pairDrafts || []).filter((draft) => draft && Array.isArray(draft.aNets) && Array.isArray(draft.bNets));
      const typed = String(payload.fileName || "").trim();
      const name = typed ? /\.json$/i.test(typed) ? typed : `${typed}.json` : this.ctx.exportFileName;
      this.ctx.modules = Object.fromEntries(ALL_MODULES.map((key) => [key, chosen.includes(key)]));
      this.publish({ view: "busy", busyText: this.t("busy.export") });
      try {
        const outcome = await runExport(chosen, {});
        appendPairDrafts(outcome.file, drafts);
        if (drafts.length && !chosen.includes("netByNetRules"))
          chosen.push("netByNetRules");
        const blob = new Blob([JSON.stringify(outcome.file, null, "	")], { type: "application/json" });
        await fileSystem().saveFile(blob, name);
        this.ctx.savedName = name;
        this.ctx.settings = { ...this.ctx.settings, lastExportModules: [...chosen] };
        await saveSettings({ lastExportModules: [...chosen] });
        this.ctx.steps = chosen.map((key) => ({
          label: MODULE_LABELS[key],
          ok: true,
          detail: this.countModule(outcome.file, key)
        }));
        this.ctx.log = [
          `${this.t("log.exportHeader")}  ${formatDateTime(/* @__PURE__ */ new Date())}`,
          `${this.t("log.result")}${name}`,
          `${this.t("log.modules")}${chosen.map((key) => MODULE_LABELS[key]).join("\u3001")}`
        ];
        this.publish({ view: "result" });
      } catch (e) {
        this.ctx.error = `${this.t("error.export")}${String(e?.message || e)}`;
        this.publish({ view: "result" });
      }
    }
    countModule(file, key) {
      const value = file.data[key];
      if (value === void 0)
        return "\u65E0\u6570\u636E";
      if (Array.isArray(value))
        return `${value.length} \u6761`;
      if (key === "ruleConfig") {
        const groups = Object.keys(value).length;
        let rules = 0;
        for (const top of Object.keys(value)) rules += Object.keys(value[top] || {}).length;
        return `${groups} \u4E2A\u5206\u7EC4 / ${rules} \u6761\u89C4\u5219`;
      }
      return `${Object.keys(value).length} \u4E2A\u5206\u7EC4`;
    }
  };

  // src/index.ts
  var wizard;
  function ensureWizard() {
    if (!wizard) {
      setEdaApi(eda);
      wizard = new Wizard();
    }
    return wizard;
  }
  function activate() {
    ensureWizard();
  }
  async function importRuleConfig() {
    await ensureWizard().open("import");
  }
  async function exportRuleConfig() {
    await ensureWizard().open("export");
  }
  async function netPairRules() {
    await ensureWizard().open("netpair");
  }
  function about() {
    eda.sys_Dialog.showInformationMessage(
      `${extension_default.displayName} v${extension_default.version}
${extension_default.description ?? ""}`,
      "\u5173\u4E8E"
    );
  }
  return __toCommonJS(src_exports);
})();
