import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.resolve(process.cwd(), 'docs/scanner-specs/dd214-scanner.schema.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function addError(errors, where, message) {
  errors.push(`${where}: ${message}`);
}

function resolveRefs(schemaRoot, node) {
  if (Array.isArray(node)) return node.map((item) => resolveRefs(schemaRoot, item));
  if (!node || typeof node !== 'object') return node;

  if (node.$ref) {
    const ref = node.$ref;
    if (!ref.startsWith('#/$defs/')) throw new Error(`Unsupported $ref: ${ref}`);
    const key = ref.replace('#/$defs/', '');
    return resolveRefs(schemaRoot, schemaRoot.$defs[key]);
  }

  const resolved = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$defs') continue;
    resolved[key] = resolveRefs(schemaRoot, value);
  }
  return resolved;
}

function validateNode(schema, value, where, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
    if (value !== schema.const) addError(errors, where, `expected constant ${JSON.stringify(schema.const)} but received ${JSON.stringify(value)}`);
    return;
  }

  if (Array.isArray(schema.enum)) {
    const match = schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value));
    if (!match) addError(errors, where, `expected one of ${JSON.stringify(schema.enum)} but received ${JSON.stringify(value)}`);
    return;
  }

  if (Array.isArray(schema.anyOf)) {
    const branchErrors = [];
    const matched = schema.anyOf.some((branch) => {
      const localErrors = [];
      validateNode(branch, value, where, localErrors);
      if (localErrors.length === 0) return true;
      branchErrors.push(localErrors);
      return false;
    });
    if (!matched) {
      addError(errors, where, 'did not match any allowed schema branch');
      const flattened = branchErrors.flat();
      if (flattened[0]) addError(errors, where, `first branch failure: ${flattened[0]}`);
    }
    return;
  }

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = describeType(value);
    const matchesType = expectedTypes.some((expectedType) => {
      if (expectedType === 'integer') return typeof value === 'number' && Number.isInteger(value);
      return expectedType === actualType;
    });
    if (!matchesType) {
      addError(errors, where, `expected type ${expectedTypes.join('|')} but received ${actualType}`);
      return;
    }
  }

  if (value === null) return;

  if (schema.pattern && typeof value === 'string') {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) addError(errors, where, `value does not match pattern ${schema.pattern}`);
  }

  if (typeof schema.minimum === 'number' && typeof value === 'number' && value < schema.minimum) {
    addError(errors, where, `expected minimum ${schema.minimum} but received ${value}`);
  }

  if (typeof schema.maximum === 'number' && typeof value === 'number' && value > schema.maximum) {
    addError(errors, where, `expected maximum ${schema.maximum} but received ${value}`);
  }

  if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
    addError(errors, where, `expected minimum length ${schema.minLength} but received length ${value.length}`);
  }

  if (describeType(value) === 'object') {
    const props = schema.properties || {};
    const required = schema.required || [];

    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) addError(errors, `${where}.${key}`, 'missing required property');
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) addError(errors, `${where}.${key}`, 'additional property is not allowed');
      }
    }

    for (const [key, childSchema] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) validateNode(childSchema, value[key], `${where}.${key}`, errors);
    }
    return;
  }

  if (describeType(value) === 'array' && schema.items) {
    value.forEach((item, index) => validateNode(schema.items, item, `${where}[${index}]`, errors));
  }
}

let cachedSchema = null;

export function loadPortableDd214Schema() {
  if (!cachedSchema) {
    const schemaRoot = readJson(schemaPath);
    cachedSchema = resolveRefs(schemaRoot, schemaRoot);
  }
  return cachedSchema;
}

export function validatePortableDd214Output(payload) {
  const schema = loadPortableDd214Schema();
  const errors = [];
  validateNode(schema, payload, '$', errors);
  return {
    valid: errors.length === 0,
    errors,
  };
}
