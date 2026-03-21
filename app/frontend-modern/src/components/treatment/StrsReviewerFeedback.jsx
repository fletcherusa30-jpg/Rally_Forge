import React from 'react';

export function FindingFeedbackControls({ onMarkTruePositive, onMarkFalsePositive, isSaving = false, statusMessage = '', statusTone = 'default' }) {
  return (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem',
        border: '1px solid #334155',
        borderRadius: '0.375rem',
        backgroundColor: '#0f172a',
      }}
    >
      <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginBottom: '0.4rem' }}>
        Review this extraction
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type='button'
          disabled={isSaving}
          onClick={onMarkTruePositive}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.72rem',
            borderRadius: '0.35rem',
            border: '1px solid #34d399',
            backgroundColor: 'transparent',
            color: '#34d399',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          Mark True Positive
        </button>
        <button
          type='button'
          disabled={isSaving}
          onClick={onMarkFalsePositive}
          style={{
            padding: '0.3rem 0.6rem',
            fontSize: '0.72rem',
            borderRadius: '0.35rem',
            border: '1px solid #fca5a5',
            backgroundColor: 'transparent',
            color: '#fca5a5',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          Mark False Positive
        </button>
      </div>
      {statusMessage && (
        <div
          style={{
            marginTop: '0.45rem',
            fontSize: '0.68rem',
            color: statusTone === 'error' ? '#fca5a5' : '#94a3b8',
          }}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}

export function ReviewerFeedbackPanel({ recentFeedback = [], loading = false, error = '' }) {
  if (loading) {
    return (
      <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
        Loading recent reviewer feedback...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '0.75rem', backgroundColor: '#991b1b', border: '1px solid #7f1d1d', borderRadius: '0.375rem' }}>
        <p style={{ fontSize: '0.75rem', color: '#fecaca' }}>{error}</p>
      </div>
    );
  }

  if (recentFeedback.length === 0) {
    return (
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
        No reviewer feedback recorded yet. Mark findings as true or false positive from any expanded extraction card.
      </div>
    );
  }

  const truePositiveCount = recentFeedback.filter((item) => item?.classification === 'true_positive').length;
  const falsePositiveCount = recentFeedback.filter((item) => item?.classification === 'false_positive').length;

  return (
    <>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
        <span style={{ color: '#cbd5e1' }}>Recent reviews: {recentFeedback.length}</span>
        <span style={{ color: '#34d399' }}>
          True positives: {truePositiveCount}
        </span>
        <span style={{ color: '#fca5a5' }}>
          False positives: {falsePositiveCount}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {recentFeedback.map((item, idx) => (
          <div
            key={`${item?.savedAt || 'feedback'}-${idx}`}
            style={{
              padding: '0.75rem',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#e2e8f0' }}>{item?.findingLabel || 'Unknown finding'}</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: '600',
                  color: item?.classification === 'true_positive' ? '#34d399' : '#fca5a5',
                }}
              >
                {item?.classification === 'true_positive' ? 'TRUE POSITIVE' : 'FALSE POSITIVE'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.6' }}>
              <div>Type: {item?.findingType || 'unknown'}{item?.page ? ` • Page ${item.page}` : ''}</div>
              <div>File: {item?.fileName || 'unknown file'}</div>
              {item?.matchedText && <div>Matched text: "{item.matchedText}"</div>}
              {item?.reason && <div>Reason: {item.reason}</div>}
              {item?.savedAt && <div>Saved: {new Date(item.savedAt).toLocaleString()}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}