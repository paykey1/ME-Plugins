'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { validateManifest, parseArchiveListing, safeRelativePath, LIMITS, fail } = require('./contract');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Keep file I/O bounded. Drain every in-flight check before callers remove a failed stage.
async function checkFiles(entries, check) {
  let next = 0, failed = false, error;
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
    while (!failed && next < entries.length) {
      const entry = entries[next++];
      try { await check(entry); } catch (cause) { failed = true; error ||= cause; }
    }
  }));
  if (failed) throw error;
}
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
  #catalogApprovals = new WeakMap();
  constructor({ directory, sevenZip, runFile = promisify(execFile), publicKey = require('./catalog-config.json').publicKey }) {
    Object.assign(this, { directory: path.resolve(directory), sevenZip, runFile });
    this.filename = path.join(this.directory, 'installed.json');
    this.pending = new Map(); this.serial = Promise.resolve();
    this.publicKey = publicKey;
  }
  async read() {
    await plainRoot(this.directory);
    try { const data = JSON.parse(await fs.readFile(this.filename, 'utf8')); if (data.schemaVersion !== 1 || !Array.isArray(data.plugins)) fail('PLUGIN_STATE_INVALID'); return data; }
    catch (error) { if (error.code === 'ENOENT') return { schemaVersion: 1, plugins: [] }; throw error; }
  }
  queue(fn) { const next = this.serial.then(fn); this.serial = next.catch(() => {}); return next; }
  async prepare(filename, { signal, onProgress = () => {} } = {}) {
    const progress = (phase, done = 0, total = 0) => { signal?.throwIfAborted(); onProgress({ phase, done, total }); };
    progress('reading');
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
      const options = { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 ** 2, signal };
      progress('listing');
      const { stdout } = await this.runFile(this.sevenZip, ['l', '-slt', '-sccUTF-8', '--', archive], options);
      const entries = parseArchiveListing(stdout);
      const content = path.join(stage, 'content'); await fs.mkdir(content);
      progress('extracting');
      await this.runFile(this.sevenZip, ['x', '-y', '-sccUTF-8', '-o' + content, '--', archive], options);
      const hashes = {};
      let verified = 0;
      progress('verifying', 0, entries.length);
      await checkFiles(entries, async entry => {
        signal?.throwIfAborted();
        const file = path.join(content, entry.path), stat = await fs.lstat(file);
        if (stat.isSymbolicLink() || !path.resolve(await fs.realpath(file)).startsWith(path.resolve(content) + path.sep) || (entry.directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1 || stat.size !== entry.size)) fail('PLUGIN_ARCHIVE_UNSAFE');
        if (!entry.directory) hashes[entry.path] = digest(await fs.readFile(file));
        progress('verifying', ++verified, entries.length);
      });
      if (!hashes['plugin.json'] || !hashes['README.md']) fail('PLUGIN_MANIFEST_MISSING');
      const manifest = validateManifest(JSON.parse(await fs.readFile(path.join(content, 'plugin.json'), 'utf8')));
      if (!hashes[manifest.entry] || (manifest.workspace && !hashes[manifest.workspace.entry])) fail('PLUGIN_ENTRY_INVALID');
      const packageSignature = hashes['signature.json'] ? JSON.parse(await fs.readFile(path.join(content, 'signature.json'), 'utf8')) : null;
      const signer = packageSignature ? require('./package-signature').verify(packageSignature, hashes, this.publicKey) : null;
      progress('ready', entries.length, entries.length);
      this.pending.set(ticket, { stage, content, manifest, hashes, signer, packageSignature, sha256: digest(bytes), expiresAt: Date.now() + 10 * 60 * 1000 });
      return { ticket, manifest, publisher: packageSignature?.schemaVersion === 2 ? require('./package-signature').publisher(packageSignature.publisher) : null, sha256: digest(bytes), reviewed: false };
    } catch (error) { await fs.rm(stage, { recursive: true, force: true }).catch(() => {}); if (signal?.aborted) fail('PLUGIN_CANCELLED'); throw error; }
  }
  install({ ticket, acceptRisk }) {
    return this.queue(async () => {
      const pending = this.pending.get(ticket);
      if (!pending || pending.expiresAt < Date.now() || acceptRisk !== true) fail('PLUGIN_APPROVAL_REQUIRED');
      const { manifest, hashes, content } = pending;
      const data = await this.read(), previous = data.plugins.find(item => item.manifest.id === manifest.id);
      const base = path.join(this.directory, manifest.id), versions = path.join(base, 'versions');
      await plainRoot(versions);
      const destination = path.join(versions, manifest.version);
      if (await fs.access(destination).then(() => true, () => false)) fail('PLUGIN_VERSION_EXISTS');
      await fs.rename(content, destination);
      const installed = { manifest, sha256: pending.sha256, hashes, packageSignature: pending.packageSignature, ...require('./activation').installState(previous, manifest, pending.signer || pending.official?.signer || null, pending.packageSignature), installedAt: new Date().toISOString(), previousVersion: previous?.manifest.version || null };
      installed.installationSource = { schemaVersion: 1, channel: this.#catalogApprovals.has(pending) ? 'catalog' : 'local' };
      if (previous && require('./trust').identity(previous) === require('./trust').identity(installed) && require('./trust').permissionsContained(previous.manifest, manifest)) installed.trustGrant = previous.trustGrant || null;
      try {
        await this.verifyPackage(installed, destination);
        await this.#catalogApprovals.get(pending)?.();
        installed.verification = { schemaVersion: 1, boundary: 'install', verifiedAt: new Date().toISOString(), packageHash: installed.sha256, installationId: installed.installationId };
        await atomic(this.filename, { schemaVersion: 1, plugins: [...data.plugins.filter(item => item.manifest.id !== manifest.id), installed] });
      }
      catch (error) { await fs.rename(destination, content); throw error; }
      this.pending.delete(ticket); await fs.rm(pending.stage, { recursive: true, force: true }).catch(() => {});
      return installed;
    });
  }
  // Host-internal catalog code calls this only after signed-catalog, ZIP identity
  // and current distribution authorization. No IPC/SDK exposes this capability.
  authorizeCatalogInstall(ticket, authorize) {
    const pending = this.pending.get(ticket);
    if (typeof authorize !== 'function' || !pending?.official || pending.official.sha256 !== pending.sha256 || pending.official.id !== pending.manifest.id || pending.official.version !== pending.manifest.version) fail('PLUGIN_APPROVAL_REQUIRED');
    this.#catalogApprovals.set(pending, authorize);
  }
  async resolve(id) {
    const item = (await this.read()).plugins.find(plugin => plugin.manifest.id === id);
    if (!item) fail('PLUGIN_NOT_FOUND');
    validateManifest(item.manifest);
    const directory = path.join(this.directory, id, 'versions', item.manifest.version);
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(await fs.realpath(directory)).toLowerCase() !== directory.toLowerCase()) fail('PLUGIN_UNSAFE_DIRECTORY');
      for (const name of new Set([item.manifest.entry, item.manifest.workspace?.entry].filter(Boolean))) {
        if (!Object.hasOwn(item.hashes, name)) fail('PLUGIN_ENTRY_INVALID');
        const file = path.join(directory, safeRelativePath(name)), info = await fs.lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || !path.resolve(await fs.realpath(file)).toLowerCase().startsWith(directory.toLowerCase() + path.sep)) fail('PLUGIN_UNSAFE_PATH');
      }
    } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') fail('PLUGIN_PACKAGE_MISSING'); throw error; }
    return { ...item, directory };
  }
  // Explicit install/update verification only. Normal loading uses resolve and
  // the trusted installation record, never a hidden content-validation cache.
  async verifyPackage(item, directory) {
    await plainRoot(directory);
    const remaining = new Set(Object.keys(item.hashes));
    const walk = async relative => {
      for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
        const name = relative ? relative + '/' + entry.name : entry.name;
        safeRelativePath(name);
        if (entry.isSymbolicLink()) fail('PLUGIN_UNSAFE_PATH');
        if (entry.isDirectory()) await walk(name);
        else if (!entry.isFile() || !remaining.delete(name)) fail('PLUGIN_PACKAGE_CHANGED');
      }
    };
    await walk(''); if (remaining.size) fail('PLUGIN_PACKAGE_CHANGED');
    await checkFiles(Object.entries(item.hashes), async ([name, hash]) => {
      const file = path.join(directory, safeRelativePath(name));
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !path.resolve(await fs.realpath(file)).startsWith(directory + path.sep) || digest(await fs.readFile(file)) !== hash) fail('PLUGIN_PACKAGE_CHANGED');
    });
    if (item.packageSignature) require('./package-signature').verify(item.packageSignature, item.hashes, this.publicKey);
    return { verified: true };
  }
  setEnabled(id, enabled, expectedInstallationId) { return this.queue(async () => { if (enabled === true) await this.resolve(id); const data = await this.read(); const item = data.plugins.find(item => item.manifest.id === id); if (!item) fail('PLUGIN_NOT_FOUND'); if (expectedInstallationId !== undefined && (item.installationId || item.sha256) !== expectedInstallationId) fail('PLUGIN_INSTALLATION_CHANGED'); if (enabled === true && !require('./activation').activated(item)) fail('PLUGIN_ACTIVATION_REQUIRED'); item.enabled = enabled === true; await atomic(this.filename, data); }); }
  activate(id, password) { return this.queue(async () => {
    await this.resolve(id);
    const data = await this.read(), item = data.plugins.find(row => row.manifest.id === id);
    item.installationId ||= crypto.randomUUID();
    try { await require('./activation').verifyPassword(item, password); }
    catch (error) { await atomic(this.filename, data); throw error; }
    await atomic(this.filename, data);
    return { activated: true };
  }); }
  setTrust(id, trusted, confirmed) { return this.queue(async () => {
    if (typeof trusted !== 'boolean' || (trusted && confirmed !== true)) fail('PLUGIN_APPROVAL_REQUIRED');
    await this.resolve(id);
    const data = await this.read(), item = data.plugins.find(row => row.manifest.id === id);
    if (require('./trust').status(item, this.publicKey).fixed) fail('PLUGIN_TRUST_FIXED');
    item.trustGrant = trusted ? { installationId: item.installationId, identity: require('./trust').identity(item) } : null;
    await atomic(this.filename, data); return this.trust(item);
  }); }
  trust(item) { return require('./trust').status(item, this.publicKey); }
  uninstall(id, { removeFiles = true, expectedInstallationId } = {}) { return this.queue(async () => {
    if (typeof id !== 'string' || id.length > 100 || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,8}$/.test(id)) fail('PLUGIN_REQUEST_INVALID');
    const data = await this.read(), installed = data.plugins.find(item => item.manifest.id === id);
    if (!installed) return { uninstalled: true, alreadyRemoved: true };
    if (expectedInstallationId !== undefined && (installed.installationId || installed.sha256) !== expectedInstallationId) fail('PLUGIN_INSTALLATION_CHANGED');
    const target = path.join(this.directory, id);
    // Persist removal before cleanup; failures leave only unregistered version files.
    await atomic(this.filename, { ...data, plugins: data.plugins.filter(item => item.manifest.id !== id) });
    if (removeFiles) { await plainRoot(target); await fs.rm(target, { recursive: true, force: true }); }
    return { uninstalled: true };
  }); }
  async discard(ticket) {
    const pending = this.pending.get(ticket); if (!pending) return;
    this.pending.delete(ticket); await plainRoot(pending.stage);
    await fs.rm(pending.stage, { recursive: true, force: true });
  }
  async dispose() { await this.serial; for (const ticket of this.pending.keys()) await this.discard(ticket); }
}
module.exports = { PluginPackages, atomic, plainRoot, digest };
