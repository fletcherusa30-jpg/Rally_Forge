import { useMemo, useState } from 'react';

function buildLineDiff(leftText, rightText) {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');
  const maxLines = Math.max(leftLines.length, rightLines.length);
  const rows = [];

  for (let index = 0; index < maxLines; index += 1) {
    const left = leftLines[index] ?? '';
    const right = rightLines[index] ?? '';
    rows.push({
      index: index + 1,
      left,
      right,
      changed: left !== right
    });
  }

  return rows;
}

export function DiffViewerTool({ onLog }) {
  const [leftInput, setLeftInput] = useState('line one\nline two\nline three');
  const [rightInput, setRightInput] = useState('line one\nline 2\nline three\nline four');

  const rows = useMemo(() => buildLineDiff(leftInput, rightInput), [leftInput, rightInput]);
  const changedCount = rows.filter((row) => row.changed).length;

  const emitStats = () => {
    onLog?.('Diff Viewer', `Compared ${rows.length} line(s); ${changedCount} changed.`);
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
          Left Input
          <textarea value={leftInput} onChange={(event) => setLeftInput(event.target.value)} rows={8} style={{ resize: 'vertical', borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.6rem' }} />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', color: 'var(--rf-text-muted)' }}>
          Right Input
          <textarea value={rightInput} onChange={(event) => setRightInput(event.target.value)} rows={8} style={{ resize: 'vertical', borderRadius: '0.55rem', border: '1px solid var(--rf-border)', background: 'rgba(9, 24, 37, 0.84)', color: 'var(--rf-text)', padding: '0.6rem' }} />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--rf-text-soft)' }}>Changed lines: {changedCount}</div>
        <button type='button' className='kb-button' onClick={emitStats}>Log Diff Summary</button>
      </div>

      <div style={{ border: '1px solid var(--rf-border)', borderRadius: '0.65rem', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid var(--rf-border)' }}>
          <div style={{ padding: '0.45rem', color: 'var(--rf-text-soft)', fontSize: '0.76rem' }}>Ln</div>
          <div style={{ padding: '0.45rem', color: 'var(--rf-text-soft)', fontSize: '0.76rem' }}>Left</div>
          <div style={{ padding: '0.45rem', color: 'var(--rf-text-soft)', fontSize: '0.76rem' }}>Right</div>
        </div>

        <div style={{ maxHeight: '340px', overflow: 'auto' }}>
          {rows.map((row) => (
            <div key={row.index} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr', borderBottom: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <div style={{ padding: '0.4rem', color: 'var(--rf-text-soft)', fontSize: '0.74rem' }}>{row.index}</div>
              <pre style={{ margin: 0, padding: '0.4rem', background: row.changed ? 'rgba(127, 29, 29, 0.24)' : 'transparent', color: row.changed ? '#fecaca' : 'var(--rf-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderRight: '1px solid rgba(148, 163, 184, 0.08)' }}>{row.left || ' '}</pre>
              <pre style={{ margin: 0, padding: '0.4rem', background: row.changed ? 'rgba(6, 78, 59, 0.24)' : 'transparent', color: row.changed ? '#bbf7d0' : 'var(--rf-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{row.right || ' '}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
