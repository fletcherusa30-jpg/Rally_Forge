import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';

export function ServiceTreatmentRecordsPage() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [expandedCondition, setExpandedCondition] = useState(null);
  const [plainLanguage, setPlainLanguage] = useState(true);
  
  // Filtering state
  const [filterActionableOnly, setFilterActionableOnly] = useState(false);
  const [filterCategories, setFilterCategories] = useState([]);
  const [filterEvidenceStrength, setFilterEvidenceStrength] = useState([]);
  const [filterConnectionType, setFilterConnectionType] = useState([]);
  const [showExclusionPanel, setShowExclusionPanel] = useState(false);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setStatusMessage('');
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  const saveResultsToFile = () => {
    if (!results) return;
    
    const dataToSave = {
      savedAt: new Date().toISOString(),
      fileName: results.metadata?.fileName || file?.name,
      success: results.success,
      extracted: results.Extracted,
      analysis: results.Analysis,
      nlp: results.NLP,
      metadata: results.metadata,
      error: results.error
    };
    
    const json = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `str-results-${results.metadata?.fileName || 'analysis'}-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!results) return;

    const allItems = [
      ...(results.Extracted?.Diagnoses || []).map(d => ({ ...d, type: 'Diagnosis' })),
      ...(results.Extracted?.Injuries || []).map(i => ({ ...i, type: 'Injury' })),
      ...(results.Extracted?.Events || []).map(e => ({ ...e, type: 'Event' }))
    ];

    const rows = allItems.map(item => {
      const aiAnalysis = results.AIAnalysis?.find(a => a.condition === item.label);
      return {
        Type: item.type,
        Condition: item.label,
        Category: getCategoryLabel(item.category) || 'N/A',
        Occurrences: item.totalOccurrences || 1,
        FirstPage: item.firstOccurrence?.page || 'N/A',
        Laterality: item.laterality?.side || 'N/A',
        Severity: item.severity?.interpretation || 'N/A',
        Confidence: item.confidence?.level || 'N/A',
        AIConnectionType: aiAnalysis?.connectionType || 'Not Analyzed',
        AIEvidenceStrength: aiAnalysis?.evidenceStrength || 'N/A',
        AILegalBasis: aiAnalysis?.legalBasis || 'N/A',
        AIRecommendation: aiAnalysis?.recommendation || 'N/A'
      };
    });

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `str-analysis-${results.metadata?.fileName || 'export'}-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportLegalMemo = () => {
    if (!results) return;

    const actionableItems = results.AIAnalysis?.filter(a => 
      a.canAnalyze && a.connectionType && !['INSUFFICIENT', 'REVIEWED_NOT_DIAGNOSED'].includes(a.connectionType)
    ) || [];

    const memo = `LEGAL MEMORANDUM

VETERAN SERVICE CONNECTION ANALYSIS
Generated: ${new Date().toLocaleString()}
Source Document: ${results.metadata?.fileName || 'Unknown'}

${'='.repeat(80)}

EXECUTIVE SUMMARY

Total Findings: ${(results.Extracted?.Diagnoses?.length || 0) + (results.Extracted?.Injuries?.length || 0) + (results.Extracted?.Events?.length || 0)}
AI Analyzed: ${results.AIAnalysis?.length || 0}
Actionable Service Connections: ${actionableItems.length}

${'='.repeat(80)}

ACTIONABLE SERVICE CONNECTION OPPORTUNITIES

${actionableItems.map((item, idx) => `
${idx + 1}. ${item.condition}
   Connection Type: ${item.connectionType}
   Evidence Strength: ${item.evidenceStrength}
   Legal Basis: ${item.legalBasis || 'Not specified'}
   
   Supporting Evidence:
${item.supportingFacts?.map(f => `   • ${f}`).join('\n') || '   None documented'}
   
   Evidence Gaps:
${item.evidenceGaps?.map(g => `   • ${g}`).join('\n') || '   None identified'}
   
   Recommendation:
   ${item.recommendation || 'No specific recommendation provided'}
   
   ${'-'.repeat(76)}`).join('\n')}

${'='.repeat(80)}

NEXT STEPS

1. Review each actionable finding with veteran
2. Gather additional evidence to address identified gaps
3. Prepare nexus letters for Direct Service Connection claims
4. File VA Form 21-526EZ for each qualifying condition
5. Request C&P examinations as needed

${'='.repeat(80)}

DISCLAIMER

This analysis is generated by AI and should be reviewed by a qualified VSO or attorney.
All legal conclusions require verification against current CFR regulations and case law.

Generated by Rally Forge STR Analysis System
`;

    const blob = new Blob([memo], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `legal-memo-${results.metadata?.fileName || 'analysis'}-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (selectedFile = file) => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('strs', selectedFile);

      const response = await fetch('/api/strs/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();

      // If async queue is unavailable (e.g., Redis not running), fall back to sync processing.
      if (data?.status === 'fallback_sync') {
        const syncFormData = new FormData();
        syncFormData.append('strs', selectedFile);

        const syncResponse = await fetch('/api/strs/upload-sync', {
          method: 'POST',
          body: syncFormData
        });

        if (!syncResponse.ok) {
          throw new Error(`Sync processing failed: ${syncResponse.status}`);
        }

        const syncData = await syncResponse.json();
        setResults(syncData);
        setStatusMessage('Analysis complete. Showing synchronized results.');
      } else {
        setResults(data);
        setStatusMessage('Analysis started. File is queued for background processing.');
      }
    } catch (err) {
      setError(err.message || 'Failed to process STRS file');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setResults(null);
    setError('');
    setStatusMessage(`File selected: ${selectedFile.name}. Analysis started automatically.`);
    handleUpload(selectedFile);
  };

  const toPlainLanguage = (text) => {
    const raw = String(text || '').trim();
    if (!plainLanguage || !raw) return raw;
    return raw
      .replace(/\bDIRECT\b/gi, 'directly tied to service')
      .replace(/\bSECONDARY\b/gi, 'caused by another service-connected condition')
      .replace(/\bAGGRAVATING\b/gi, 'service may have worsened it')
      .replace(/\bINSUFFICIENT\b/gi, 'needs more evidence')
      .replace(/\bREVIEWED_NOT_DIAGNOSED\b/gi, 'reviewed but not a confirmed diagnosis');
  };

  const buildEvidenceGapChecklist = () => {
    const analyses = Array.isArray(results?.AIAnalysis) ? results.AIAnalysis : [];
    return analyses
      .filter((item) => item?.canAnalyze && item?.condition)
      .map((item) => {
        const gaps = Array.isArray(item.evidenceGaps) ? item.evidenceGaps.filter(Boolean) : [];
        const fallbackGaps = [
          'Current diagnosis documentation',
          'In-service event or exposure evidence',
          'Medical nexus statement linking condition to service',
        ];
        return {
          condition: item.condition,
          gaps: gaps.length > 0 ? gaps : fallbackGaps,
        };
      })
      .slice(0, 6);
  };

  const renderOccurrencesTimeline = (item) => {
    const occurrences = item?.allOccurrences || [];

    if (!occurrences.length) {
      return (
        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
          No detailed occurrences available.
        </div>
      );
    }

    return (
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
          Timeline ({occurrences.length} occurrence{occurrences.length !== 1 ? 's' : ''})
        </h4>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.6' }}>
          {occurrences.map((occ, occIdx) => (
            <div
              key={`${item.label}-occ-${occIdx}`}
              style={{
                marginBottom: '0.5rem',
                paddingBottom: '0.5rem',
                borderBottom: occIdx < occurrences.length - 1 ? '1px solid #334155' : 'none'
              }}
            >
              <div style={{ fontWeight: '600', color: '#cbd5e1' }}>
                Occurrence #{occ.position || occIdx + 1}
              </div>
              {occ.page && <div>Page {occ.page}</div>}
              <div>
                Date(s): {occ.dates && occ.dates.length > 0 ? occ.dates.join(', ') : 'Not found in this occurrence context'}
              </div>
              {occ.matchedText && (
                <div style={{ marginTop: '0.25rem', color: '#64748b' }}>
                  "{occ.matchedText}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getCategoryLabel = (category) => {
    if (!category) return null;

    const categoryMap = {
      head: 'Head / Brain',
      spine: 'Spine',
      upper_extremity: 'Upper Extremity',
      lower_extremity: 'Lower Extremity',
      soft_tissue: 'Soft Tissue',
      mental_health: 'Mental Health',
      neurological: 'Neurological',
      musculoskeletal: 'Musculoskeletal',
      cardiovascular: 'Cardiovascular',
      endocrine: 'Endocrine',
      respiratory: 'Respiratory',
      gastrointestinal: 'Gastrointestinal',
      autoimmune: 'Autoimmune',
      lod: 'Line of Duty'
    };

    return categoryMap[category] || category.replace(/_/g, ' ');
  };

  const getAllCategories = () => {
    if (!results?.Extracted) return [];
    const categories = new Set();
    [...(results.Extracted.Diagnoses || []), ...(results.Extracted.Injuries || []), ...(results.Extracted.Events || [])]
      .forEach(item => { if (item.category) categories.add(item.category); });
    return Array.from(categories);
  };

  const toggleFilter = (filterArray, setFilter, value) => {
    if (filterArray.includes(value)) {
      setFilter(filterArray.filter(v => v !== value));
    } else {
      setFilter([...filterArray, value]);
    }
  };

  const applyFilters = (items, type) => {
    if (!items) return [];
    
    return items.filter(item => {
      const aiAnalysis = results.AIAnalysis?.find(a => a.condition === item.label);
      
      // Actionable filter
      if (filterActionableOnly) {
        if (!aiAnalysis?.canAnalyze || !aiAnalysis.connectionType || 
            ['INSUFFICIENT', 'REVIEWED_NOT_DIAGNOSED'].includes(aiAnalysis.connectionType)) {
          return false;
        }
      }
      
      // Category filter
      if (filterCategories.length > 0 && item.category) {
        if (!filterCategories.includes(item.category)) {
          return false;
        }
      }
      
      // Evidence strength filter
      if (filterEvidenceStrength.length > 0 && aiAnalysis?.evidenceStrength) {
        if (!filterEvidenceStrength.includes(aiAnalysis.evidenceStrength)) {
          return false;
        }
      }
      
      // Connection type filter
      if (filterConnectionType.length > 0 && aiAnalysis?.connectionType) {
        if (!filterConnectionType.includes(aiAnalysis.connectionType)) {
          return false;
        }
      }
      
      return true;
    });
  };

  const getExcludedItems = () => {
    if (!results?.AIAnalysis) return [];
    return results.AIAnalysis.filter(a => 
      a.canAnalyze && a.connectionType === 'REVIEWED_NOT_DIAGNOSED'
    );
  };

  const renderAIAnalysisCard = (aiAnalysis) => {
    if (!aiAnalysis) return null;

    if (!aiAnalysis.canAnalyze) {
      return (
        <div style={{ padding: '0.5rem', backgroundColor: '#991b1b', borderRadius: '0.25rem', fontSize: '0.7rem', color: '#fecaca', marginTop: '0.75rem' }}>
          AI Analysis unavailable: {aiAnalysis.error || 'ANTHROPIC_API_KEY not configured'}
        </div>
      );
    }

    return (
      <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #334155', marginTop: '0.75rem' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
          AI Service Connection Analysis
        </h4>
        <div style={{ fontSize: '0.7rem', lineHeight: '1.6' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#94a3b8' }}>Connection Type: </span>
            <span style={{
              fontWeight: '600',
              color: aiAnalysis.connectionType === 'INSUFFICIENT' ? '#fca5a5'
                : aiAnalysis.connectionType === 'REVIEWED_NOT_DIAGNOSED' ? '#94a3b8'
                  : '#34d399'
            }}>
              {aiAnalysis.connectionType === 'REVIEWED_NOT_DIAGNOSED' ? 'REVIEWED (NOT DIAGNOSED)' : aiAnalysis.connectionType}
            </span>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#94a3b8' }}>Evidence Strength: </span>
            <span style={{ fontWeight: '600', color: aiAnalysis.evidenceStrength === 'High' ? '#34d399' : aiAnalysis.evidenceStrength === 'Medium' ? '#fbbf24' : '#fca5a5' }}>
              {aiAnalysis.evidenceStrength}
            </span>
          </div>
          {aiAnalysis.legalBasis && (
            <div style={{ marginBottom: '0.5rem', color: '#cbd5e1' }}>
              <strong>Legal Basis:</strong> {aiAnalysis.legalBasis}
            </div>
          )}
          {aiAnalysis.supportingFacts && aiAnalysis.supportingFacts.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: '#cbd5e1' }}>Supporting Evidence:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#94a3b8' }}>
                {aiAnalysis.supportingFacts.map((fact, idx) => (
                  <li key={`fact-${idx}`} style={{ marginBottom: '0.25rem' }}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
          {aiAnalysis.evidenceGaps && aiAnalysis.evidenceGaps.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: '#cbd5e1' }}>Evidence Gaps:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#fca5a5' }}>
                {aiAnalysis.evidenceGaps.map((gap, idx) => (
                  <li key={`gap-${idx}`} style={{ marginBottom: '0.25rem' }}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          {aiAnalysis.recommendation && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#1e293b', borderRadius: '0.25rem', color: '#cbd5e1' }}>
              <strong>Recommendation:</strong> {toPlainLanguage(aiAnalysis.recommendation)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className='page-shell'>
      <section className='page-header'>
        <div>
          <div className='page-eyebrow'>Scanner</div>
          <h1 className='page-title'>Service Treatment Records</h1>
          <p className='page-copy'>
            Upload a PDF or TXT STR file to extract diagnoses, injuries, and service events. AI analysis is applied when configured.
          </p>
        </div>
        <div className='page-badge'>STR extraction engine</div>
      </section>
      <Card title='Upload Service Treatment Records'>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}>
              Select STR File (PDF or TXT)
            </label>
            <input
              type='file'
              accept='.pdf,.txt'
              onChange={handleFileChange}
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                fontSize: '0.875rem',
                color: '#cbd5e1',
                padding: '0.5rem',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.375rem'
              }}
            />
          </div>

          {file && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', backgroundColor: '#1e293b', padding: '0.5rem', borderRadius: '0.25rem' }}>
              Selected file: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}

          {loading && (
            <div
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                borderRadius: '0.375rem',
                backgroundColor: '#64748b',
                color: '#0f172a',
                fontWeight: '600',
                opacity: '0.8'
              }}
            >
              ⏳ Processing...
            </div>
          )}

          {statusMessage && !error && (
            <div
              aria-live='polite'
              style={{
                padding: '0.75rem',
                backgroundColor: '#0f3b2e',
                border: '1px solid #0d5f49',
                borderRadius: '0.375rem'
              }}
            >
              <p style={{ fontSize: '0.75rem', color: '#99f6e4', fontWeight: '600' }}>{statusMessage}</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '0.75rem', backgroundColor: '#991b1b', border: '1px solid #7f1d1d', borderRadius: '0.375rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#fca5a5', fontWeight: '600' }}>Error</p>
              <p style={{ fontSize: '0.75rem', color: '#fecaca', marginTop: '0.25rem' }}>{error}</p>
            </div>
          )}
        </div>
      </Card>

      {results && (
        <Card title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>STR Analysis Results</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type='button'
                onClick={() => setPlainLanguage((value) => !value)}
                className='plain-toggle'
              >
                {plainLanguage ? 'Plain Language: ON' : 'Plain Language: OFF'}
              </button>
              <button
                type='button'
                onClick={exportToCSV}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#0f172a',
                  color: '#14b8a6',
                  fontWeight: '600',
                  border: '1px solid #14b8a6',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#14b8a6';
                  e.target.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#0f172a';
                  e.target.style.color = '#14b8a6';
                }}
              >
                📊 Export CSV
              </button>
              <button
                type='button'
                onClick={exportLegalMemo}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#0f172a',
                  color: '#14b8a6',
                  fontWeight: '600',
                  border: '1px solid #14b8a6',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#14b8a6';
                  e.target.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#0f172a';
                  e.target.style.color = '#14b8a6';
                }}
              >
                📄 Legal Memo
              </button>
              <button
                type='button'
                onClick={saveResultsToFile}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#0f172a',
                  color: '#14b8a6',
                  fontWeight: '600',
                  border: '1px solid #14b8a6',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#14b8a6';
                  e.target.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#0f172a';
                  e.target.style.color = '#14b8a6';
                }}
              >
                💾 Save JSON
              </button>
            </div>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {results.success ? (
              <>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>File: {results.metadata?.fileName}</p>
                  <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600', marginBottom: '0.5rem' }}>✓ Successfully processed</p>
                  {!!results.AIAnalysis?.length && (
                    <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                      AI analyzed {results.AIAnalysis.length} finding(s) •
                      Actionable: {results.AIAnalysis.filter((a) => a.canAnalyze && a.connectionType && !['INSUFFICIENT', 'REVIEWED_NOT_DIAGNOSED'].includes(a.connectionType)).length}
                    </p>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#14b8a6', fontWeight: '600' }}>
                      {(results.Extracted?.Diagnoses?.length || 0)} Diagnoses
                    </span>
                    <span style={{ color: '#f97316', fontWeight: '600' }}>
                      {(results.Extracted?.Injuries?.length || 0)} Injuries
                    </span>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>
                      {(results.Extracted?.Events?.length || 0)} Events
                    </span>
                    <span style={{ color: '#94a3b8' }}>
                      • Total: {((results.Extracted?.Diagnoses?.length || 0) + (results.Extracted?.Injuries?.length || 0) + (results.Extracted?.Events?.length || 0))} findings
                    </span>
                  </div>
                </div>

                {buildEvidenceGapChecklist().length > 0 && (
                  <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                      Evidence Gap Finder
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                      Focus first on these missing items to make your claim stronger.
                    </div>
                    <div className='gap-grid'>
                      {buildEvidenceGapChecklist().map((item, idx) => (
                        <div key={`gap-item-${idx}`} className='gap-card'>
                          <div className='gap-title'>{item.condition}</div>
                          <ul className='gap-list'>
                            {item.gaps.map((gap, gapIdx) => (
                              <li key={`gap-${idx}-${gapIdx}`}>{toPlainLanguage(gap)}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtering Controls */}
                <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.75rem' }}>🔍 Filter Results</h3>
                  
                  {/* Quick Filters */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Quick Filters:</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setFilterActionableOnly(!filterActionableOnly)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.7rem',
                          borderRadius: '1rem',
                          backgroundColor: filterActionableOnly ? '#14b8a6' : '#0f172a',
                          color: filterActionableOnly ? '#0f172a' : '#14b8a6',
                          fontWeight: '600',
                          border: '1px solid #14b8a6',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {filterActionableOnly ? '✓' : ''} Actionable Only
                      </button>
                      <button
                        onClick={() => setShowExclusionPanel(!showExclusionPanel)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          fontSize: '0.7rem',
                          borderRadius: '1rem',
                          backgroundColor: showExclusionPanel ? '#f97316' : '#0f172a',
                          color: showExclusionPanel ? '#0f172a' : '#f97316',
                          fontWeight: '600',
                          border: '1px solid #f97316',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {showExclusionPanel ? '✓' : ''} Show Exclusions ({getExcludedItems().length})
                      </button>
                    </div>
                  </div>

                  {/* Category Filters */}
                  {getAllCategories().length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Body System:</div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {getAllCategories().map(cat => (
                          <button
                            key={cat}
                            onClick={() => toggleFilter(filterCategories, setFilterCategories, cat)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.7rem',
                              borderRadius: '1rem',
                              backgroundColor: filterCategories.includes(cat) ? '#8b5cf6' : '#0f172a',
                              color: filterCategories.includes(cat) ? '#0f172a' : '#8b5cf6',
                              fontWeight: '600',
                              border: '1px solid #8b5cf6',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {filterCategories.includes(cat) ? '✓ ' : ''}{getCategoryLabel(cat)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evidence Strength Filters */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Evidence Strength:</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {['High', 'Medium', 'Low'].map(strength => (
                        <button
                          key={strength}
                          onClick={() => toggleFilter(filterEvidenceStrength, setFilterEvidenceStrength, strength)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.7rem',
                            borderRadius: '1rem',
                            backgroundColor: filterEvidenceStrength.includes(strength) 
                              ? (strength === 'High' ? '#34d399' : strength === 'Medium' ? '#fbbf24' : '#fca5a5')
                              : '#0f172a',
                            color: filterEvidenceStrength.includes(strength) ? '#0f172a' 
                              : (strength === 'High' ? '#34d399' : strength === 'Medium' ? '#fbbf24' : '#fca5a5'),
                            fontWeight: '600',
                            border: `1px solid ${strength === 'High' ? '#34d399' : strength === 'Medium' ? '#fbbf24' : '#fca5a5'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {filterEvidenceStrength.includes(strength) ? '✓ ' : ''}{strength}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Connection Type Filters */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Connection Type:</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {['DIRECT', 'SECONDARY', 'AGGRAVATING'].map(type => (
                        <button
                          key={type}
                          onClick={() => toggleFilter(filterConnectionType, setFilterConnectionType, type)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.7rem',
                            borderRadius: '1rem',
                            backgroundColor: filterConnectionType.includes(type) ? '#34d399' : '#0f172a',
                            color: filterConnectionType.includes(type) ? '#0f172a' : '#34d399',
                            fontWeight: '600',
                            border: '1px solid #34d399',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {filterConnectionType.includes(type) ? '✓ ' : ''}{type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(filterActionableOnly || filterCategories.length > 0 || filterEvidenceStrength.length > 0 || filterConnectionType.length > 0) && (
                    <button
                      onClick={() => {
                        setFilterActionableOnly(false);
                        setFilterCategories([]);
                        setFilterEvidenceStrength([]);
                        setFilterConnectionType([]);
                      }}
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.7rem',
                        borderRadius: '0.375rem',
                        backgroundColor: '#991b1b',
                        color: '#fecaca',
                        fontWeight: '600',
                        border: '1px solid #7f1d1d',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🗑️ Clear All Filters
                    </button>
                  )}
                </div>

                {/* Exclusion Panel */}
                {showExclusionPanel && getExcludedItems().length > 0 && (
                  <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.375rem', border: '1px solid #f97316' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#f97316', marginBottom: '0.75rem' }}>
                      ⚠️ Excluded Items: Reviewed But Not Diagnosed ({getExcludedItems().length})
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                      These conditions appeared in the records but were determined to be screening mentions, negated findings, or review-of-systems entries rather than confirmed diagnoses.
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {getExcludedItems().map((item, idx) => (
                        <li key={idx} style={{ 
                          marginBottom: '0.75rem', 
                          padding: '0.75rem', 
                          backgroundColor: '#0f172a', 
                          borderRadius: '0.375rem',
                          border: '1px solid #334155'
                        }}>
                          <div style={{ fontWeight: '600', color: '#fca5a5', marginBottom: '0.5rem' }}>
                            {item.condition}
                          </div>
                          {item.evidenceGaps && item.evidenceGaps.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                              <strong>Why Excluded:</strong>
                              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#94a3b8' }}>
                                {item.evidenceGaps.map((gap, gIdx) => (
                                  <li key={gIdx} style={{ marginBottom: '0.25rem' }}>{gap}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.recommendation && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#cbd5e1' }}>
                              <strong>Note:</strong> {item.recommendation}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(() => {
                  const filteredDiagnoses = applyFilters(results.Extracted?.Diagnoses, 'diagnosis');
                  const filteredInjuries = applyFilters(results.Extracted?.Injuries, 'injury');
                  const filteredEvents = applyFilters(results.Extracted?.Events, 'event');
                  const totalFiltered = filteredDiagnoses.length + filteredInjuries.length + filteredEvents.length;
                  const totalOriginal = (results.Extracted?.Diagnoses?.length || 0) + (results.Extracted?.Injuries?.length || 0) + (results.Extracted?.Events?.length || 0);
                  
                  return (
                    (filterActionableOnly || filterCategories.length > 0 || filterEvidenceStrength.length > 0 || filterConnectionType.length > 0) && (
                      <div style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                          Showing <span style={{ fontWeight: '600', color: '#14b8a6' }}>{totalFiltered}</span> of <span style={{ fontWeight: '600' }}>{totalOriginal}</span> findings
                        </div>
                      </div>
                    )
                  );
                })()}

                {results.Extracted?.Diagnoses && results.Extracted.Diagnoses.length > 0 && (() => {
                  const filtered = applyFilters(results.Extracted.Diagnoses, 'diagnosis');
                  return filtered.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                      Diagnoses Found ({filtered.length}{filtered.length !== results.Extracted.Diagnoses.length ? ` of ${results.Extracted.Diagnoses.length}` : ''}) - Medical Conditions & Diseases
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      Click any condition to see timeline, pages, and service connection analysis
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {filtered.map((diagnosis, idx) => {
                        const aiAnalysis = results.AIAnalysis?.find(a => a.condition === diagnosis.label);
                        const isExpanded = expandedCondition === `diagnosis-${idx}`;
                        
                        return (
                          <li
                            key={idx}
                            style={{
                              marginBottom: '0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #334155',
                              backgroundColor: '#0f172a',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              onClick={() => setExpandedCondition(isExpanded ? null : `diagnosis-${idx}`)}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                backgroundColor: isExpanded ? '#1e293b' : '#0f172a'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                              onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#0f172a' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: '#14b8a6', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    {diagnosis.label}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {diagnosis.totalOccurrences || 1} occurrence{diagnosis.totalOccurrences !== 1 ? 's' : ''}
                                    {diagnosis.firstOccurrence?.page && ` • First on page ${diagnosis.firstOccurrence.page}`}
                                    {diagnosis.followUps > 0 && ` • ${diagnosis.followUps} follow-up${diagnosis.followUps !== 1 ? 's' : ''}`}
                                    {aiAnalysis?.connectionType && (
                                      <span style={{ 
                                        marginLeft: '0.5rem', 
                                        color: aiAnalysis.connectionType === 'INSUFFICIENT' ? '#fca5a5' 
                                             : aiAnalysis.connectionType === 'REVIEWED_NOT_DIAGNOSED' ? '#94a3b8'
                                             : '#34d399' 
                                      }}>
                                        • {aiAnalysis.connectionType === 'REVIEWED_NOT_DIAGNOSED' ? 'REVIEWED (NOT DIAGNOSED)' : aiAnalysis.connectionType}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                  {isExpanded ? '▼' : '▶'}
                                </div>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div style={{ padding: '0.75rem', borderTop: '1px solid #334155', backgroundColor: '#1e293b' }}>
                                {renderOccurrencesTimeline(diagnosis)}
                                
                                {/* AI Service Connection Analysis */}
                                {aiAnalysis && aiAnalysis.canAnalyze && (
                                  <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                                      🤖 AI Service Connection Analysis
                                    </h4>
                                    <div style={{ fontSize: '0.7rem', lineHeight: '1.6' }}>
                                      <div style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#94a3b8' }}>Connection Type: </span>
                                        <span style={{ 
                                          fontWeight: '600', 
                                          color: aiAnalysis.connectionType === 'INSUFFICIENT' ? '#fca5a5' 
                                               : aiAnalysis.connectionType === 'REVIEWED_NOT_DIAGNOSED' ? '#94a3b8'
                                               : '#34d399' 
                                        }}>
                                          {aiAnalysis.connectionType === 'REVIEWED_NOT_DIAGNOSED' ? 'REVIEWED (NOT DIAGNOSED)' : aiAnalysis.connectionType}
                                        </span>
                                      </div>
                                      <div style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#94a3b8' }}>Evidence Strength: </span>
                                        <span style={{ fontWeight: '600', color: aiAnalysis.evidenceStrength === 'High' ? '#34d399' : aiAnalysis.evidenceStrength === 'Medium' ? '#fbbf24' : '#fca5a5' }}>
                                          {aiAnalysis.evidenceStrength}
                                        </span>
                                      </div>
                                      {aiAnalysis.legalBasis && (
                                        <div style={{ marginBottom: '0.5rem', color: '#cbd5e1' }}>
                                          <strong>Legal Basis:</strong> {aiAnalysis.legalBasis}
                                        </div>
                                      )}
                                      {aiAnalysis.supportingFacts && aiAnalysis.supportingFacts.length > 0 && (
                                        <div style={{ marginBottom: '0.5rem' }}>
                                          <strong style={{ color: '#cbd5e1' }}>Supporting Evidence:</strong>
                                          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#94a3b8' }}>
                                            {aiAnalysis.supportingFacts.map((fact, fIdx) => (
                                              <li key={fIdx} style={{ marginBottom: '0.25rem' }}>{fact}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {aiAnalysis.evidenceGaps && aiAnalysis.evidenceGaps.length > 0 && (
                                        <div style={{ marginBottom: '0.5rem' }}>
                                          <strong style={{ color: '#cbd5e1' }}>Evidence Gaps:</strong>
                                          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, color: '#fca5a5' }}>
                                            {aiAnalysis.evidenceGaps.map((gap, gIdx) => (
                                              <li key={gIdx} style={{ marginBottom: '0.25rem' }}>{gap}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {aiAnalysis.recommendation && (
                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#1e293b', borderRadius: '0.25rem', color: '#cbd5e1' }}>
                                          <strong>💡 Recommendation:</strong> {toPlainLanguage(aiAnalysis.recommendation)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {aiAnalysis && !aiAnalysis.canAnalyze && (
                                  <div style={{ padding: '0.5rem', backgroundColor: '#991b1b', borderRadius: '0.25rem', fontSize: '0.7rem', color: '#fecaca' }}>
                                    ⚠️ AI Analysis unavailable: {aiAnalysis.error || 'ANTHROPIC_API_KEY not configured'}
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  );
                })()}

                {/* Injuries Section */}
                {results.Extracted?.Injuries && results.Extracted.Injuries.length > 0 && (() => {
                  const filtered = applyFilters(results.Extracted.Injuries, 'injury');
                  return filtered.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                      Injuries Found ({filtered.length}{filtered.length !== results.Extracted.Injuries.length ? ` of ${results.Extracted.Injuries.length}` : ''}) - Physical Trauma & Acute Injuries
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      Click any injury to see timeline, pages, and service connection analysis
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {filtered.map((injury, idx) => {
                        const aiAnalysis = results.AIAnalysis?.find(a => a.condition === injury.label);
                        const isExpanded = expandedCondition === `injury-${idx}`;
                        
                        return (
                          <li
                            key={idx}
                            style={{
                              marginBottom: '0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #334155',
                              backgroundColor: '#0f172a',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              onClick={() => setExpandedCondition(isExpanded ? null : `injury-${idx}`)}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                backgroundColor: isExpanded ? '#1e293b' : '#0f172a'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                              onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#0f172a' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: '#f97316', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    {injury.label}
                                    {injury.category && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>({getCategoryLabel(injury.category)})</span>}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {injury.totalOccurrences || 1} occurrence{injury.totalOccurrences !== 1 ? 's' : ''}
                                    {injury.firstOccurrence?.page && ` • First on page ${injury.firstOccurrence.page}`}
                                    {injury.followUps > 0 && ` • ${injury.followUps} follow-up${injury.followUps !== 1 ? 's' : ''}`}
                                    {injury.laterality?.side && ` • ${injury.laterality.side}`}
                                    {injury.severity?.interpretation && ` • ${injury.severity.interpretation}`}
                                    {injury.confidence?.level && ` • ${injury.confidence.level.toUpperCase()} confidence`}
                                  </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                  {isExpanded ? '▼' : '▶'}
                                </div>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div style={{ padding: '0.75rem', borderTop: '1px solid #334155', backgroundColor: '#1e293b' }}>
                                {renderOccurrencesTimeline(injury)}
                                {renderAIAnalysisCard(aiAnalysis)}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  );
                })()}

                {/* Events Section */}
                {results.Extracted?.Events && results.Extracted.Events.length > 0 && (() => {
                  const filtered = applyFilters(results.Extracted.Events, 'event');
                  return filtered.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                      Events Found ({filtered.length}{filtered.length !== results.Extracted.Events.length ? ` of ${results.Extracted.Events.length}` : ''}) - LOD Events, Incidents & Accidents
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      Click any event to see timeline, pages, and service connection analysis
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {filtered.map((event, idx) => {
                        const aiAnalysis = results.AIAnalysis?.find(a => a.condition === event.label);
                        const isExpanded = expandedCondition === `event-${idx}`;
                        
                        return (
                          <li
                            key={idx}
                            style={{
                              marginBottom: '0.5rem',
                              borderRadius: '0.375rem',
                              border: '1px solid #334155',
                              backgroundColor: '#0f172a',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              onClick={() => setExpandedCondition(isExpanded ? null : `event-${idx}`)}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                backgroundColor: isExpanded ? '#1e293b' : '#0f172a'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                              onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#0f172a' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    {event.label}
                                    {event.category && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>({getCategoryLabel(event.category)})</span>}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {event.totalOccurrences || 1} occurrence{event.totalOccurrences !== 1 ? 's' : ''}
                                    {event.firstOccurrence?.page && ` • First on page ${event.firstOccurrence.page}`}
                                    {event.followUps > 0 && ` • ${event.followUps} follow-up${event.followUps !== 1 ? 's' : ''}`}
                                    {event.confidence?.level && ` • ${event.confidence.level.toUpperCase()} confidence`}
                                  </div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                  {isExpanded ? '▼' : '▶'}
                                </div>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div style={{ padding: '0.75rem', borderTop: '1px solid #334155', backgroundColor: '#1e293b' }}>
                                {renderOccurrencesTimeline(event)}
                                {renderAIAnalysisCard(aiAnalysis)}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  );
                })()}

                {results.Extracted && (
                  <details style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                    <summary style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', cursor: 'pointer' }}>
                      View Extracted Data
                    </summary>
                    <pre style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', overflow: 'auto', maxHeight: '300px' }}>
                      {JSON.stringify(results.Extracted, null, 2)}
                    </pre>
                  </details>
                )}

                {results.Analysis && (
                  <details style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                    <summary style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', cursor: 'pointer' }}>
                      View Analysis
                    </summary>
                    <pre style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', overflow: 'auto', maxHeight: '300px' }}>
                      {JSON.stringify(results.Analysis, null, 2)}
                    </pre>
                  </details>
                )}

                {results.NLP && (
                  <details style={{ backgroundColor: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}>
                    <summary style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', cursor: 'pointer' }}>
                      View NLP Data
                    </summary>
                    <pre style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', overflow: 'auto', maxHeight: '300px' }}>
                      {JSON.stringify(results.NLP, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            ) : (
              <div style={{ padding: '0.75rem', backgroundColor: '#991b1b', border: '1px solid #7f1d1d', borderRadius: '0.375rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#fca5a5', fontWeight: '600' }}>Processing Failed</p>
                <p style={{ fontSize: '0.75rem', color: '#fecaca', marginTop: '0.25rem' }}>{results.error || 'Unknown error'}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title='About Service Treatment Records'>
        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.5' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            Service Treatment Records (STRs) contain your complete medical history during military service. 
            This scanner analyzes STRs using PowerShell-based natural language processing to extract:
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
            <li>Diagnoses and medical conditions</li>
            <li>Treatment dates and providers</li>
            <li>Medications prescribed</li>
            <li>Medical procedures performed</li>
            <li>Service connection opportunities</li>
          </ul>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
            Note: This tool requires PowerShell to be installed on your system. Results are extracted using 
            the STRS.Scanner.ps1 or STRS.Scanner.Text.ps1 scripts.
          </p>
        </div>
      </Card>
    </div>
  );
}
