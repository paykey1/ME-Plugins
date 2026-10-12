'use strict';
const fail = code => { throw Object.assign(Error(code), { code }); };
const LIMITS = Object.freeze({ archiveBytes: 64 * 1024 ** 2, unpackedBytes: 512 * 1024 ** 2, files: 10000 });
const PERMISSIONS = ['media.read', 'tags.propose', 'network.request', 'storage.private', 'tasks.progress', 'runtime.tools'];
function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || /[\\:\p{Cc}\p{Cf}]/u.test(value)) fail('PLUGIN_UNSAFE_PATH');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /[<>"|?*]/.test(part) || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(part))) fail('PLUGIN_UNSAFE_PATH');
  return value;
}
function localized(value) {
  return value && ['zh-CN', 'en-US'].every(locale => typeof value[locale] === 'string' && value[locale].trim().length > 0 && value[locale].length <= 500);
}
function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || value.apiVersion !== 1) fail('PLUGIN_API_UNSUPPORTED');
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,8}$/.test(value.id) || value.id.length > 100 || !/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(value.version)) fail('PLUGIN_MANIFEST_INVALID');
  if (!localized(value.name) || !localized(value.description) || typeof value.author !== 'string' || !value.author.trim() || value.author.length > 200 || typeof value.license !== 'string' || !value.license || value.license.length > 100) fail('PLUGIN_MANIFEST_INVALID');
  // Native extensions are explicitly trusted; this is not an OS sandbox.
  if (value.mode !== 'trusted-native' || !Array.isArray(value.permissions) || value.permissions.length > PERMISSIONS.length || new Set(value.permissions).size !== value.permissions.length || value.permissions.some(p => !PERMISSIONS.includes(p))) fail('PLUGIN_PERMISSION_INVALID');
  safeRelativePath(value.entry);
  if (!/\.(c?js)$/.test(value.entry)) fail('PLUGIN_ENTRY_INVALID');
  if (!Array.isArray(value.commands) || value.commands.length > 30) fail('PLUGIN_MANIFEST_INVALID');
  const ids = new Set();
  for (const command of value.commands) {
    if (!command || !/^[a-z][a-z0-9-]{0,49}$/.test(command.id) || ids.has(command.id) || !localized(command.title) || !Array.isArray(command.contexts) || command.contexts.some(c => !['images', 'selection', 'center'].includes(c))) fail('PLUGIN_COMMAND_INVALID');
    ids.add(command.id);
    if (command.inputs !== undefined) {
      if (!Array.isArray(command.inputs) || command.inputs.length > 10) fail('PLUGIN_COMMAND_INVALID');
      const keys = new Set();
      for (const field of command.inputs) {
        if (!field || !/^[a-z][a-zA-Z0-9]{0,39}$/.test(field.key) || keys.has(field.key) || !localized(field.label)) fail('PLUGIN_COMMAND_INVALID');
        keys.add(field.key);
        if (field.type === 'number') {
          if (![field.min, field.max, field.default, field.step].every(Number.isFinite) || field.min > field.max || field.default < field.min || field.default > field.max || field.step <= 0) fail('PLUGIN_COMMAND_INVALID');
        } else if (field.type === 'select') {
          if (!Array.isArray(field.options) || !field.options.length || field.options.length > 20 || field.options.some(option => typeof option.value !== 'string' || option.value.length > 100 || !localized(option.label)) || !field.options.some(option => option.value === field.default)) fail('PLUGIN_COMMAND_INVALID');
        } else fail('PLUGIN_COMMAND_INVALID');
      }
    }
  }
  return structuredClone(value);
}
function parseArchiveListing(text, limits = LIMITS) {
  const sections = text.replace(/\r/g, '').split('\n----------\n');
  if (sections.length !== 2 || !/^Type = (zip|7z)$/m.test(sections[0])) fail('PLUGIN_ARCHIVE_INVALID');
  const seen = new Set(), entries = []; let total = 0;
  for (const block of sections[1].trim().split(/\n\n+/)) {
    const fields = {};
    for (const line of block.split('\n')) {
      const at = line.indexOf(' = '); if (at < 1) fail('PLUGIN_ARCHIVE_INVALID');
      const name = line.slice(0, at); if (Object.hasOwn(fields, name)) fail('PLUGIN_ARCHIVE_INVALID');
      fields[name] = line.slice(at + 3);
    }
    const filename = safeRelativePath(fields.Path?.replaceAll('\\', '/'));
    const identity = filename.normalize('NFC').toLowerCase();
    if (seen.has(identity) || fields.Encrypted === '+' || fields['Symbolic Link'] !== undefined || fields['Hard Link'] !== undefined || /[lL]/.test(fields.Attributes || '')) fail('PLUGIN_ARCHIVE_UNSAFE');
    seen.add(identity);
    const size = Number(fields.Size || 0);
    if (!Number.isSafeInteger(size) || size < 0 || (total += size) > limits.unpackedBytes || entries.length >= limits.files) fail('PLUGIN_ARCHIVE_TOO_LARGE');
    entries.push({ path: filename, size, directory: fields.Folder === '+' || /^D/.test(fields.Attributes || '') });
  }
  return entries;
}
module.exports = { validateManifest, safeRelativePath, parseArchiveListing, LIMITS, fail };
