import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../Card';
import { CompensationBreakdownCard } from '../CompensationBreakdownCard.jsx';
import { startScannerActivity, updateScannerActivity } from '../scanner/scannerActivityStore.js';

export function VAScannerCard({ decisions, selectedIndex, onDecisionsChange, onSelectIndex }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!statusMessage) return;
    const id = setTimeout(() => setStatusMessage(''), 5000);
    return () => clearTimeout(id);
  }, [statusMessage]);

  const getDisabilityEffectiveDates = (scanData) => {
    const fromConditions = (scanData?.serviceConnected || [])
      .filter((item) => item?.effectiveDate)
      .map((item) => ({ date: item.effectiveDate, rating: Number(item?.percentage || 0) }));

    if (fromConditions.length > 0) return fromConditions;

    if (scanData?.metadata?.effectiveDate) {
      return [{ date: scanData.metadata.effectiveDate, rating: Number(scanData?.ratingCalculation?.calculatedCombinedRating || 0) }];
    }

    return [];
  };

  const runScanner = async (filesToScan = selectedFiles) => {
    if (!Array.isArray(filesToScan) || filesToScan.length === 0) {
      setError('Please select at least one PDF file.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const scanned = [];

      for (const file of filesToScan) {
        const activityId = startScannerActivity({
          scannerType: 'scanner-hub',
          fileName: file.name,
          message: 'Uploading decision document',
        });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('scanType', 'ratingDecision');

        updateScannerActivity(activityId, { status: 'processing', progress: 20, message: 'Scanner request sent' });

        const response = await fetch('/api/scanner/scan-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          updateScannerActivity(activityId, {
            status: 'failed',
            progress: 100,
            message: errorData?.error || `Scanner failed (${response.status})`,
          });
          throw new Error(`${file.name}: ${errorData?.error || `Scanner failed (${response.status})`}`);
        }

        const result = await response.json();
        if (!result?.success) {
          updateScannerActivity(activityId, {
            status: 'failed',
            progress: 100,
            message: result?.error || 'Scanner returned unsuccessful result',
          });
          throw new Error(`${file.name}: ${result?.error || 'Scanner returned unsuccessful result'}`);
        }

        updateScannerActivity(activityId, { status: 'completed', progress: 100, message: 'Scanner completed successfully' });

        const conditionLabels = (result.data?.serviceConnected || [])
          .map((item) => {
            const condition = String(item?.condition || '').trim();
            const percentage = Number(item?.percentage || 0);
            return percentage > 0 ? `${condition} (${percentage}%)` : condition;
          })
          .filter(Boolean);

        scanned.push({
          fileName: file.name,
          conditions: conditionLabels,
          rating: Number(result.data?.ratingCalculation?.calculatedCombinedRating || 0),
          smc: Array.isArray(result.data?.smc?.explicit) ? result.data.smc.explicit : [],
          effectiveDates: getDisabilityEffectiveDates(result.data),
          dependents: Array.isArray(result.data?.dependents)
            ? result.data.dependents
            : result.data?.dependents?.added || result.data?.dependentsDetailed?.added || [],
          dependentsDetailed: result.data?.dependentsDetailed || { added: [], removed: [], totalDependentAmount: 0, validationWarnings: [] },
          dependentAdjustments: Array.isArray(result.data?.dependentAdjustments) ? result.data.dependentAdjustments : [],
          finalMonthlyAmount: Number(result.data?.finalMonthlyAmount || 0),
          compensationTimeline: Array.isArray(result.data?.compensationTimeline) ? result.data.compensationTimeline : [],
          scannedAt: new Date().toISOString(),
          source: 'scanner',
          rawData: result.data,
          compensation: result.compensation,
        });
      }

      const next = [...decisions, ...scanned];
      onDecisionsChange(next, next.length - 1);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusMessage(`Scanner complete for ${scanned.length} file${scanned.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      setError(err.message || 'Failed to load scanner data');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(files);
    setStatusMessage(`${files.length} file${files.length !== 1 ? 's' : ''} selected. Scanner started automatically.`);
    await runScanner(files);
  };

  const handleAddMoreFiles = () => {
    fileInputRef.current?.click();
  };

  const saveCurrentDecisionToFile = () => {
    const selected = decisions[selectedIndex];
    if (!selected) return;

    const payload = { savedAt: new Date().toISOString(), selectedIndex, decision: selected };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scanner-decision-${selectedIndex + 1}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveAllDecisionsToFile = () => {
    if (!Array.isArray(decisions) || decisions.length === 0) return;

    const payload = { savedAt: new Date().toISOString(), totalDecisions: decisions.length, decisions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scanner-decisions-all-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selected = decisions[selectedIndex] || null;

  return (
    <>
      <Card title='Upload & Analyze - VA Rating Decision'>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Select PDF File(s)
          </label>
          <input
            ref={fileInputRef}
            type='file'
            accept='.pdf'
            multiple
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
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          />
          {selectedFiles.length > 0 && (
            <div style={{ marginTop: '0.65rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} queued for scan
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type='button'
            onClick={() => runScanner()}
            disabled={loading}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#14b8a6',
              color: '#0f172a',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Loading...' : 'Run Scanner'}
          </button>
          <button
            type='button'
            onClick={handleAddMoreFiles}
            disabled={loading}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '0.375rem',
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#cbd5e1',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            + Add Additional Rating Decision
          </button>
        </div>

        {statusMessage && !error && (
          <div
            aria-live='polite'
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#0f3b2e',
              border: '1px solid #0d5f49',
              borderRadius: '0.375rem',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: '#99f6e4', fontWeight: 600 }}>{statusMessage}</p>
          </div>
        )}

        {error && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      <CompensationBreakdownCard
        selected={selected}
        decisions={decisions}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
        onSaveCurrent={saveCurrentDecisionToFile}
        onSaveAll={saveAllDecisionsToFile}
      />
    </>
  );
}
