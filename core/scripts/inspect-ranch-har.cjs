#!/usr/bin/env node
// Offline metadata coverage only. Never decrypt, replay or output tokens, URLs, IDs or payload bodies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const protobuf = require('protobufjs');
function inspect(filename) {
    const bytes = fs.readFileSync(filename);
    const har = JSON.parse(bytes.toString('utf8'));
    const root = protobuf.parse(fs.readFileSync(path.join(__dirname, '../src/proto/game.proto'), 'utf8'), { keepCase: true }).root;
    const Gate = root.lookupType('gatepb.Message');
    const methods = {};
    let frames = 0, undecodable = 0, metadataFrames = 0;
    for (const entry of har.log?.entries || []) {
        for (const frame of entry._webSocketMessages || []) {
            frames++;
            if (typeof frame.payload?.buffer !== 'string') { undecodable++; continue; }
            try {
                const meta = Gate.decode(Buffer.from(frame.payload.buffer, 'base64')).meta;
                if (!meta?.service_name || !meta.method_name) continue;
                metadataFrames++;
                // Gate metadata is untrusted input; only retain protobuf-style identifiers.
                const key = `${meta.service_name}.${meta.method_name}`;
                if (!/^[A-Za-z0-9_.]+$/.test(key)) continue;
                const row = methods[key] ||= { frames: 0, types: {}, errorCodes: {} };
                row.frames++;
                row.types[String(meta.message_type)] = (row.types[String(meta.message_type)] || 0) + 1;
                if (String(meta.error_code || 0) !== '0') row.errorCodes[String(meta.error_code)] = (row.errorCodes[String(meta.error_code)] || 0) + 1;
            } catch { undecodable++; }
        }
    }
    return { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), entries: har.log?.entries?.length || 0, frames, metadataFrames, undecodable, methods };
}
if (require.main === module) {
    if (!process.argv[2]) throw new Error('Usage: node scripts/inspect-ranch-har.cjs /absolute/capture.har');
    process.stdout.write(`${JSON.stringify(inspect(process.argv[2]), null, 2)}\n`);
}
module.exports = { inspect };
