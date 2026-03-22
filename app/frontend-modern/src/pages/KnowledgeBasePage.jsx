import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { placeholders } from '../system/placeholders/index.js';
import {
  MODEL_PRICING,
  getProfessionalSearchConfig,
  runProfessionalSearchDesignMode,
} from '../services/professionalSearch/claudeDesignMode';

const VALID_TABS = ['overview', 'search', 'court-cases'];

/**
 * Knowledge Base Page
 * Provides access to VA regulations, diagnostic codes, and case law
 */
export default function KnowledgeBasePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'overview';

  const [status, setStatus] = useState(null);
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseLoadError, setCaseLoadError] = useState(null);
  const [proModel, setProModel] = useState('sonnet');
  const [proContext, setProContext] = useState('');
  const [proLoading, setProLoading] = useState(false);
  const [proResult, setProResult] = useState(null);
  const [proError, setProError] = useState(null);
  const [proConfig] = useState(() => getProfessionalSearchConfig({ mode: 'design' }));

  // Court Cases filter state
  const [caseFilter, setCaseFilter] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
    setSelectedCase(null);
  };

  // Load knowledge base status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  // Load cases only when the Court Cases tab is first opened.
  useEffect(() => {
    if (activeTab === 'court-cases' && cases.length === 0 && !casesLoading) {
      loadCases();
    }
  }, [activeTab, cases.length, casesLoading]);

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
    setCasesLoading(true);
    try {
      const response = await fetch('/api/knowledge/cases');
      const data = await response.json();
      if (data.success) {
        setCases(data.cases);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setCasesLoading(false);
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

  const handleProfessionalSearch = async () => {
    setProError(null);
    setProResult(null);
    if (!searchQuery.trim()) {
      setProError('Enter a query before running Professional Search.');
      return;
    }

    setProLoading(true);
    try {
      const result = await runProfessionalSearchDesignMode({
        query: searchQuery,
        model: proModel,
        context: proContext,
        config: proConfig,
      });
      setProResult(result);
    } catch (error) {
      setProError(error.message || 'Professional Search simulation failed.');
    } finally {
      setProLoading(false);
    }
  };

  const viewCase = async (caseId) => {
    setCaseLoadError(null);
    setLoading(true);
    try {
      const response = await fetch(`/api/knowledge/cases/${encodeURIComponent(caseId)}`);
      const data = await response.json();
      if (data.success) {
        setSelectedCase(data.case);
      }
    } catch (error) {
      console.error('Failed to load case:', error);
      setCaseLoadError('Failed to load case details.');
    } finally {
      setLoading(false);
    }
  };

  const openCaseFromSearch = (caseId) => {
    setActiveTab('court-cases');
    viewCase(caseId);
  };

  const allYears = useMemo(
    () => [...new Set(cases.map((c) => String(c.year)))].sort((a, b) => b - a),
    [cases],
  );

  const filteredCases = useMemo(() => {
    let result = cases;
    if (selectedYear) result = result.filter((c) => String(c.year) === selectedYear);
    if (caseFilter.trim()) {
      const q = caseFilter.toLowerCase();
      result = result.filter(
        (c) =>
          c.fileName.toLowerCase().includes(q) ||
          c.caseId.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) =>
      sortOrder === 'asc' ? a.year - b.year : b.year - a.year,
    );
  }, [cases, selectedYear, caseFilter, sortOrder]);

  const groupCasesByYear = (list) => {
    const grouped = {};
    list.forEach((c) => {
      if (!grouped[c.year]) grouped[c.year] = [];
      grouped[c.year].push(c);
    });
    return grouped;
  };

  const filteredByYear = groupCasesByYear(filteredCases);
  const filteredYears = Object.keys(filteredByYear).sort((a, b) =>
    sortOrder === 'asc' ? a - b : b - a,
  );

  return (
    <div className='kb-layout'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Regulatory Research</div>
          <h1 className='page-title'>VA Knowledge Base</h1>
          <p className='page-copy'>Access VA regulations, diagnostic codes, and precedential case law.</p>
        </div>
        <div className='page-badge'>Part 3 / Part 4 / CAVC</div>
      </section>

      {status && (
        <div className='kb-stat-grid'>
          <div className='kb-stat-card'>
            <div className='kb-stat-value'>{status.stats.part3Sections}</div>
            <div className='kb-stat-label'>Part 3 Sections</div>
            <div className='kb-stat-sub'>Compensation Regulations</div>
          </div>
          <div className='kb-stat-card'>
            <div className='kb-stat-value'>{status.stats.part4Sections}</div>
            <div className='kb-stat-label'>Part 4 Sections</div>
            <div className='kb-stat-sub'>Rating Schedule</div>
          </div>
          <div className='kb-stat-card'>
            <div className='kb-stat-value'>{status.stats.diagnosticCodes}</div>
            <div className='kb-stat-label'>Diagnostic Codes</div>
            <div className='kb-stat-sub'>Conditions and Ratings</div>
          </div>
          <div className='kb-stat-card'>
            <div className='kb-stat-value'>{status.stats.totalCases}</div>
            <div className='kb-stat-label'>CAVC Cases</div>
            <div className='kb-stat-sub'>Legal Precedents</div>
          </div>
        </div>
      )}

      <Card>
        <div className='kb-tab-strip' role='tablist' aria-label='Knowledge sections'>
          {VALID_TABS.map((tab) => (
            <button
              key={tab}
              type='button'
              role='tab'
              aria-selected={activeTab === tab}
              className={`kb-tab-btn${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? 'Overview' : tab === 'search' ? 'Search' : 'Court Cases'}
              {tab === 'court-cases' && cases.length > 0 && (
                <span className='kb-tab-count'>{cases.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className='kb-tab-content'>
            <p className='kb-note'>
              Navigate regulations, rating guidance, and CAVC decisions from one place.
            </p>
            <div className='kb-overview-grid'>
              <button type='button' className='kb-overview-tile' onClick={() => setActiveTab('search')}>
                <div className='kb-overview-tile-icon'>§</div>
                <strong>38 CFR Part 3</strong>
                <div className='kb-subline'>Service connection and compensation regulations</div>
              </button>
              <button type='button' className='kb-overview-tile' onClick={() => setActiveTab('search')}>
                <div className='kb-overview-tile-icon'>⊞</div>
                <strong>38 CFR Part 4</strong>
                <div className='kb-subline'>Diagnostic codes and rating schedule criteria</div>
              </button>
              <button type='button' className='kb-overview-tile' onClick={() => setActiveTab('court-cases')}>
                <div className='kb-overview-tile-icon'>⚖</div>
                <strong>Court Cases</strong>
                <div className='kb-subline'>Precedential CAVC decisions grouped by year</div>
              </button>
            </div>
          </div>
        )}

        {/* ── SEARCH ───────────────────────────────────────────── */}
        {activeTab === 'search' && (
          <div className='kb-tab-content'>
            <div className='kb-pro-search-card'>
              <div className='kb-pro-search-head'>
                <div>
                  <h4>Professional Search</h4>
                  <div className='kb-subline'>{placeholders.helperText.knowledge.designModeNotice}</div>
                </div>
                <span className='kb-pro-mode-pill'>{proConfig.mode.toUpperCase()}</span>
              </div>

              <div className='kb-pro-grid'>
                <label className='kb-pro-field'>
                  <span>Claude Tier</span>
                  <select value={proModel} onChange={(e) => setProModel(e.target.value)} className='kb-select'>
                    {Object.entries(MODEL_PRICING).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </label>

                <label className='kb-pro-field'>
                  <span>Research Context (optional)</span>
                  <input
                    type='text'
                    value={proContext}
                    onChange={(e) => setProContext(e.target.value)}
                    placeholder={placeholders.knowledge.researchContext}
                    className='kb-input'
                  />
                </label>
              </div>

              <div className='kb-pro-actions'>
                <button type='button' className='kb-button' onClick={handleProfessionalSearch} disabled={proLoading}>
                  {proLoading ? 'Running Professional Search…' : 'Professional Search'}
                </button>
                <div className='kb-subline'>{placeholders.helperText.knowledge.simulatedSalePricePrefix} ${proConfig.salePricePerSearch.toFixed(2)}</div>
              </div>

              {proError && <div className='kb-error'>{proError}</div>}

              {proResult && (
                <div className='kb-pro-result'>
                  <div className='kb-pro-metrics'>
                    <div className='kb-pro-metric'><strong>Input tokens:</strong> {proResult.usage.inputTokens}</div>
                    <div className='kb-pro-metric'><strong>Output tokens:</strong> {proResult.usage.outputTokens}</div>
                    <div className='kb-pro-metric'><strong>Total tokens:</strong> {proResult.usage.totalTokens}</div>
                    <div className='kb-pro-metric'><strong>Estimated cost:</strong> ${proResult.billing.estimatedCost.toFixed(6)}</div>
                    <div className='kb-pro-metric'><strong>Estimated profit:</strong> ${proResult.billing.estimatedProfit.toFixed(6)}</div>
                    <div className='kb-pro-metric'><strong>Margin:</strong> {proResult.billing.marginPercent.toFixed(2)}%</div>
                  </div>

                  <pre className='kb-pro-response'>{proResult.response.text}</pre>
                </div>
              )}
            </div>

            <form onSubmit={handleSearch} className='kb-top-space'>
              <div className='kb-form'>
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={placeholders.knowledge.searchQuery}
                  className='kb-input'
                  aria-label='Knowledge base search'
                />
                <button type='submit' disabled={loading || searchQuery.length < 2} className='kb-button'>
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </div>
            </form>

            {searchResults && (
              <div className='kb-results'>
                <p className='kb-note'>
                  {searchResults.part3?.length + searchResults.part4?.length + searchResults.cases?.length || 0} result(s)
                </p>

                {searchResults.cases?.length > 0 && (
                  <div className='kb-section'>
                    <h4>Court Cases</h4>
                    {searchResults.cases.map((c) => (
                      <a
                        key={c.caseId}
                        href='#'
                        onClick={(e) => { e.preventDefault(); openCaseFromSearch(c.caseId); }}
                        className='kb-item kb-link'
                      >
                        <strong>{c.caseId}</strong>
                        <div className='kb-subline'>Year: {c.year}</div>
                      </a>
                    ))}
                  </div>
                )}

                {searchResults.part3?.length > 0 && (
                  <div className='kb-section'>
                    <h4>Part 3 Regulations</h4>
                    {searchResults.part3.map((section, idx) => (
                      <div key={idx} className='kb-item'>
                        <strong>{section.sectionNumber}</strong>: {section.title}
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.part4?.length > 0 && (
                  <div className='kb-section'>
                    <h4>Part 4 Diagnostic Codes</h4>
                    {searchResults.part4.map((code, idx) => (
                      <div key={idx} className='kb-item'>
                        <strong>Code {code.code}</strong>: {code.section}
                        <div className='kb-subline'>{code.description?.substring(0, 200)}…</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── COURT CASES ──────────────────────────────────────── */}
        {activeTab === 'court-cases' && (
          <div className='kb-tab-content'>
            {/* Filter bar */}
            <div className='kb-filter-bar'>
              <input
                type='text'
                value={caseFilter}
                onChange={(e) => { setCaseFilter(e.target.value); setSelectedCase(null); }}
                placeholder={placeholders.knowledge.caseFilter}
                className='kb-input kb-filter-input'
                aria-label='Filter cases'
              />
              <select
                value={selectedYear}
                onChange={(e) => { setSelectedYear(e.target.value); setSelectedCase(null); }}
                className='kb-select'
                aria-label='Filter by year'
              >
                <option value=''>All Years</option>
                {allYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className='kb-select'
                aria-label='Sort order'
              >
                <option value='desc'>Newest first</option>
                <option value='asc'>Oldest first</option>
              </select>
              {(caseFilter || selectedYear) && (
                <button
                  type='button'
                  className='kb-clear-btn'
                  onClick={() => { setCaseFilter(''); setSelectedYear(''); setSelectedCase(null); }}
                >
                  Clear
                </button>
              )}
            </div>

            {casesLoading && <p className='kb-note'>Loading cases…</p>}

            {!casesLoading && filteredCases.length === 0 && (
              <p className='kb-note'>No cases match your filters.</p>
            )}

            {/* Split pane */}
            {!casesLoading && filteredCases.length > 0 && (
              <div className='kb-split-pane'>
                {/* Left: case list */}
                <div className='kb-case-list-pane'>
                  {filteredYears.map((year) => (
                    <div key={year} className='kb-year-group'>
                      <div className='kb-year-title'>{year}</div>
                      {filteredByYear[year].map((c) => (
                        <button
                          key={c.caseId}
                          type='button'
                          onClick={() => viewCase(c.caseId)}
                          className={`kb-case-row${selectedCase?.caseId === c.caseId ? ' active' : ''}`}
                        >
                          <span className='kb-case-row-name'>{c.fileName.replace('.md', '')}</span>
                          <span className='kb-case-row-year'>{c.year}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Right: detail pane */}
                <div className='kb-case-detail-pane'>
                  {loading && <p className='kb-note'>Loading…</p>}
                  {caseLoadError && <p className='kb-note kb-error'>{caseLoadError}</p>}
                  {!loading && !selectedCase && !caseLoadError && (
                    <div className='kb-detail-empty'>
                      <div className='kb-detail-empty-icon'>⚖</div>
                      <p>Select a case to read the decision.</p>
                    </div>
                  )}
                  {!loading && selectedCase && (
                    <>
                      <div className='kb-detail-head'>
                        <h3>{selectedCase.caseId}</h3>
                        <button type='button' className='kb-clear-btn' onClick={() => setSelectedCase(null)}>
                          Close
                        </button>
                      </div>
                      <div className='kb-case-content'>{selectedCase.content}</div>
                      {selectedCase.resourcePath && (
                        <div className='kb-detail-foot'>
                          <span className='kb-subline'>{selectedCase.resourcePath}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}