'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const { promisify } = require('node:util'), { execFile } = require('node:child_process');
const { PluginPackages, digest } = require('./lib/packages');
const { safeRelativePath } = require('./lib/contract');
async function main() {
  const approved = JSON.parse(await fs.readFile('approved.json', 'utf8'));
  const sevenZip = process.env.SEVEN_ZIP || 'C:/Program Files/7-Zip/7z.exe';
  const packages = new PluginPackages({ directory: path.resolve('.validated'), sevenZip });
  try {
    const prepared = await packages.prepare(path.resolve('source.' + approved.format));
    const manifest = prepared.manifest;
    if (prepared.sha256 !== approved.sourceSha256 || manifest.id !== approved.pluginId || manifest.version !== approved.version) throw Error('Reviewed identity does not match archive');
    if (!Array.isArray(manifest.files) || manifest.files.length > 10000 || !['plugin.json', 'README.md', 'LICENSE.txt', manifest.entry].every(file => manifest.files.includes(file))) throw Error('Official packages require an explicit distribution file list and license');
    const selected = new Set();
    const { content, hashes } = packages.pending.get(prepared.ticket);
    await fs.mkdir('distribution');
    for (const name of manifest.files) {
      safeRelativePath(name); if (selected.has(name) || !Object.hasOwn(hashes, name)) throw Error('Invalid distribution file'); selected.add(name);
      const target = path.resolve('distribution', name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(path.join(content, name), target);
    }
    await fs.mkdir('output');
    const filename = `${manifest.id}-${manifest.version}.zip`;
    await promisify(execFile)(sevenZip, ['a', '-tzip', path.resolve('output', filename), '.'], { cwd: path.resolve('distribution'), windowsHide: true });
    const bytes = await fs.readFile(path.join('output', filename));
    await fs.writeFile('output/receipt.json', JSON.stringify({ ...approved, manifest, filename, packageSha256: digest(bytes), size: bytes.length }));
    console.log('Validated and packaged reviewed source; no submitted code was executed.');
  } finally { await packages.dispose(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
