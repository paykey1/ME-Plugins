'use strict';
const fail = () => { throw Object.assign(Error('PLUGIN_SCHEMA_INVALID'), { code: 'PLUGIN_SCHEMA_INVALID' }); };
const types = new Set(['object', 'array', 'string', 'boolean', 'number', 'integer', 'null']);
const keys = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'maxItems', 'maxLength', 'enum', 'minimum', 'maximum']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function validateSchema(schema, depth = 0, budget = { nodes: 0 }) {
  if (depth > 12 || ++budget.nodes > 500 || !plain(schema) || !types.has(schema.type) || Object.keys(schema).some(key => !keys.has(key))) fail();
  const allowed = { object: ['properties', 'required', 'additionalProperties'], array: ['items', 'maxItems'], string: ['maxLength'], number: ['minimum', 'maximum'], integer: ['minimum', 'maximum'], boolean: [], null: [] }[schema.type];
  if (Object.keys(schema).some(key => !['type', 'enum', ...allowed].includes(key))) fail();
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length || schema.enum.length > 100 || schema.enum.some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value)))) fail();
  for (const key of ['maxLength', 'maxItems']) if (schema[key] !== undefined && (!Number.isSafeInteger(schema[key]) || schema[key] < 0 || schema[key] > 100000)) fail();
  for (const key of ['minimum', 'maximum']) if (schema[key] !== undefined && !Number.isFinite(schema[key])) fail();
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) fail();
  if (schema.type === 'object') {
    const props = schema.properties || {};
    if (!plain(props) || Object.keys(props).length > 100 || Object.keys(props).some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) fail();
    for (const child of Object.values(props)) validateSchema(child, depth + 1, budget);
    if (schema.required !== undefined && (!Array.isArray(schema.required) || new Set(schema.required).size !== schema.required.length || schema.required.some(key => typeof key !== 'string' || !Object.hasOwn(props, key)))) fail();
    if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') fail();
  }
  if (schema.type === 'array') validateSchema(schema.items, depth + 1, budget);
  return schema;
}
function matches(schema, value, depth = 0) {
  if (depth > 20) return false;
  if (schema.enum && !schema.enum.some(item => Object.is(item, value))) return false;
  switch (schema.type) {
    case 'null': return value === null;
    case 'boolean': return typeof value === 'boolean';
    case 'string': return typeof value === 'string' && value.length <= (schema.maxLength ?? 100000);
    case 'number': case 'integer': return typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isSafeInteger(value)) && (schema.minimum === undefined || value >= schema.minimum) && (schema.maximum === undefined || value <= schema.maximum);
    case 'array': return Array.isArray(value) && value.length <= (schema.maxItems ?? 10000) && value.every(item => matches(schema.items, item, depth + 1));
    case 'object': {
      if (!plain(value) || Object.keys(value).length > 1000 || (schema.required || []).some(key => !Object.hasOwn(value, key))) return false;
      const props = schema.properties || {};
      return Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && (Object.hasOwn(props, key) ? matches(props[key], item, depth + 1) : schema.additionalProperties !== false));
    }
    default: return false;
  }
}
module.exports = { validateSchema, matches };
