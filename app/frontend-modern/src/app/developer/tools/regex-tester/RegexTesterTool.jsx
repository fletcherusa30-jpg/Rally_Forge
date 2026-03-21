import { useMemo, useState } from 'react';

export function RegexTesterTool({ onLog }) {
  const [text, setText] = useState('PTSD noted in note 1\nTinnitus noted in note 2\nPTSD follow-up in note 3');
  const [pattern, setPattern] = useState('(PTSD|Tinnitus)');
  const [flags, setFlags] = useState('gim');

  const result = useMemo(() => {
    try {
      const regex = new RegExp(pattern, flags);
      const matches = [];
      let hit;

      if (!regex.global) {
        const one = regex.exec(text);
        if (one) {
          matches.push(one);
        }
      } else {
        while ((hit = regex.exec(text)) !== null) {
          matches.push(hit);
          if (hit[0] === '') {
            regex.lastIndex += 1;
          }
        }
      }

      return { error: null, matches };
    } catch (error) {
      return { error: error.message, matches: [] };
    }
  }, [pattern, flags, text]);

  const logSummary = () => {
    if (result.error) {
      onLog?.('Regex Tester', `Regex error: ${result.error}`);
      return;
    }
    onLog?.('Regex Tester', `Pattern matched ${result.matches.length} result(s).`);
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 120px', gap: '0.65rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
          Pattern
          <input value={pattern} onChange={(event) => setPattern(event.target.value)} style={{ borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.55rem' }} />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
          Flags
          <input value={flags} onChange={(event) => setFlags(event.target.value)} style={{ borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.55rem' }} />
        </label>

        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button type='button' className='kb-button' onClick={logSummary}>Log Result</button>
        </div>
      </div>

      <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
        Input Text
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} style={{ resize: 'vertical', borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.6rem' }} />
      </label>

      <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.6rem', padding: '0.75rem', background: 'rgba(9, 24, 37, 0.64)' }}>
        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', color: 'var(--rf-accent)' }}>Matches and Groups</div>
        {result.error ? (
          <div style={{ color: '#fecaca' }}>{result.error}</div>
        ) : result.matches.length === 0 ? (
          <div style={{ color: 'var(--rf-text-soft)' }}>No matches.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {result.matches.map((match, index) => (
              <div key={`${match.index}-${index}`} style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '0.55rem', padding: '0.5rem' }}>
                <div style={{ color: '#bae6fd', marginBottom: '0.2rem' }}>Match {index + 1}: "{match[0]}" at index {match.index}</div>
                {match.slice(1).map((group, groupIndex) => (
                  <div key={`${index}-${groupIndex}`} style={{ color: 'var(--rf-text-muted)', fontSize: '0.84rem' }}>
                    Group {groupIndex + 1}: {group ?? '(empty)'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
