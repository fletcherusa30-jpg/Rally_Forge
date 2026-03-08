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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>VA Knowledge Base</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Access VA regulations, diagnostic codes, and precedential case law
      </p>

      {status && (
        <Card style={{ marginBottom: '2rem', padding: '1.5rem' }}>
          <h2>Knowledge Base Status</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
                {status.stats.part3Sections}
              </div>
              <div style={{ color: '#666' }}>Part 3 Sections</div>
              <div style={{ fontSize: '0.875rem', color: '#999' }}>Compensation Regulations</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
                {status.stats.part4Sections}
              </div>
              <div style={{ color: '#666' }}>Part 4 Sections</div>
              <div style={{ fontSize: '0.875rem', color: '#999' }}>Rating Schedule</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
                {status.stats.diagnosticCodes}
              </div>
              <div style={{ color: '#666' }}>Diagnostic Codes</div>
              <div style={{ fontSize: '0.875rem', color: '#999' }}>Conditions & Ratings</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2563eb' }}>
                {status.stats.totalCases}
              </div>
              <div style={{ color: '#666' }}>CAVC Cases</div>
              <div style={{ fontSize: '0.875rem', color: '#999' }}>Legal Precedents</div>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <h2>Search Knowledge Base</h2>
        <form onSubmit={handleSearch} style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search regulations, conditions, or cases..."
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            />
            <button
              type="submit"
              disabled={loading || searchQuery.length < 2}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading ? '#ccc' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: '500'
              }}
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
                    style={{
                      padding: '0.75rem',
                      margin: '0.5rem 0',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      background: 'white'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  >
                    <strong>{c.caseId}</strong>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
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
                    style={{
                      padding: '0.75rem',
                      margin: '0.5rem 0',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      background: '#f9fafb'
                    }}
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
                    style={{
                      padding: '0.75rem',
                      margin: '0.5rem 0',
                      border: '1px solid #e5e7eb',
                      borderRadius: '4px',
                      background: '#f9fafb'
                    }}
                  >
                    <strong>Code {code.code}</strong>: {code.section}
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      {code.description?.substring(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card style={{ padding: '1.5rem' }}>
        <h2>CAVC Precedential Cases</h2>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          Court of Appeals for Veterans Claims decisions providing legal guidance for VA benefit determinations
        </p>

        {years.map(year => (
          <div key={year} style={{ marginTop: '1.5rem' }}>
            <h3 style={{ color: '#2563eb', marginBottom: '0.5rem' }}>{year}</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {casesByYear[year].map(c => (
                <a
                  key={c.caseId}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    viewCase(c.caseId);
                  }}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <strong>{c.fileName.replace('.md', '')}</strong>
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
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
            background: 'rgba(0, 0, 0, 0.5)',
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
              background: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
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
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: '1.6' }}>
              {selectedCase.content}
            </div>
            {selectedCase.url && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                <strong>File Path:</strong> {selectedCase.resourcePath}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
