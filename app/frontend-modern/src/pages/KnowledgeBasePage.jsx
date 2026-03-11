import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';

/**
 * Knowledge Base Page
 * Provides access to VA regulations, diagnostic codes, and case law
 */
export default function KnowledgeBasePage() {
  const [status, setStatus] = useState(null);
  const [cases, setCases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  // Load knowledge base status on mount
  useEffect(() => {
    loadStatus();
    loadCases();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/knowledge/status');
      const data = await response.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to load knowledge base status:', error);
    }
  };

  const loadCases = async () => {
    try {
      const response = await fetch('/api/knowledge/cases');
      const data = await response.json();
      if (data.success) {
        setCases(data.cases);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewCase = async (caseId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/cases/${encodeURIComponent(caseId)}`);
      const data = await response.json();
      if (data.success) {
        setSelectedCase(data.case);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupCasesByYear = (cases) => {
    const grouped = {};
    cases.forEach(c => {
      if (!grouped[c.year]) {
        grouped[c.year] = [];
      }
      grouped[c.year].push(c);
    });
    return grouped;
  };

  const casesByYear = groupCasesByYear(cases);
  const years = Object.keys(casesByYear).sort((a, b) => b - a);

  return (
    <div className='kb-layout'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Regulatory Research</div>
          <h1 className='page-title'>VA Knowledge Base</h1>
          <p className='page-copy'>Access VA regulations, diagnostic codes, and precedential case law.</p>
        </div>
        <div className='page-badge'>Integrated Part 3 / Part 4 / CAVC</div>
      </section>

      {status && (
        <Card>
          <h2>Knowledge Base Status</h2>
          <div className='kb-stat-grid' style={{ marginTop: '1rem' }}>
            <div className='kb-stat-card'>
              <div className='kb-stat-value'>
                {status.stats.part3Sections}
              </div>
              <div className='kb-stat-label'>Part 3 Sections</div>
              <div className='kb-stat-sub'>Compensation Regulations</div>
            </div>
            <div className='kb-stat-card'>
              <div className='kb-stat-value'>
                {status.stats.part4Sections}
              </div>
              <div className='kb-stat-label'>Part 4 Sections</div>
              <div className='kb-stat-sub'>Rating Schedule</div>
            </div>
            <div className='kb-stat-card'>
              <div className='kb-stat-value'>
                {status.stats.diagnosticCodes}
              </div>
              <div className='kb-stat-label'>Diagnostic Codes</div>
              <div className='kb-stat-sub'>Conditions and Ratings</div>
            </div>
            <div className='kb-stat-card'>
              <div className='kb-stat-value'>
                {status.stats.totalCases}
              </div>
              <div className='kb-stat-label'>CAVC Cases</div>
              <div className='kb-stat-sub'>Legal Precedents</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h2>Search Knowledge Base</h2>
        <form onSubmit={handleSearch} style={{ marginTop: '1rem' }}>
          <div className='kb-form'>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search regulations, conditions, or cases..."
              className='kb-input'
            />
            <button
              type="submit"
              disabled={loading || searchQuery.length < 2}
              className='kb-button'
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {searchResults && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3>Search Results ({searchResults.part3?.length + searchResults.part4?.length + searchResults.cases?.length || 0})</h3>
            
            {searchResults.cases && searchResults.cases.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4>CAVC Cases</h4>
                {searchResults.cases.map(c => (
                  <a
                    key={c.caseId}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      viewCase(c.caseId);
                    }}
                    className='kb-item kb-link'
                  >
                    <strong>{c.caseId}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--rf-text-soft)', marginTop: '0.25rem' }}>
                      Year: {c.year}
                    </div>
                  </a>
                ))}
              </div>
            )}

            {searchResults.part3 && searchResults.part3.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4>Part 3 Regulations</h4>
                {searchResults.part3.map((section, idx) => (
                  <div
                    key={idx}
                    className='kb-item'
                  >
                    <strong>{section.sectionNumber}</strong>: {section.title}
                  </div>
                ))}
              </div>
            )}

            {searchResults.part4 && searchResults.part4.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4>Part 4 Diagnostic Codes</h4>
                {searchResults.part4.map((code, idx) => (
                  <div
                    key={idx}
                    className='kb-item'
                  >
                    <strong>Code {code.code}</strong>: {code.section}
                    <div style={{ fontSize: '0.875rem', color: 'var(--rf-text-soft)', marginTop: '0.25rem' }}>
                      {code.description?.substring(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2>CAVC Precedential Cases</h2>
        <p style={{ color: 'var(--rf-text-soft)', marginBottom: '1rem' }}>
          Court of Appeals for Veterans Claims decisions providing legal guidance for VA benefit determinations
        </p>

        {years.map(year => (
          <div key={year} style={{ marginTop: '1.5rem' }}>
            <h3 style={{ color: 'var(--rf-accent)', marginBottom: '0.5rem' }}>{year}</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {casesByYear[year].map(c => (
                <a
                  key={c.caseId}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    viewCase(c.caseId);
                  }}
                  className='kb-item kb-link'
                >
                  <strong>{c.fileName.replace('.md', '')}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--rf-text-soft)', marginTop: '0.25rem' }}>
                    {c.filePath}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Case Viewer Modal */}
      {selectedCase && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(1, 6, 12, 0.74)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setSelectedCase(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--rf-panel-strong)',
              padding: '2rem',
              borderRadius: '14px',
              border: '1px solid rgba(157, 177, 194, 0.2)',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 35px rgba(0, 0, 0, 0.35)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>{selectedCase.caseId}</h2>
              <button
                onClick={() => setSelectedCase(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--rf-text-muted)'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--rf-text-muted)' }}>
              {selectedCase.content}
            </div>
            {selectedCase.url && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(157, 177, 194, 0.2)' }}>
                <strong>File Path:</strong> {selectedCase.resourcePath}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
