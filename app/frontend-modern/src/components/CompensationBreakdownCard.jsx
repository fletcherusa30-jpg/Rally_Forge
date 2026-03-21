import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import {
  formatUsd,
  normalizeCompensationBreakdown,
  getHighestSmcCodeFromDecision,
  resolveCompensationForDisplay,
} from '../services/compensationUtils.js';

export function CompensationBreakdownCard({ selected, decisions, selectedIndex, onSelectIndex, onSaveCurrent, onSaveAll }) {
  const [currentCompensation, setCurrentCompensation] = useState(null);

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
        const currentYear = new Date().getFullYear();
        const response = await fetch('/api/compensation/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: selected.rating,
            dependents: {},
            smcCode: smcCode || null,
            ancillary: { aidAndAttendance: false, housebound: false },
            yearOverride: currentYear,
          }),
        });

        if (!response.ok) throw new Error('Failed to load current compensation');

        const data = await response.json();
        const quoteBreakdown = normalizeCompensationBreakdown(data?.quote);

        if (!isCancelled) {
          if (quoteBreakdown) {
            setCurrentCompensation(quoteBreakdown);
            return;
          }

          const params = new URLSearchParams({ rating: String(selected.rating), year: String(currentYear) });
          if (smcCode) params.set('smcCode', smcCode);

          const fallbackResponse = await fetch(`/api/compensation?${params.toString()}`);
          if (!fallbackResponse.ok) throw new Error('Failed to load current compensation');

          const fallbackData = await fallbackResponse.json();
          const fallbackBreakdown = normalizeCompensationBreakdown(fallbackData);
          setCurrentCompensation(fallbackBreakdown);
        }
      } catch (err) {
        console.error('[CompensationBreakdownCard] Compensation load failed:', err.message);
        if (!isCancelled) setCurrentCompensation(null);
      }
    };

    loadCurrentCompensation();
    return () => { isCancelled = true; };
  }, [selectedIndex, decisions]);

  const { compensationForDisplay, currentTotalMonthly } = resolveCompensationForDisplay(selected, currentCompensation);
  const appliedSmcCode =
    selected?.compensation?.components?.smc?.code || (selected ? getHighestSmcCodeFromDecision(selected) : null);

  return (
    <Card title='Results - VA Rating Decision'>
      {/* Decision selector tabs */}
      {decisions.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {selected && onSaveCurrent && (
            <button
              type='button'
              onClick={onSaveCurrent}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.35rem',
                border: '1px solid #14b8a6',
                backgroundColor: '#0f172a',
                color: '#14b8a6',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              💾 Save Current
            </button>
          )}
          {decisions.length > 1 && onSaveAll && (
            <button
              type='button'
              onClick={onSaveAll}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '0.35rem',
                border: '1px solid #5eead4',
                backgroundColor: '#0f172a',
                color: '#5eead4',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              💾 Save All ({decisions.length})
            </button>
          )}
        </div>
      )}

      {decisions.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {decisions.map((decision, idx) => (
            <button
              key={idx}
              type='button'
              onClick={() => onSelectIndex(idx)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: '0.35rem',
                border: idx === selectedIndex ? '1px solid #14b8a6' : '1px solid #334155',
                backgroundColor: '#0f172a',
                color: idx === selectedIndex ? '#14b8a6' : '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              Decision:{' '}
              {(decision.effectiveDates && decision.effectiveDates[0]?.date) ||
                (decision.scannedAt ? new Date(decision.scannedAt).toLocaleDateString() : `#${idx + 1}`)}
            </button>
          ))}
        </div>
      )}

      {!selected && <p>No results yet. Select files to start scanner processing automatically.</p>}

      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scanned at: {selected.scannedAt}</div>

          <div
            style={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              marginBottom: '0.35rem',
              padding: '0.5rem',
              backgroundColor: '#0f172a',
              borderRadius: '0.35rem',
              border: '1px dashed #334155',
            }}
          >
            <strong>Debug Payload:</strong>{' '}
            dependents(array)={Array.isArray(selected.rawData?.dependents) ? selected.rawData.dependents.length : 0},{' '}
            dependents.added=
            {Array.isArray(selected.rawData?.dependents?.added) ? selected.rawData.dependents.added.length : 0},{' '}
            dependentsDetailed.added=
            {Array.isArray(selected.rawData?.dependentsDetailed?.added)
              ? selected.rawData.dependentsDetailed.added.length
              : 0}
            , dependentAdjustments=
            {Array.isArray(selected.rawData?.dependentAdjustments) ? selected.rawData.dependentAdjustments.length : 0}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '1rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              padding: '0.75rem',
            }}
          >
            {/* Effective Dates */}
            <div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>
                ✓ Disability Rating Effective Date(s)
              </p>
              {selected.effectiveDates?.map((item, idx) => (
                <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                  • {item.date} ({item.rating}%)
                </p>
              ))}
            </div>

            {/* Dependents */}
            <div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>
                👨‍👩‍👧 Dependents
              </p>
              {(() => {
                const dependentList = Array.isArray(selected.dependents)
                  ? selected.dependents
                  : selected.dependents?.added ||
                    selected.dependentsDetailed?.added ||
                    selected.rawData?.dependentsDetailed?.added ||
                    [];

                if (dependentList.length > 0) {
                  return (
                    <>
                      {dependentList.map((dep, idx) => {
                        const lowerType = String(dep?.type || '').toLowerCase();
                        const rate = lowerType === 'spouse' ? 'Included in base rate' : '';
                        return (
                          <p key={idx} style={{ fontSize: '0.75rem', color: '#e2e8f0', marginBottom: '0.15rem' }}>
                            •{' '}
                            <strong>
                              {String(dep.type || 'Unknown').charAt(0).toUpperCase() +
                                String(dep.type || 'Unknown').slice(1)}
                            </strong>{' '}
                            — {dep.name}
                            {rate && <span style={{ color: '#86efac', marginLeft: '0.5rem' }}>({rate})</span>}
                          </p>
                        );
                      })}
                      <p
                        style={{
                          fontSize: '0.65rem',
                          color: '#64748b',
                          marginTop: '0.5rem',
                          fontStyle: 'italic',
                        }}
                      >
                        ℹ️ Dependent rates vary by rating and tier. See "Total Monthly" below for calculated
                        compensation.
                      </p>
                      {(selected.dependentsDetailed?.totalDependentAmount || 0) > 0 && (
                        <p style={{ fontSize: '0.75rem', color: '#5eead4', marginTop: '0.25rem', fontWeight: 600 }}>
                          Total: ${selected.dependentsDetailed.totalDependentAmount.toFixed(2)}/mo
                        </p>
                      )}
                    </>
                  );
                }

                return (selected.dependentAdjustments?.length || 0) > 0 ||
                  (selected.rawData?.dependentAdjustments?.length || 0) > 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                    Dependent activity detected (records still resolving)
                  </p>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>No dependents found</p>
                );
              })()}
            </div>

            {/* Dependent Adjustments */}
            <div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>
                📅 Dependent Adjustments
              </p>
              {(() => {
                const dependentList = Array.isArray(selected.dependents)
                  ? selected.dependents
                  : selected.dependents?.added ||
                    selected.dependentsDetailed?.added ||
                    selected.rawData?.dependentsDetailed?.added ||
                    [];

                const amountByName = new Map(
                  dependentList
                    .map((dep) => ({
                      name: String(dep?.name || '').trim().toLowerCase(),
                      amount: Number(dep?.monthlyAmount),
                    }))
                    .filter((item) => item.name && Number.isFinite(item.amount) && item.amount > 0)
                    .map((item) => [item.name, item.amount])
                );

                const adjustments = [...(Array.isArray(selected.dependentAdjustments) ? selected.dependentAdjustments : [])];
                adjustments.sort(
                  (a, b) => new Date(a?.date || a?.removalDate || 0) - new Date(b?.date || b?.removalDate || 0)
                );

                if (!adjustments.length) {
                  return <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No adjustments</p>;
                }

                return adjustments.map((adj, idx) => {
                  const dateLabel = adj?.date || adj?.removalDate;
                  const name = String(adj?.name || '').trim();
                  const amountFromDependent = amountByName.get(name.toLowerCase());
                  const amountFromAdjustment = Math.abs(Number(adj?.amount ?? adj?.adjustmentAmount));
                  const displayAmount = Number.isFinite(amountFromDependent)
                    ? amountFromDependent
                    : Number.isFinite(amountFromAdjustment) && amountFromAdjustment > 0
                    ? amountFromAdjustment
                    : null;
                  const newMonthlyAmount = Number(adj?.newMonthlyAmount);

                  return (
                    <p key={idx} style={{ fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
                      • {dateLabel} {name ? <span>{name}</span> : ''}{' '}
                      {Number.isFinite(displayAmount) ? (
                        <span style={{ color: '#34d399' }}>(-${displayAmount.toFixed(2)})</span>
                      ) : null}{' '}
                      {Number.isFinite(newMonthlyAmount) ? (
                        <span style={{ color: '#93c5fd' }}>→ New Monthly: ${newMonthlyAmount.toFixed(2)}</span>
                      ) : null}{' '}
                      <span style={{ color: '#94a3b8' }}>(dependent adjustment)</span>
                    </p>
                  );
                });
              })()}
            </div>
          </div>

          {/* Rating + Compensation */}
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
              <div
                style={{
                  marginTop: '0.4rem',
                  fontSize: '0.78rem',
                  color: '#cbd5e1',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.55rem',
                }}
              >
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
          </div>

          {/* Conditions */}
          <div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.25rem' }}>
              Conditions
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {selected.conditions?.map((condition, idx) => (
                <li
                  key={idx}
                  style={{
                    marginBottom: '0.35rem',
                    padding: '0.5rem',
                    borderRadius: '0.35rem',
                    border: '1px solid #334155',
                    backgroundColor: '#0f172a',
                  }}
                >
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
  );
}
