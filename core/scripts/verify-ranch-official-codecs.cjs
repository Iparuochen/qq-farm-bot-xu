#!/usr/bin/env node
// Offline only: execute the official generated protobuf codecs, never game network code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const protobuf = require('protobufjs/minimal');
const { createRanchProtocol } = require('../src/services/ranch-protocol');
const base = process.argv[2];
if (!base) throw new Error('Pass the read-only analysis snapshot directory');
const strings = JSON.parse(fs.readFileSync(path.join(base, 'strings.json')));
const modules = {};
const cc = { cclegacy: { _RF: { push() {}, pop() {} } } };
const helper = { createForOfIteratorHelperLoose(value) { const iter = value[Symbol.iterator](); return () => iter.next(); } };
function load(name) {
    if (name === 'cc') return cc;
    if (name.includes('rollupPlugin')) return helper;
    if (name === './index.js') return { default: require('long') };
    if (name === './protobuf-minimal.ts') return protobuf;
    name = name.replace(/^\.\//, '').replace(/\.ts$/, '');
    if (modules[name]) return modules[name];
    const exports = modules[name] = {};
    let source = fs.readFileSync(path.join(base, 'modules', `${name}.ts.js`), 'utf8');
    source = source.replace(/\b(?:Rn|Kn|pn|bn|En|Gn|qn|In|Sn|xn|Yn|Qn|wn|On|kn|Xn|An|mn|yn)\[(\d+(?:\.\d+)?(?:e\+?\d+)?)\]/g, (_, n) => `[${JSON.stringify(strings[Number(n)])}]`).replace(/\[\[("[^"\]]+")\]\]/g, '[$1]');
    source = source.replace(/,\s*$/, ';');
    const globals = {};
    for (const m of source.matchAll(/(?<![\w$])([\w$]+)\(\)\["(entries|fromEntries|Number|String|Error|keys|values|isArray)"\]/g)) globals[m[1]] = () => ({ ...globalThis, ...Object, entries: Object.entries, fromEntries: Object.fromEntries, keys: Object.keys, values: Object.values, isArray: Array.isArray, Number, String, Error });
    vm.runInNewContext(source, { ...globals, System: { register(_name, deps, declare) {
        const registration = declare((key, value) => { exports[key] = value; return value; });
        registration.setters.forEach((setter, i) => setter(load(deps[i])));
        registration.execute();
    } }, Uint8Array, Number, Error, console }, { timeout: 10000 });
    return exports;
}
const protocol = createRanchProtocol();
const fixtures = [];
function sample(type, depth = 0) {
    const value = {};
    for (const field of type.fieldsArray) {
        field.resolve();
        if (field.name === 'params') continue; // Farm experiment map is not a ranch data dependency.
        let v;
        if (field.resolvedType) {
            if (depth > 2) continue;
            v = sample(field.resolvedType, depth + 1);
        } else if (field.type === 'string') v = 'official-fixture';
        else if (field.type === 'bool') v = true;
        else if (field.type === 'bytes') v = Buffer.from([1, 2]);
        else v = field.id + 1;
        value[field.name] = field.map ? { '2': v } : field.repeated ? [v] : v;
    }
    return value;
}
for (const [method, descriptor] of Object.entries(protocol.rpc)) {
    const module = descriptor.requestType.name.slice(0, -(`${method}Request`.length + 1));
    const official = load(module);
    for (const [direction, type, name] of [['request', descriptor.requestType, `${method}Request`], ['response', descriptor.responseType, `${method}Reply`]]) {
        const params = sample(type);
        const codec = official[name];
        const bytes = Buffer.from(codec.encode(codec.fromPartial(params)).finish());
        const ours = Buffer.from(type.encode(type.fromObject(params)).finish());
        // ts-proto emits empty packed vectors, while protobufjs omits them; semantic equality required.
        assert.deepEqual(type.toObject(type.decode(bytes), { longs: String, defaults: true }), type.toObject(type.decode(ours), { longs: String, defaults: true }), `${method} ${direction}`);
        fixtures.push({ method, direction, params, hex: bytes.toString('hex') });
    }
}
const target = path.join(__dirname, '../test/fixtures/ranch-official-codecs.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Verified ${fixtures.length} request/response fixtures against official generated codecs; wrote ${target}`);
