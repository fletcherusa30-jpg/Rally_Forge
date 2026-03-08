import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { getScannerData } from '../api/client';
import { ManualConditionEntry } from '../components/ManualConditionEntry';

export function ScannerHub() {
  const [activeTab, setActiveTab] = useState('upload');
  const [decisions, setDecisions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentCompensation, setCurrentCompensation] = useState(null);

  const SMC_RANK_ORDER = ['T', 'S', 'R2', 'R1', 'O', 'N½', 'N', 'M½', 'M', 'L½', 'L', 'K'];

  const formatUsd = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

  const normalizeCompensationBreakdown = (input) => {
    const value = input || {};
    if (value.breakdown && typeof value.breakdown.totalMonthly === 'number' && Number.isFinite(value.breakdown.totalMonthly)) {
      return value.breakdown;
    }
    if (typeof value.totalMonthly === 'number' && Number.isFinite(value.totalMonthly)) {
      return {
        baseMonthly: value.baseMonthly ?? value.ratingMonthly ?? 0,
        dependentMonthly: value.dependentMonthly ?? 0,
        smcMonthly: value.smcMonthly ?? 0,
        ancillaryMonthly: value.ancillaryMonthly ?? 0,
        totalMonthly: value.totalMonthly,
        totalYearly: value.totalYearly ?? value.totalMonthly * 12
      };
    }
    return null;
  };

  const extractSmcCodes = (value) => {
    const text = String(value || '').trim();
    if (!text) return [];
    const candidates = new Set();
    const explicitMatches = text.matchAll(/\bSMC[-\s]?(R1|R2|L½|M½|N½|[KLMNOST])\b/gi);
    for (const match of explicitMatches) {
      candidates.add(match[1].toUpperCase());
    }
    const levelListMatches = text.matchAll(/(?:^|[,;\s])(R1|R2|L½|M½|N½|[KLMNOST])\s*[-:]/gi);
    for (const match of levelListMatches) {
      candidates.add(match[1].toUpperCase());
    }
    return Array.from(candidates);
  };

  const getHighestSmcCodeFromDecision = (decision) => {
    const candidates = new Set();

    // Parse scanner-provided SMC entries directly
    const explicitSmc = Array.isArray(decision?.smc) ? decision.smc : [];
    explicitSmc.forEach((entry) => {
      const parsedCodes = extractSmcCodes(entry);
      parsedCodes.forEach((code) => candidates.add(code));
    });

    for (const code of SMC_RANK_ORDER) {
      if (candidates.has(code)) {
        return code;
      }
    }

    return null;
  };

  const runScanner = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getScannerData();
      setDecisions((prev) => {
        const next = [...prev, { ...data, scannedAt: new Date().toISOString() }];
        setSelectedIndex(next.length - 1);
        return next;
      });
    } catch (err) {
      setError(err.message || 'Failed to load scanner data');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = (manualResult) => {
    const nextDecision = {
      conditions: (manualResult.serviceConnected || []).map((item) => item.condition),
      rating: manualResult.ratingCalculation?.calculatedCombinedRating || 0,
      smc: [],
      effectiveDates: (manualResult.serviceConnected || [])
        .filter((item) => item.effectiveDate)
        .map((item) => ({ date: item.effectiveDate, rating: item.percentage || 0 })),
      scannedAt: new Date().toISOString(),
      source: 'manual'
    };

    setDecisions((prev) => {
      const next = [...prev, nextDecision];
      setSelectedIndex(next.length - 1);
      return next;
    });
    setActiveTab('upload');
  };

  const selected = decisions[selectedIndex] || null;
  const displayedCompensation = selected ? normalizeCompensationBreakdown(selected?.compensation) : null;
  const scannedFinalMonthly = Number(selected?.finalMonthlyAmount);
  const hasScannedFinalMonthly = Number.isFinite(scannedFinalMonthly) && scannedFinalMonthly > 0;

  let compensationForDisplay = displayedCompensation || currentCompensation;
  if (compensationForDisplay && hasScannedFinalMonthly) {
    const calculatedTotal = Number(compensationForDisplay.totalMonthly || 0);
    if (!Number.isFinite(calculatedTotal) || Math.abs(scannedFinalMonthly - calculatedTotal) > 0.01) {
      const baseMonthly = Number(compensationForDisplay.baseMonthly || 0);
      const smcMonthly = Number(compensationForDisplay.smcMonthly || 0);
      const ancillaryMonthly = Number(compensationForDisplay.ancillaryMonthly || 0);
      const derivedDependentMonthly = Math.max(0, scannedFinalMonthly - (baseMonthly + smcMonthly + ancillaryMonthly));

      compensationForDisplay = {
        ...compensationForDisplay,
        dependentMonthly: Math.max(Number(compensationForDisplay.dependentMonthly || 0), derivedDependentMonthly),
        totalMonthly: scannedFinalMonthly,
        totalYearly: scannedFinalMonthly * 12
      };
    }
  }

  const currentTotalMonthly = hasScannedFinalMonthly
    ? scannedFinalMonthly
    : Number(compensationForDisplay?.totalMonthly || 0);

  const appliedSmcCode = selected?.compensation?.components?.smc?.code || (selected ? getHighestSmcCodeFromDecision(selected) : null);

  useEffect(() => {
    let isCancelled = false;

    const loadCurrentCompensation = async () => {
      if (!selected?.rating) {
        setCurrentCompensation(null);
        return;
      }

      const selectedCompensation = normalizeCompensationBreakdown(selected?.compensation);
      if (selectedCompensation) {
        setCurrentCompensation(selectedCompensation);
        return;
      }

      try {
        const smcCode = getHighestSmcCodeFromDecision(selected);
        const response = await fetch('/api/compensation/quote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rating: selected.rating,
            dependents: {},
            smcCode: smcCode || null, // HARDWIRED: null if no SMC awarded
            ancillary: { aidAndAttendance: false, housebound: false },
            yearOverride: 2026 // HARDWIRED: Force 2026 rate table
          })
        });
        if (!response.ok) {
          throw new Error('Failed to load current compensation');
        }
        const data = await response.json();
        const quoteBreakdown = normalizeCompensationBreakdown(data?.quote);
        if (!isCancelled) {
          if (quoteBreakdown) {
            setCurrentCompensation(quoteBreakdown);
            return;
          }
          // HARDWIRED FALLBACK: Ensure compensation displays with 2026 rates
          const params = new URLSearchParams({ 
            rating: String(selected.rating),
            yearOverride: '2026'
          });
          if (smcCode) {
            params.set('smcCode', smcCode);
          }
          const fallbackResponse = await fetch(`/api/compensation?${params.toString()}`);
          if (!fallbackResponse.ok) {
            throw new Error('Failed to load current compensation fallback');
          }
          const fallbackData = await fallbackResponse.json();
          const fallbackBreakdown = normalizeCompensationBreakdown(fallbackData);
          setCurrentCompensation(fallbackBreakdown);
        }
      } catch (err) {
        console.error('[ScannerHub] Compensation load failed:', err.message);
        if (!isCancelled) {
          setCurrentCompensation(null);
        }
      }
    };

    loadCurrentCompensation();

    return () => {
      isCancelled = true;
    };
  }, [selectedIndex, decisions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#1e293b', padding: '0.25rem', borderRadius: '0.5rem' }}>
        <button
          type='button'
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: activeTab === 'upload' ? '#14b8a6' : 'transparent',
            color: activeTab === 'upload' ? '#0f172a' : '#94a3b8',
            border: 'none',
            borderRadius: '0.375rem 0.375rem 0 0',
            cursor: 'pointer'
          }}
        >
          📤 Upload & Scan
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('manual')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: activeTab === 'manual' ? '#14b8a6' : 'transparent',
            color: activeTab === 'manual' ? '#0f172a' : '#94a3b8',
            border: 'none',
            borderRadius: '0.375rem 0.375rem 0 0',
            cursor: 'pointer'
          }}
        >
          ✏️ Manual Entry
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('ai-analyzer')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: activeTab === 'ai-analyzer' ? '#14b8a6' : 'transparent',
            color: activeTab === 'ai-analyzer' ? '#0f172a' : '#94a3b8',
            border: 'none',
            borderRadius: '0.375rem 0.375rem 0 0',
            cursor: 'pointer'
          }}
        >
          🤖 AI Analyzer
        </button>
      </div>

      {activeTab === 'manual' && (
        <Card title='Manual VA Disability Entry'>
          <ManualConditionEntry onSave={handleManualSave} />
        </Card>
      )}

      {activeTab === 'ai-analyzer' && (
        <Card title='AI-Powered Condition Analyzer'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                🎯 Intelligent Analysis Features
              </h3>
              <ul style={{ fontSize: '0.75rem', color: '#94a3b8', paddingLeft: '1.25rem', margin: 0 }}>
                <li>Automatic presumptive condition detection (PACT Act, Agent Orange, Gulf War, etc.)</li>
                <li>Service connection pattern matching</li>
                <li>Evidence gap identification</li>
                <li>Nexus letter recommendations</li>
                <li>CFR regulation citations (38 CFR Part 3 & 4)</li>
              </ul>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #64b5f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>💡</span>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#64b5f6', margin: 0 }}>
                  How It Works
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                Upload your VA rating decision, service treatment records, or medical documentation. 
                The AI analyzer will cross-reference with VA regulations, presumptive condition databases, 
                and established case law to identify potential service connections.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '0.25rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>✓ PACT Act Screening</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Burn pit exposure, toxic substances</p>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '0.25rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>✓ Agent Orange</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Vietnam, Thailand, Korean DMZ</p>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '0.25rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>✓ Gulf War Illness</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Chronic multisymptom illness</p>
                </div>
                <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '0.25rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>✓ Radiation Exposure</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Atomic veterans, contaminated sites</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                Upload Document for AI Analysis
              </h3>
              <input
                type='file'
                accept='.pdf,.txt,.doc,.docx,text/*'
                style={{
                  display: 'block',
                  width: '100%',
                  fontSize: '0.875rem',
                  color: '#cbd5e1',
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem'
                }}
              />
              <button
                type='button'
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  fontWeight: '600',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🚀 Run AI Analysis
              </button>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fbbf24' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fbbf24', margin: 0 }}>
                  Example AI Analysis Results
                </h3>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600', marginBottom: '0.25rem' }}>
                  🎯 PRESUMPTIVE CONDITION MATCH FOUND
                </p>
                <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  <strong>Chronic rhinitis</strong> is listed under 38 CFR §3.320 as presumptive for Gulf War service (1990-present).
                </p>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Recommendation: File for service connection based on presumptive status. No nexus letter required.
                </p>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#64b5f6', fontWeight: '600', marginBottom: '0.25rem' }}>
                  📋 EVIDENCE GAP IDENTIFIED
                </p>
                <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Current diagnosis for <strong>Sleep Apnea</strong> found, but missing service connection evidence.
                </p>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Recommendation: Obtain buddy statements, deployment records, or nexus opinion from qualified medical provider.
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'upload' && (
        <>
      <Card title='Upload & Analyze - VA Rating Decision'>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type='button'
            onClick={runScanner}
            disabled={loading}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#14b8a6',
              color: '#0f172a',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Run Scanner'}
          </button>
          <button
            type='button'
            onClick={runScanner}
            disabled={loading}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            + Add Additional Rating Decision
          </button>
        </div>
        {error && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      <Card title='Results - VA Rating Decision'>
        {decisions.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {decisions.map((decision, idx) => (
              <button
                key={idx}
                type='button'
                onClick={() => setSelectedIndex(idx)}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.35rem',
                  border: idx === selectedIndex ? '1px solid #14b8a6' : '1px solid #334155',
                  backgroundColor: '#0f172a',
                  color: idx === selectedIndex ? '#14b8a6' : '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                Decision: {(decision.effectiveDates && decision.effectiveDates[0]) || (decision.scannedAt ? new Date(decision.scannedAt).toLocaleDateString() : `#${idx + 1}`)}
              </button>
            ))}
          </div>
        )}

        {!selected && <p>No results yet. Select files to start scanner processing automatically.</p>}

        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scanned at: {selected.scannedAt}</div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem', padding: '0.5rem', backgroundColor: '#0f172a', borderRadius: '0.35rem', border: '1px dashed #334155' }}>
              <strong>Debug Payload:</strong>{' '}
              dependents(array)={Array.isArray(selected.rawData?.dependents) ? selected.rawData.dependents.length : 0},{' '}
              dependents.added={Array.isArray(selected.rawData?.dependents?.added) ? selected.rawData.dependents.added.length : 0},{' '}
              dependentsDetailed.added={Array.isArray(selected.rawData?.dependentsDetailed?.added) ? selected.rawData.dependentsDetailed.added.length : 0},{' '}
              dependentAdjustments={Array.isArray(selected.rawData?.dependentAdjustments) ? selected.rawData.dependentAdjustments.length : 0}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.375rem', padding: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>✓ Disability Rating Effective Date(s)</p>
                {selected.effectiveDates?.map((item, idx) => (
                  <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                    • {item.date} ({item.rating}%)
                  </p>
                ))}
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>👨‍👩‍👧 Dependents</p>
                {(() => {
                  const dependentList = Array.isArray(selected.dependents)
                    ? selected.dependents
                    : (selected.dependents?.added || selected.dependentsDetailed?.added || selected.rawData?.dependentsDetailed?.added || []);

                  const getDependentRate = (dep) => {
                    // NOTE: monthlyAmount is no longer extracted from documents (those amounts were unreliable/incorrect)
                    // Dependent rates vary by rating and tier - they're included in the compensation breakdown calculation below
                    const lowerType = String(dep?.type || '').toLowerCase();
                    if (lowerType === 'spouse') {
                      return 'Included in base rate';
                    }
                    // For other dependent types, rate depends on rating and tier (see Total Monthly below)
                    return '';
                  };

                  return dependentList.length > 0 ? (
                  <>
                    {dependentList.map((dep, idx) => {
                      const rate = getDependentRate(dep);
                      return (
                        <p key={idx} style={{ fontSize: '0.75rem', color: '#e2e8f0', marginBottom: '0.15rem' }}>
                          • <strong>{String(dep.type || 'Unknown').charAt(0).toUpperCase() + String(dep.type || 'Unknown').slice(1)}</strong> — {dep.name}
                          {rate && <span style={{ color: '#86efac', marginLeft: '0.5rem' }}>({rate})</span>}
                        </p>
                      );
                    })}
                    <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.5rem', fontStyle: 'italic' }}>
                      ℹ️ Dependent rates vary by rating and tier. See "Total Monthly" below for calculated compensation.
                    </p>
                    {(selected.dependentsDetailed?.totalDependentAmount || 0) > 0 && (
                      <p style={{ fontSize: '0.75rem', color: '#5eead4', marginTop: '0.25rem', fontWeight: 600 }}>
                        Total: ${selected.dependentsDetailed.totalDependentAmount.toFixed(2)}/mo
                      </p>
                    )}
                  </>
                ) : (
                  ((selected.dependentAdjustments?.length || 0) > 0 || (selected.rawData?.dependentAdjustments?.length || 0) > 0)
                    ? <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Dependent activity detected (records still resolving)</p>
                    : <p style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>No dependents found</p>
                );
                })()}
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>📅 Dependent Adjustments</p>
                {(() => {
                  const dependentList = Array.isArray(selected.dependents)
                    ? selected.dependents
                    : (selected.dependents?.added || selected.dependentsDetailed?.added || selected.rawData?.dependentsDetailed?.added || []);

                  const amountByName = new Map(
                    dependentList
                      .map((dep) => ({
                        name: String(dep?.name || '').trim().toLowerCase(),
                        amount: Number(dep?.monthlyAmount)
                      }))
                      .filter((item) => item.name && Number.isFinite(item.amount) && item.amount > 0)
                      .map((item) => [item.name, item.amount])
                  );

                  const adjustments = Array.isArray(selected.dependentAdjustments) ? [...selected.dependentAdjustments] : [];
                  adjustments.sort((left, right) => new Date(left?.date || left?.removalDate || 0) - new Date(right?.date || right?.removalDate || 0));

                  if (!adjustments.length) {
                    return <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No adjustments</p>;
                  }

                  return adjustments.map((adj, idx) => {
                    const dateLabel = adj?.date || adj?.removalDate;
                    const name = String(adj?.name || '').trim();
                    const normalizedName = name.toLowerCase();
                    const amountFromDependent = amountByName.get(normalizedName);
                    const amountFromAdjustment = Math.abs(Number(adj?.amount ?? adj?.adjustmentAmount));
                    const displayAmount = Number.isFinite(amountFromDependent)
                      ? amountFromDependent
                      : (Number.isFinite(amountFromAdjustment) && amountFromAdjustment > 0 ? amountFromAdjustment : null);
                    const newMonthlyAmount = Number(adj?.newMonthlyAmount);

                    return (
                      <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                        • {dateLabel} {name ? <span>{name}</span> : ''} {Number.isFinite(displayAmount) ? <span style={{ color: '#34d399' }}>(-${displayAmount.toFixed(2)})</span> : ''} {Number.isFinite(newMonthlyAmount) ? <span style={{ color: '#93c5fd' }}>→ New Monthly: ${newMonthlyAmount.toFixed(2)}</span> : ''} <span style={{ color: '#94a3b8' }}>(dependent adjustment)</span>
                      </p>
                    );
                  });
                })()}
              </div>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '0.375rem', padding: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Combined Rating</p>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.65rem' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14b8a6' }}>{selected.rating}%</p>
                {currentTotalMonthly > 0 && (
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>
                    {formatUsd(currentTotalMonthly)}/mo
                  </p>
                )}
              </div>
              {compensationForDisplay && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  <span>Base: {formatUsd(compensationForDisplay.baseMonthly)}</span>
                  {compensationForDisplay.dependentMonthly > 0 && (
                    <span style={{ color: '#86efac' }}>
                      Dependents: +{formatUsd(compensationForDisplay.dependentMonthly)}
                    </span>
                  )}
                  {compensationForDisplay.smcMonthly > 0 && (
                    <span>
                      SMC{appliedSmcCode ? ` (${appliedSmcCode})` : ''}: +{formatUsd(compensationForDisplay.smcMonthly)}
                    </span>
                  )}
                  {compensationForDisplay.ancillaryMonthly > 0 && (
                    <span>Ancillary: +{formatUsd(compensationForDisplay.ancillaryMonthly)}</span>
                  )}
                </div>
              )}
              {/* Compensation Timeline - Hidden per user request */}
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>Conditions</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {selected.conditions?.map((condition, idx) => (
                  <li key={idx} style={{ marginBottom: '0.35rem', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #334155', backgroundColor: '#0f172a' }}>
                    {condition}
                  </li>
                ))}
              </ul>
            </div>

            {selected.smc && selected.smc.length > 0 && (
              <div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>SMC</p>
                <p>{selected.smc.join(', ')}</p>
              </div>
            )}
          </div>
        )}
      </Card>
      </>
      )}
    </div>
  );
}

export function VARatingDecision() {
  return <ScannerHub />;
}

export function ServiceTreatmentRecords() {
  return <ScannerHub />;
}
