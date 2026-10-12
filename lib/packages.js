'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { validateManifest, parseArchiveListing, safeRelativePath, LIMITS, fail } = require('./contract');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function atomic(filename, data) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temp = filename + '.' + crypto.randomUUID() + '.tmp';
  await fs.writeFile(temp, JSON.stringify(data), { flag: 'wx' });
  try { await fs.copyFile(filename, filename + '.bak'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(temp, filename);
}
async function plainRoot(directory) {
  await fs.mkdir(directory, { recursive: true });
  if ((await fs.lstat(directory)).isSymbolicLink() || path.resolve(await fs.realpath(directory)).toLowerCase() !== path.resolve(directory).toLowerCase()) fail('PLUGIN_UNSAFE_DIRECTORY');
}
class PluginPackages {
  constructor({ directory, sevenZip, runFile = promisify(execFile) }) {
    Object.assign(this, { directory: path.resolve(directory), sevenZip, runFile });
    this.filename = path.join(this.directory, 'installed.json');
    this.pending = new Map(); this.serial = Promise.resolve();
  }
  async read() {
    await plainRoot(this.directory);
    try { const data = JSON.parse(await fs.readFile(this.filename, 'utf8')); if (data.schemaVersion !== 1 || !Array.isArray(data.plugins)) fail('PLUGIN_STATE_INVALID'); return data; }
    catch (error) { if (error.code === 'ENOENT') return { schemaVersion: 1, plugins: [] }; throw error; }
  }
  queue(fn) { const next = this.serial.then(fn); this.serial = next.catch(() => {}); return next; }
  async prepare(filename) {
    await plainRoot(this.directory);
    if (!['.zip', '.7z'].includes(path.extname(filename).toLowerCase())) fail('PLUGIN_ARCHIVE_INVALID');
    const info = await fs.lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.size > LIMITS.archiveBytes) fail('PLUGIN_ARCHIVE_TOO_LARGE');
    if (this.pending.size >= 8) fail('PLUGIN_BUSY');
    const ticket = crypto.randomUUID(), stage = path.join(this.directory, '.stage-' + ticket);
    await fs.mkdir(stage);
    try {
      const archive = path.join(stage, 'package' + path.extname(filename).toLowerCase());
      await fs.copyFile(filename, archive, fs.constants.COPYFILE_EXCL);
      const bytes = await fs.readFile(archive);
      if (bytes.length > LIMITS.archiveBytes) fail('PLUGIN_ARCHIVE_TOO_LARGE');
      const options = { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 ** 2 };
      const { stdout } = await this.runFile(this.sevenZip, ['l', '-slt', '-sccUTF-8', '--', archive], options);
      const entries = parseArchiveListing(stdout);
      const content = path.join(stage, 'content'); await fs.mkdir(content);
      await this.runFile(this.sevenZip, ['x', '-y', '-sccUTF-8', '-o' + content, '--', archive], options);
      const hashes = {};
      for (const entry of entries) {
        const file = path.join(content, entry.path), stat = await fs.lstat(file);
        if (stat.isSymbolicLink() || !path.resolve(await fs.realpath(file)).startsWith(path.resolve(content) + path.sep) || (entry.directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1 || stat.size !== entry.size)) fail('PLUGIN_ARCHIVE_UNSAFE');
        if (!entry.directory) hashes[entry.path] = digest(await fs.readFile(file));
      }
      if (!hashes['plugin.json'] || !hashes['README.md']) fail('PLUGIN_MANIFEST_MISSING');
      const manifest = validateManifest(JSON.parse(await fs.readFile(path.join(content, 'plugin.json'), 'utf8')));
      if (!hashes[manifest.entry]) fail('PLUGIN_ENTRY_INVALID');
      this.pending.set(ticket, { stage, content, manifest, hashes, sha256: digest(bytes), expiresAt: Date.now() + 10 * 60 * 1000 });
      return { ticket, manifest, sha256: digest(bytes), reviewed: false };
    } catch (error) { await fs.rm(stage, { recursive: true, force: true }); throw error; }
  }
  install({ ticket, acceptRisk }) {
    return this.queue(async () => {
      const pending = this.pending.get(ticket);
      if (!pending || pending.expiresAt < Date.now() || acceptRisk !== true) fail('PLUGIN_APPROVAL_REQUIRED');
      const { manifest, hashes, content } = pending;
      for (const [name, hash] of Object.entries(hashes)) if (digest(await fs.readFile(path.join(content, safeRelativePath(name)))) !== hash) fail('PLUGIN_PACKAGE_CHANGED');
      const data = await this.read(), previous = data.plugins.find(item => item.manifest.id === manifest.id);
      const base = path.join(this.directory, manifest.id), versions = path.join(base, 'versions');
      await plainRoot(versions);
      const destination = path.join(versions, manifest.version);
      if (await fs.access(destination).then(() => true, () => false)) fail('PLUGIN_VERSION_EXISTS');
      await fs.rename(content, destination);
      const installed = { manifest, sha256: pending.sha256, hashes, enabled: false, installedAt: new Date().toISOString(), previousVersion: previous?.manifest.version || null };
      try { await atomic(this.filename, { schemaVersion: 1, plugins: [...data.plugins.filter(item => item.manifest.id !== manifest.id), installed] }); }
      catch (error) { await fs.rename(destination, content); throw error; }
      this.pending.delete(ticket); await fs.rm(pending.stage, { recursive: true, force: true });
      return installed;
    });
  }
  async resolve(id) {
    const item = (await this.read()).plugins.find(plugin => plugin.manifest.id === id);
    if (!item) fail('PLUGIN_NOT_FOUND');
    validateManifest(item.manifest);
    const directory = path.join(this.directory, id, 'versions', item.manifest.version);
    await plainRoot(directory);
    for (const [name, hash] of Object.entries(item.hashes)) {
      const file = path.join(directory, safeRelativePath(name));
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || !path.resolve(await fs.realpath(file)).startsWith(directory + path.sep) || digest(await fs.readFile(file)) !== hash) fail('PLUGIN_PACKAGE_CHANGED');
    }
    return { ...item, directory };
  }
  setEnabled(id, enabled) { return this.queue(async () => { await this.resolve(id); const data = await this.read(); data.plugins.find(item => item.manifest.id === id).enabled = enabled === true; await atomic(this.filename, data); }); }
  uninstall(id) { return this.queue(async () => {
    const data = await this.read(), installed = data.plugins.find(item => item.manifest.id === id);
    if (!installed) fail('PLUGIN_NOT_FOUND');
    validateManifest(installed.manifest);
    const target = path.join(this.directory, id);
    await plainRoot(target);
    // Persist removal before cleanup; failures leave only unregistered version files.
    await atomic(this.filename, { ...data, plugins: data.plugins.filter(item => item.manifest.id !== id) });
    await fs.rm(target, { recursive: true, force: true });
  }); }
  async discard(ticket) {
    const pending = this.pending.get(ticket); if (!pending) return;
    this.pending.delete(ticket); await plainRoot(pending.stage);
    await fs.rm(pending.stage, { recursive: true, force: true });
  }
  async dispose() { await this.serial; for (const ticket of this.pending.keys()) await this.discard(ticket); }
}
module.exports = { PluginPackages, atomic, plainRoot, digest };
