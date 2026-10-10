'use strict';
const fs = require('node:fs/promises'), crypto = require('node:crypto');
const { validateManifest } = require('./lib/contract');
const base = 'https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY;
const headers = { authorization: 'Bearer ' + process.env.GITHUB_TOKEN, 'User-Agent': 'ME-plugin-publisher', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
async function api(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw Error('GitHub HTTP ' + response.status);
  return response.status === 204 ? null : response.json();
}
async function upload(release, name, bytes) {
  const response = await fetch(release.upload_url.split('{')[0] + '?name=' + encodeURIComponent(name), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: bytes, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error('Asset upload HTTP ' + response.status); return response.json();
}
async function main() {
  const receipt = JSON.parse(await fs.readFile('output/receipt.json', 'utf8'));
  const manifest = validateManifest(receipt.manifest);
  if (manifest.id !== receipt.pluginId || manifest.version !== receipt.version || receipt.filename !== `${manifest.id}-${manifest.version}.zip`) throw Error('Invalid package receipt');
  const bytes = await fs.readFile('output/' + receipt.filename);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== receipt.packageSha256 || bytes.length !== receipt.size) throw Error('Package changed');
  const key = crypto.createPrivateKey(process.env.CATALOG_SIGNING_KEY), publicKey = crypto.createPublicKey(key);
  const tag = manifest.id + '-v' + manifest.version;
  let release = await api('/releases/tags/' + tag);
  if (!release) release = await api('/releases', 'POST', { tag_name: tag, name: manifest.name['en-US'] + ' ' + manifest.version, draft: true, body: 'Reviewed source SHA-256: ' + receipt.sourceSha256 + '\nPackage SHA-256: ' + receipt.packageSha256 });
  let asset = release.assets.find(item => item.name === receipt.filename);
  if (asset && asset.digest !== 'sha256:' + receipt.packageSha256) throw Error('Published version cannot be overwritten');
  if (!asset) asset = await upload(release, receipt.filename, bytes);
  if (asset.digest !== 'sha256:' + receipt.packageSha256 || asset.size !== receipt.size) throw Error('Remote package verification failed');
  if (release.draft) release = await api('/releases/' + release.id, 'PATCH', { draft: false });
  let catalogRelease = await api('/releases/tags/plugin-catalog');
  if (!catalogRelease) catalogRelease = await api('/releases', 'POST', { tag_name: 'plugin-catalog', name: 'ME plugin catalog', body: 'Signed plugin catalog. Plugin source submissions are private.', draft: false });
  const previous = catalogRelease.assets.find(item => item.name === 'catalog.json');
  let entries = [];
  if (previous) {
    const response = await fetch(previous.browser_download_url, { signal: AbortSignal.timeout(60000) }); if (!response.ok) throw Error('Catalog unavailable');
    const envelope = await response.json();
    if (!crypto.verify(null, Buffer.from(envelope.payload), publicKey, Buffer.from(envelope.signature, 'base64'))) throw Error('Existing catalog signature invalid');
    entries = JSON.parse(envelope.payload).plugins;
  }
  const item = { manifest, sha256: receipt.packageSha256, sourceSha256: receipt.sourceSha256, size: receipt.size, url: asset.browser_download_url, releaseUrl: release.html_url };
  entries = [...entries.filter(entry => entry.manifest.id !== manifest.id), item];
  const payload = JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), plugins: entries });
  const envelope = Buffer.from(JSON.stringify({ payload, signature: crypto.sign(null, Buffer.from(payload), key).toString('base64') }));
  // Publish a single signed envelope; clients retain their last verified catalog during replacement.
  if (previous) await api('/releases/assets/' + previous.id, 'DELETE');
  await upload(catalogRelease, 'catalog.json', envelope);
  const response = await fetch(process.env.REVIEW_URL + '/v1/plugins/build/' + receipt.id + '/complete', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.PLUGIN_BUILD_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSha256: receipt.sourceSha256, packageSha256: receipt.packageSha256, releaseUrl: release.html_url }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error('Review completion HTTP ' + response.status);
  console.log('Published package and signed catalog; review status updated.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
