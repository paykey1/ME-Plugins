'use strict';
const crypto = require('node:crypto');
const { fail } = require('./contract');
function fingerprint(publicKey) { return crypto.createHash('sha256').update(crypto.createPublicKey(publicKey).export({ type: 'spki', format: 'der' })).digest('hex'); }
function publisher(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'id,origin' || !['official','community'].includes(value.origin) || typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)) fail('PLUGIN_PUBLISHER_INVALID');
  return { origin: value.origin, id: value.id };
}
function payload(hashes, identity) {
  return JSON.stringify({ schemaVersion: identity === undefined ? 1 : 2, purpose: 'me-plugin-package', ...(identity === undefined ? {} : { publisher: publisher(identity) }), files: Object.fromEntries(Object.entries(hashes).filter(([name]) => name !== 'signature.json').sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) });
}
function verify(envelope, hashes, publicKey) {
  if (!publicKey || !envelope || ![1,2].includes(envelope.schemaVersion) || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)) fail('PLUGIN_PACKAGE_SIGNATURE_INVALID');
  if (envelope.schemaVersion === 1 && envelope.publisher !== undefined) fail('PLUGIN_PACKAGE_SIGNATURE_INVALID');
  if (!crypto.verify(null, Buffer.from(payload(hashes, envelope.schemaVersion === 2 ? publisher(envelope.publisher) : undefined)), publicKey, Buffer.from(envelope.signature, 'base64'))) fail('PLUGIN_PACKAGE_SIGNATURE_INVALID');
  return fingerprint(publicKey);
}
module.exports = { fingerprint, payload, verify, publisher };
