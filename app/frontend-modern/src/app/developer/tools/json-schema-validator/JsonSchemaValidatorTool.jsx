import { useMemo, useState } from 'react';
import Ajv from 'ajv';

const starterSchema = `{
  "type": "object",
  "required": ["claimId", "status"],
  "properties": {
    "claimId": { "type": "string" },
    "status": { "type": "string" }
  }
}`;

const starterJson = `{
  "claimId": "RF-001",
  "status": "draft"
}`;

export function JsonSchemaValidatorTool({ onLog }) {
  const [schemaText, setSchemaText] = useState(starterSchema);
  const [jsonText, setJsonText] = useState(starterJson);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('Ready to validate.');

  const ajv = useMemo(() => new Ajv({ allErrors: true, strict: false }), []);

  const validate = () => {
    try {
      const parsedSchema = JSON.parse(schemaText);
      const parsedJson = JSON.parse(jsonText);
      const validator = ajv.compile(parsedSchema);
      const valid = validator(parsedJson);

      if (valid) {
        setResults([]);
        setStatus('Validation passed.');
        onLog?.('JSON Schema Validator', 'Validation passed with 0 errors.');
        return;
      }

      const errors = (validator.errors || []).map((error, index) => ({
        id: `${error.instancePath}-${index}`,
        path: error.instancePath || '/',
        message: error.message || 'Validation error',
        keyword: error.keyword
      }));

      setResults(errors);
      setStatus(`Validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}.`);
      onLog?.('JSON Schema Validator', `Validation failed with ${errors.length} error(s).`);
    } catch (error) {
      setResults([{ id: 'parse-error', path: '/', message: error.message, keyword: 'parse' }]);
      setStatus('Schema or JSON parsing error.');
      onLog?.('JSON Schema Validator', `Parsing error: ${error.message}`);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
          JSON Input
          <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} rows={13} style={{ resize: 'vertical', borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.6rem' }} />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
          JSON Schema
          <textarea value={schemaText} onChange={(event) => setSchemaText(event.target.value)} rows={13} style={{ resize: 'vertical', borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.6rem' }} />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button type='button' onClick={validate} className='kb-button'>Validate</button>
        <span style={{ color: 'var(--rf-text-soft)', fontSize: '0.82rem' }}>{status}</span>
      </div>

      <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.6rem', padding: '0.75rem', background: 'rgba(9, 24, 37, 0.64)' }}>
        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', color: 'var(--rf-accent)' }}>Validation Errors</div>
        {results.length === 0 ? (
          <div style={{ color: '#86efac', fontSize: '0.85rem' }}>No validation errors.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1rem', display: 'grid', gap: '0.35rem', color: '#fecaca' }}>
            {results.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.path}</strong> [{entry.keyword}] {entry.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
