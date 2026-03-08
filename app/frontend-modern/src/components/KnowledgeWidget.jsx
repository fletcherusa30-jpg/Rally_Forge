import React, { useState, useEffect } from 'react';

/**
 * Knowledge Base Widget
 * Shows relevant regulations, diagnostic codes, and cases for a condition
 */
export default function KnowledgeWidget({ condition }) {
  const [knowledge, setKnowledge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!condition || !expanded) {
      return;
    }

    loadKnowledge();
  }, [condition, expanded]);

  const loadKnowledge = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/condition/${encodeURIComponent(condition)}`);
      const data = await response.json();
      if (data.success) {
        setKnowledge(data);
      }
    } catch (error) {
      console.error('Failed to load knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!condition) {
    return null;
  }

  return (
    <div style={{ 
      marginTop: '0.5rem',
      padding: '0.5rem',
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: '0.375rem'
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          color: '#60a5fa',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}
      >
        {expanded ? '▼' : '▶'} Related Knowledge Base Resources
      </button>

      {expanded && (
        <div style={{ marginTop: '0.5rem' }}>
          {loading && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Loading knowledge base...
            </div>
          )}

          {knowledge && !loading && (
            <div style={{ fontSize: '0.75rem' }}>
              {knowledge.cases && knowledge.cases.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ color: '#60a5fa', fontWeight: '600', marginBottom: '0.25rem' }}>
                    📚 Relevant Cases
                  </div>
                  {knowledge.cases.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.35rem',
                        marginBottom: '0.25rem',
                        background: '#1e293b',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                      onClick={() => window.open(`/knowledge-base?case=${encodeURIComponent(c.caseId)}`, '_blank')}
                    >
                      {c.caseId} ({c.year})
                    </div>
                  ))}
                </div>
              )}

              {knowledge.diagnosticCodes && knowledge.diagnosticCodes.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ color: '#60a5fa', fontWeight: '600', marginBottom: '0.25rem' }}>
                    🔍 Diagnostic Codes
                  </div>
                  {knowledge.diagnosticCodes.slice(0, 3).map((dc, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.35rem',
                        marginBottom: '0.25rem',
                        background: '#1e293b',
                        borderRadius: '0.25rem'
                      }}
                    >
                      Code {dc.code} - {dc.section}
                    </div>
                  ))}
                </div>
              )}

              {knowledge.regulations && knowledge.regulations.length > 0 && (
                <div>
                  <div style={{ color: '#60a5fa', fontWeight: '600', marginBottom: '0.25rem' }}>
                    📋 Regulations
                  </div>
                  {knowledge.regulations.slice(0, 3).map((reg, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.35rem',
                        marginBottom: '0.25rem',
                        background: '#1e293b',
                        borderRadius: '0.25rem'
                      }}
                    >
                      {reg.sectionNumber}: {reg.title}
                    </div>
                  ))}
                </div>
              )}

              {(!knowledge.cases || knowledge.cases.length === 0) &&
               (!knowledge.diagnosticCodes || knowledge.diagnosticCodes.length === 0) &&
               (!knowledge.regulations || knowledge.regulations.length === 0) && (
                <div style={{ color: '#94a3b8' }}>
                  No knowledge base entries found for this condition.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
